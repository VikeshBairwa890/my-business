import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { showToast } from '../../context/ToastContext';

export interface PayBillPageProps {
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenProfile?: () => void;
  siteId?: string;
  bill?: Row;
}

const PAYMENT_MODES = [
  { key: 'UPI', label: 'UPI', icon: 'card-outline' },
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { key: 'BANK', label: 'Bank', icon: 'business-outline' },
  { key: 'CHEQUE', label: 'Cheque', icon: 'receipt-outline' },
];

export function PayBillPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
  bill: initialBill,
}: PayBillPageProps) {
  // All unpaid or partially paid bills in the system
  const unpaidBills = useMemo(() => {
    return data.entries.filter((e) => {
      if (e.voided_at || !['MATERIAL', 'EXPENSE'].includes(e.kind)) return false;
      const paid = data.entries
        .filter((p) => !p.voided_at && p.kind === 'SUPPLIER_PAYMENT' && p.linked_entry_id === e.id)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return Number(e.amount || 0) > paid;
    });
  }, [data.entries]);

  // Selected bill ID
  const [selectedBillId, setSelectedBillId] = useState<string>(
    initialBill?.id || (unpaidBills[0]?.id ? String(unpaidBills[0].id) : '')
  );

  const activeBill = useMemo(() => {
    if (initialBill && initialBill.id === selectedBillId) return initialBill;
    return (
      data.entries.find((e) => e.id === selectedBillId) ||
      initialBill ||
      unpaidBills[0] ||
      null
    );
  }, [data.entries, selectedBillId, initialBill, unpaidBills]);

  const activeSite = useMemo(() => {
    const sId = activeBill?.site_id || initialSiteId;
    return data.sites.find((s) => s.id === sId) || data.sites[0];
  }, [data.sites, activeBill, initialSiteId]);

  // Clean parsed structure for bill details
  const parsedBill = useMemo(() => {
    if (!activeBill) {
      return {
        title: 'Bill Payment',
        partyName: '',
        qtyRate: '',
        notes: '',
        isMaterial: false,
      };
    }

    const isMaterial = activeBill.kind === 'MATERIAL';
    const rawDesc = String(activeBill.description || '').trim();
    const rawParty = String(activeBill.party || '').trim();

    if (!rawDesc) {
      return {
        title: rawParty || (isMaterial ? 'Material Bill' : 'Expense Bill'),
        partyName: rawParty,
        qtyRate: '',
        notes: '',
        isMaterial,
      };
    }

    // Split by bullet separator ' • ' or ' · '
    const parts = rawDesc
      .split(/\s+[•·]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const title = parts[0] || 'Bill';
    let qtyStr = '';
    let rateStr = '';
    let descParty = '';
    const remainingNotes: string[] = [];

    if (activeBill.quantity) {
      qtyStr = `${activeBill.quantity} ${activeBill.unit || ''}`.trim();
    }

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const lower = p.toLowerCase();

      if (lower.startsWith('qty:') || lower.startsWith('qty ')) {
        qtyStr = p.replace(/^qty[:\s]+/i, '').trim();
      } else if (p.startsWith('@') || lower.startsWith('rate:')) {
        rateStr = p.replace(/^(@|rate:)\s*/i, '').trim();
        if (!rateStr.startsWith('₹')) rateStr = `₹${rateStr}`;
      } else if (
        lower.startsWith('paid to ') ||
        lower.startsWith('vendor:') ||
        lower.startsWith('party:') ||
        lower.startsWith('to ')
      ) {
        descParty = p.replace(/^(paid to|vendor:|party:|to)\s+/i, '').trim();
      } else {
        remainingNotes.push(p);
      }
    }

    let finalParty = rawParty;
    if (!finalParty || finalParty === 'Material Supplier' || finalParty === 'Supplier') {
      finalParty = descParty || finalParty;
    }
    if (finalParty && descParty && finalParty.toLowerCase() === descParty.toLowerCase()) {
      finalParty = descParty;
    }

    let qtyRate = '';
    if (qtyStr && rateStr) {
      qtyRate = `${qtyStr} @ ${rateStr}`;
    } else if (qtyStr) {
      qtyRate = `Qty: ${qtyStr}`;
    } else if (rateStr) {
      qtyRate = rateStr;
    }

    return {
      title,
      partyName: finalParty,
      qtyRate,
      notes: remainingNotes.join(' • '),
      isMaterial,
    };
  }, [activeBill]);

  // Financial calculations for active bill
  const totalBillAmount = Number(activeBill?.amount || 0);

  const paidForThisBill = useMemo(() => {
    if (!activeBill) return 0;
    return data.entries
      .filter(
        (e) =>
          !e.voided_at &&
          e.kind === 'SUPPLIER_PAYMENT' &&
          e.linked_entry_id === activeBill.id
      )
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [data.entries, activeBill]);

  const pendingPaise = Math.max(0, totalBillAmount - paidForThisBill);
  const pendingRupees = Math.round(pendingPaise / 100);

  // Form State
  const [formAmount, setFormAmount] = useState<string>(
    pendingRupees > 0 ? String(pendingRupees) : ''
  );
  const [formDate, setFormDate] = useState(today());
  const [formMode, setFormMode] = useState('UPI');
  const [formRef, setFormRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // When active bill changes, update default amount to its pending balance
  const handleSelectBill = (bId: string) => {
    setSelectedBillId(bId);
    const targetBill = data.entries.find((e) => e.id === bId);
    if (targetBill) {
      const paid = data.entries
        .filter(
          (p) =>
            !p.voided_at &&
            p.kind === 'SUPPLIER_PAYMENT' &&
            p.linked_entry_id === targetBill.id
        )
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const pending = Math.max(0, Number(targetBill.amount || 0) - paid);
      setFormAmount(String(Math.round(pending / 100)));
    }
  };

  const handleSavePayment = () => {
    setLocalError('');
    if (!activeBill) {
      showToast('Please select a bill to pay', 'e');
      return;
    }
    const enteredAmt = Number(formAmount);
    if (!enteredAmt || enteredAmt <= 0) {
      showToast('Please enter a valid payment amount', 'e');
      return;
    }

    const enteredPaise = Math.round(enteredAmt * 100);
    if (pendingPaise > 0 && enteredPaise > pendingPaise) {
      showToast(
        `⚠️ Payment amount is greater than pending balance (${money(pendingPaise)})`,
        'w'
      );
    }

    onSave({
      site_id: activeBill.site_id,
      linked_entry_id: activeBill.id,
      date: formDate,
      party: activeBill.party || 'Supplier',
      amount: String(enteredAmt),
      mode: formMode,
      reference: formRef.trim(),
      description:
        formNotes.trim() ||
        `Payment for ${activeBill.description || activeBill.party || 'Bill'}`,
    });
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title="Pay Bill"
        icon="cash"
        userInitials={data.user?.name}
        organizationName={data.organization?.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          ) : undefined
        }
      >
        <View style={styles.container}>
          {/* Bill Selection (Only if opened without pre-selected bill) */}
          {!initialBill && unpaidBills.length > 1 && (
            <Card style={styles.pickerCard}>
              <Text style={styles.fieldLabel}>Select Bill to Pay *</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={selectedBillId}
                  onValueChange={(val) => handleSelectBill(String(val))}
                  style={styles.picker}
                >
                  {unpaidBills.map((b) => (
                    <Picker.Item
                      key={b.id}
                      label={`${b.description || b.party || 'Bill'} • ${money(b.amount || 0)}`}
                      value={b.id}
                    />
                  ))}
                </Picker>
              </View>
            </Card>
          )}

          {/* Sleek Fintech Bill Overview Card */}
          {activeBill && (
            <View style={styles.billHeroCard}>
              {/* Header: Title on left, Badge on right */}
              <View style={styles.billHeaderRow}>
                <Text style={styles.billTitleText} numberOfLines={2}>
                  {parsedBill.title}
                </Text>
                <View
                  style={[
                    styles.badgeWrap,
                    parsedBill.isMaterial ? styles.badgeMaterial : styles.badgeExpense,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      parsedBill.isMaterial
                        ? styles.badgeMaterialText
                        : styles.badgeExpenseText,
                    ]}
                  >
                    {parsedBill.isMaterial ? 'Material Bill' : 'Expense Bill'}
                  </Text>
                </View>
              </View>

              {/* Metadata: Party & Work Site */}
              {parsedBill.partyName || activeSite ? (
                <View style={styles.billMetaRow}>
                  {parsedBill.partyName ? (
                    <View style={styles.metaItem}>
                      <AppIcon name="person-circle-outline" size={13} color="#64748B" />
                      <Text style={styles.metaText}>{parsedBill.partyName}</Text>
                    </View>
                  ) : null}

                  {parsedBill.partyName && activeSite ? (
                    <Text style={styles.metaDot}>•</Text>
                  ) : null}

                  {activeSite ? (
                    <View style={styles.metaItem}>
                      <AppIcon name="business-outline" size={12} color="#64748B" />
                      <Text style={styles.metaText}>{activeSite.name}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Specs & Notes (e.g. 50 Bags @ ₹320) */}
              {parsedBill.qtyRate ? (
                <View style={styles.specRow}>
                  <View style={styles.specChip}>
                    <AppIcon name="cube-outline" size={12} color="#2563EB" />
                    <Text style={styles.specText}>{parsedBill.qtyRate}</Text>
                  </View>
                  {parsedBill.notes ? (
                    <Text style={styles.specNotesText} numberOfLines={1}>
                      {parsedBill.notes}
                    </Text>
                  ) : null}
                </View>
              ) : parsedBill.notes ? (
                <Text style={styles.specNotesText} numberOfLines={2}>
                  {parsedBill.notes}
                </Text>
              ) : null}

              {/* Hairline Divider */}
              <View style={styles.billDivider} />

              {/* Clean Financial Breakdown */}
              <View style={styles.billFinancialsRow}>
                <View style={styles.finColLeft}>
                  <Text style={styles.finLabel}>TOTAL BILL</Text>
                  <Text style={styles.finValueTotal}>{money(totalBillAmount)}</Text>
                </View>

                {paidForThisBill > 0 ? (
                  <View style={styles.finColCenter}>
                    <Text style={styles.finLabelPaid}>PAID</Text>
                    <Text style={styles.finValuePaid}>{money(paidForThisBill)}</Text>
                  </View>
                ) : null}

                <View style={styles.finColRight}>
                  <Text style={styles.finLabelPending}>BALANCE DUE</Text>
                  <Text style={styles.finValuePending}>{money(pendingPaise)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Clean Payment Form Card */}
          <Card style={styles.formCard}>
            {localError || error ? (
              <View style={styles.errorBox}>
                <AppIcon name="alert-circle" size={15} color="#DC2626" />
                <Text style={styles.errorText}>{localError || error}</Text>
              </View>
            ) : null}

            {/* Amount Field (Clean, without preset chips) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Amount to Pay (₹) *</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  value={formAmount}
                  onChangeText={setFormAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={styles.amountInput}
                />
              </View>
            </View>

            {/* Payment Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Payment Date *</Text>
              <Pressable
                onPress={() => setIsCalendarOpen(true)}
                style={styles.dateSelectorBox}
              >
                <AppIcon name="calendar-outline" size={16} color="#2563EB" />
                <Text style={styles.dateSelectorText}>{formDate}</Text>
                <AppIcon name="chevron-down" size={14} color="#64748B" />
              </Pressable>
            </View>

            {/* Payment Mode Pills */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Payment Mode *</Text>
              <View style={styles.modeRow}>
                {PAYMENT_MODES.map((m) => {
                  const isActive = formMode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setFormMode(m.key)}
                      style={[styles.modePill, isActive && styles.modePillActive]}
                    >
                      <AppIcon
                        name={m.icon as any}
                        size={15}
                        color={isActive ? '#2563EB' : '#64748B'}
                      />
                      <Text
                        style={[styles.modePillText, isActive && styles.modePillTextActive]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Reference (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Reference / UTR / Cheque (Optional)</Text>
              <TextInput
                value={formRef}
                onChangeText={setFormRef}
                placeholder="e.g. UPI-987654 or Cheque #"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>

            {/* Notes (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Notes (Optional)</Text>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Add any remark or note..."
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>

            {/* Submit Action Button */}
            <Pressable
              onPress={handleSavePayment}
              disabled={busy}
              style={({ pressed }) => [
                styles.submitBtn,
                busy && { opacity: 0.6 },
                pressed && !busy && { opacity: 0.9 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <AppIcon name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Pay Bill</Text>
                </>
              )}
            </Pressable>
          </Card>
        </View>
      </ScrollView>

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={formDate}
        onSelect={(d: string) => {
          setFormDate(d);
          setIsCalendarOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  container: {
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
    gap: 10,
    paddingBottom: 36,
  },
  pickerCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  picker: {
    height: 40,
    width: '100%',
  },
  billHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
      default: { elevation: 1 },
    }),
  },
  billHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  billTitleText: {
    flex: 1,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMaterial: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  badgeMaterialText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  badgeExpense: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  badgeExpenseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  billMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  metaDot: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  specNotesText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    flex: 1,
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 12,
    marginBottom: 10,
  },
  billFinancialsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  finColLeft: {
    alignItems: 'flex-start',
  },
  finColCenter: {
    alignItems: 'center',
  },
  finColRight: {
    alignItems: 'flex-end',
  },
  finLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  finValueTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  finLabelPaid: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  finValuePaid: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  finLabelPending: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  finValuePending: {
    fontSize: 17,
    fontWeight: '900',
    color: '#D97706',
  },
  formCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 8,
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: 4,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 0,
  },
  dateSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  dateSelectorText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modePillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  modePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  modePillTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    height: 44,
    marginTop: 4,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
