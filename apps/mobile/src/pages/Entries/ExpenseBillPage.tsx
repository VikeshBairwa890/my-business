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
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { BillAttachmentPicker } from '../../components/bills/BillAttachmentPicker';
import { saveDocToIndexedDB, uploadDocToServer } from '../../storage/docStorage';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';
import { showToast } from '../../context/ToastContext';

export interface ExpenseBillPageProps {
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

const EXPENSE_CATEGORIES = [
  'Fuel & Diesel',
  'Tea & Refreshment',
  'Machine Rent',
  'Transport & Freight',
  'Tools & Hardware',
  'Repairs & Maintenance',
  'Food & Ration',
  'Electricity & Water',
  'Other Site Expense',
];

const PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash', icon: 'cash' },
  { key: 'UPI', label: 'UPI', icon: 'card' },
  { key: 'RECORD', label: 'Due / Credit', icon: 'document-text' },
  { key: 'BANK', label: 'Bank', icon: 'business' },
  { key: 'CHEQUE', label: 'Cheque', icon: 'receipt' },
];

export function ExpenseBillPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: ExpenseBillPageProps) {
  const { lang } = useLanguage();

  // Form State
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formParty, setFormParty] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('CASH');
  const [formRef, setFormRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formPhotoName, setFormPhotoName] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Image Viewer State
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === formSiteId),
    [data.sites, formSiteId]
  );

  // Recent expense entries
  const recentExpenses = useMemo(() => {
    return data.entries
      .filter((e) => !e.voided_at && e.kind === 'EXPENSE')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10);
  }, [data.entries]);

  const handleSaveExpense = async () => {
    setLocalError('');
    if (!formSiteId) {
      showToast('Please select a work site', 'e');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      showToast('Please enter a valid expense amount', 'e');
      return;
    }

    let finalDocId = '';
    if (formPhotoUrl) {
      const genId = 'doc_' + Date.now();
      try {
        await saveDocToIndexedDB(
          genId,
          formPhotoName || 'expense.jpg',
          formPhotoUrl,
          'image/jpeg'
        );
        uploadDocToServer(
          genId,
          formPhotoName || 'expense.jpg',
          formPhotoUrl,
          'image/jpeg'
        ).catch(() => { });
        finalDocId = genId;
      } catch (e) {
        // Continue if local storage fails
      }
    }

    const descParts = [formCategory];
    if (formDescription.trim()) descParts.push(formDescription.trim());
    if (formNotes.trim()) descParts.push(formNotes.trim());

    onSave({
      site_id: formSiteId,
      date: formDate,
      party: formParty.trim() || formCategory || 'Site Expense',
      description: descParts.join(' • '),
      amount: formAmount,
      mode: formMode,
      reference: formRef.trim() || finalDocId || '',
      due_date: '',
    });

    // Reset Form
    setFormParty('');
    setFormDescription('');
    setFormAmount('');
    setFormRef('');
    setFormNotes('');
    setFormPhotoUrl('');
    setFormPhotoName('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title="Site Expense Register"
        icon="receipt"
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
          {/* 2. DIRECT INLINE EXPENSE FORM CARD */}
          <Card style={styles.inlineFormCard}>
            <View style={styles.formCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formHeaderIcon}>
                  <AppIcon name="receipt" size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.formTitle}>Site Expense Entry</Text>
                  <Text style={styles.formSubtitle}>
                    Record fuel, transport, rentals & site expenses
                  </Text>
                </View>
              </View>
            </View>

            {localError || error ? (
              <View style={styles.formErrorBox}>
                <AppIcon name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.formErrorText}>{localError || error}</Text>
              </View>
            ) : null}

            {/* Form Body */}
            <View style={styles.formBody}>
              {/* Site Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Work Site *</Text>
                <View style={styles.siteBoxContainer}>
                  <AppIcon name="business" size={16} color="#0284C7" />
                  <Text style={styles.siteBoxText} numberOfLines={1}>
                    {selectedSite ? `🏢 ${selectedSite.name}` : 'Select Work Site'}
                  </Text>
                  <AppIcon name="chevron-down" size={14} color="#64748B" />
                  <Picker
                    mode="dropdown"
                    selectedValue={formSiteId}
                    onValueChange={(val) => setFormSiteId(String(val))}
                    style={styles.pickerOverlay}
                    dropdownIconColor="transparent"
                  >
                    {data.sites.map((s) => (
                      <Picker.Item
                        key={s.id}
                        label={`🏢 ${s.name}`}
                        value={s.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Category & Date Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Expense Category *</Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon name="apps" size={16} color="#7C3AED" />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {formCategory}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      mode="dropdown"
                      selectedValue={formCategory}
                      onValueChange={(val) => setFormCategory(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <Picker.Item key={cat} label={cat} value={cat} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Expense Date *</Text>
                  <Pressable
                    onPress={() => setIsCalendarOpen(true)}
                    style={styles.datePickerBtn}
                  >
                    <Text style={styles.datePickerBtnText}>{formDate}</Text>
                    <AppIcon name="calendar" size={16} color="#2563EB" />
                  </Pressable>
                </View>
              </View>

              {/* Paid To & Description Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Paid To / Vendor</Text>
                  <TextInput
                    value={formParty}
                    onChangeText={setFormParty}
                    placeholder="e.g. Fuel Station, Ramesh Driver"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Expense Details</Text>
                  <TextInput
                    value={formDescription}
                    onChangeText={setFormDescription}
                    placeholder="e.g. 20L Generator Diesel"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Amount & Payment Mode Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                {/* 1. Paid Amount Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Expense Amount (₹) *</Text>
                  <View style={styles.amountBoxContainer}>
                    <Text style={[styles.amountCurrencyPrefix, { color: '#7C3AED' }]}>₹</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="1800"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={[styles.amountInput, { color: '#7C3AED' }]}
                    />
                  </View>
                </View>

                {/* 2. Payment Mode Dropdown Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Payment Mode *</Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon
                      name={
                        formMode === 'CASH'
                          ? 'cash'
                          : formMode === 'UPI'
                            ? 'card'
                            : formMode === 'RECORD'
                              ? 'document-text'
                              : formMode === 'BANK'
                                ? 'business'
                                : 'receipt'
                      }
                      size={16}
                      color="#7C3AED"
                    />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {PAYMENT_MODES.find((m) => m.key === formMode)?.label || formMode}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      mode="dropdown"
                      selectedValue={formMode}
                      onValueChange={(val) => setFormMode(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <Picker.Item key={m.key} label={m.label} value={m.key} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Bill # / Voucher # & Notes Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Bill # / Voucher #</Text>
                  <TextInput
                    value={formRef}
                    onChangeText={setFormRef}
                    placeholder="e.g. BILL-8821"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>Notes / Remarks</Text>
                  <TextInput
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder="e.g. For foundation casting"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Bill / Receipt Photo Attachment */}
              <View style={styles.inputGroup}>
                <BillAttachmentPicker
                  photoUrl={formPhotoUrl}
                  photoName={formPhotoName}
                  onPhotoSelected={(url, name) => {
                    setFormPhotoUrl(url);
                    setFormPhotoName(name);
                  }}
                  onPhotoRemoved={() => {
                    setFormPhotoUrl('');
                    setFormPhotoName('');
                  }}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.formActionRow}>
                <Pressable
                  onPress={() => {
                    setFormParty('');
                    setFormDescription('');
                    setFormAmount('');
                    setFormRef('');
                    setFormNotes('');
                    setFormPhotoUrl('');
                    setFormPhotoName('');
                    setLocalError('');
                  }}
                  style={styles.formCancelBtn}
                >
                  <Text style={styles.formCancelBtnText}>Clear</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveExpense}
                  disabled={busy}
                  style={[styles.formSaveBtn, busy && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.formSaveBtnText}>Save Expense</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Card>

          {/* 3. RECENT EXPENSES LIST */}
          <Card style={styles.recentBillsCard}>
            <View style={styles.recentHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.recentHeaderIcon, { backgroundColor: '#F3E8FF' }]}>
                  <AppIcon name="receipt" size={16} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.recentTitle}>Recent Site Expenses</Text>
                  <Text style={styles.recentSubtitle}>Last 10 recorded expenses</Text>
                </View>
              </View>
              <View style={[styles.badgePill, { backgroundColor: '#F3E8FF' }]}>
                <Text style={[styles.badgePillText, { color: '#7C3AED' }]}>{recentExpenses.length} Records</Text>
              </View>
            </View>

            {recentExpenses.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <AppIcon name="receipt-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyStateTitle}>No expenses recorded yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Use the form above to add your first expense
                </Text>
              </View>
            ) : (
              <View style={styles.billsList}>
                {recentExpenses.map((exp) => {
                  const site = data.sites.find((s) => s.id === exp.site_id);
                  const isDue = exp.mode === 'RECORD';
                  const displayDesc = (exp.description || 'Site Expense').replace(/\s*\([\u0900-\u097F\/\s-]+\)/g, '');
                  const displayParty = (exp.party || 'Expense').replace(/\s*\([\u0900-\u097F\/\s-]+\)/g, '');

                  return (
                    <View key={exp.id} style={styles.billItemRow}>
                      <View style={styles.billItemLeft}>
                        <View style={[styles.billItemIcon, { backgroundColor: '#F3E8FF' }]}>
                          <AppIcon name="receipt" size={16} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.billItemDesc} numberOfLines={1}>
                            {displayDesc}
                          </Text>
                          <View style={styles.billItemMetaRow}>
                            <Text style={styles.billItemParty} numberOfLines={1}>
                              🏢 {site?.name || 'Site'} • {displayParty}
                            </Text>
                            <Text style={styles.billItemDate}>
                              • {String(exp.date).slice(0, 10)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.billItemRight}>
                        <Text style={styles.billItemAmount}>
                          {money(exp.amount)}
                        </Text>
                        <View
                          style={[
                            styles.billModeBadge,
                            isDue ? styles.billModeBadgeDue : styles.billModeBadgePaid,
                          ]}
                        >
                          <Text
                            style={[
                              styles.billModeBadgeText,
                              isDue ? styles.billModeTextDue : styles.billModeTextPaid,
                            ]}
                          >
                            {isDue ? 'Due' : (exp.mode || 'CASH')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      {isCalendarOpen && (
        <CalendarPickerModal
          visible={isCalendarOpen}
          title="Select Expense Date"
          selectedDate={formDate}
          onSelect={(d) => {
            if (d) setFormDate(d);
            setIsCalendarOpen(false);
          }}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <BillImageViewerModal
          visible={!!viewingImage}
          imageUrl={viewingImage.url}
          title={viewingImage.title}
          onClose={() => setViewingImage(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  root: { flex: 1 },
  scroll: { paddingBottom: 50 },
  container: { padding: 16, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },

  siteBoxContainer: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  siteBoxText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginHorizontal: 6,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    zIndex: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },

  inlineFormCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    gap: 14,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  formSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
  },
  formErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  formBody: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  textInput: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
    width: '100%',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  datePickerBtn: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    width: '100%',
  },
  datePickerBtnText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  amountBoxContainer: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    width: '100%',
  },
  amountCurrencyPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7C3AED',
  },
  amountInput: {
    flex: 1,
    height: 40,
    fontSize: 18,
    fontWeight: '800',
    color: '#7C3AED',
    padding: 0,
  },
  formActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  formCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  formCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  formSaveBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  formSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Recent Expenses Card
  recentBillsCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  recentHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyStateBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  emptyStateSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  billsList: {
    gap: 10,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  billItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  billItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billItemDesc: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  billItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  billItemParty: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  billItemDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  billItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  billItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  billModeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  billModeBadgeDue: {
    backgroundColor: '#FEF3C7',
  },
  billModeBadgePaid: {
    backgroundColor: '#DCFCE7',
  },
  billModeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  billModeTextDue: {
    color: '#B45309',
  },
  billModeTextPaid: {
    color: '#15803D',
  },
});
