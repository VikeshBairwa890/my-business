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
import { money, workerSummary } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';

export interface WagePaymentPageProps {
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenProfile?: () => void;
  siteId?: string;
  workerId?: string;
}

const PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash', icon: 'cash' },
  { key: 'UPI', label: 'UPI', icon: 'card' },
  { key: 'BANK', label: 'Bank', icon: 'business' },
  { key: 'CHEQUE', label: 'Cheque', icon: 'receipt' },
];

export function WagePaymentPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
  workerId: initialWorkerId,
}: WagePaymentPageProps) {
  const { lang } = useLanguage();

  // Form State
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formWorkerId, setFormWorkerId] = useState<string>(
    initialWorkerId || (data.workers[0]?.id ? String(data.workers[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('CASH');
  const [formRef, setFormRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === formSiteId),
    [data.sites, formSiteId]
  );

  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === formWorkerId),
    [data.workers, formWorkerId]
  );

  // Worker Financial summary for badge
  const workerFinance = useMemo(() => {
    if (!selectedWorker) return null;
    return workerSummary(selectedWorker, data.attendance, data.entries);
  }, [data, selectedWorker]);

  // Recent wage entries
  const recentPayments = useMemo(() => {
    return data.entries
      .filter((e) => !e.voided_at && e.kind === 'WAGE_PAYMENT')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10);
  }, [data.entries]);

  const handleSavePayment = () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError(lang === 'hi' ? 'कृपया कार्य स्थल (Site) चुनें' : 'Please select a work site');
      return;
    }
    if (!formWorkerId) {
      setLocalError(lang === 'hi' ? 'कृपया मजदूर (Worker) चुनें' : 'Please select a worker');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError(
        lang === 'hi' ? 'कृपया सही भुगतान राशि भरें' : 'Please enter a valid payment amount'
      );
      return;
    }

    const descParts = [`Mode: ${formMode}`];
    if (formRef.trim()) descParts.push(`Ref: ${formRef.trim()}`);
    if (formNotes.trim()) descParts.push(formNotes.trim());

    onSave({
      site_id: formSiteId,
      worker_id: formWorkerId,
      date: formDate,
      party: selectedWorker?.name || 'Worker Wage',
      amount: formAmount,
      mode: formMode,
      reference: formRef.trim(),
      description: descParts.join(' • '),
    });

    // Reset Form
    setFormAmount('');
    setFormRef('');
    setFormNotes('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title={lang === 'hi' ? 'लेबर भुगतान (मजदूरी दी)' : 'Labour Wage Payment'}
        subtitle={
          lang === 'hi'
            ? 'मजदूरों को दी गई दैनिक हाजिरी व एडवांस मजदूरी'
            : 'Daily wage payouts, advance & balance settlements'
        }
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
          {/* 2. DIRECT INLINE WAGE PAYMENT FORM CARD */}
          <Card style={styles.inlineFormCard}>
            <View style={styles.formCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formHeaderIcon}>
                  <AppIcon name="cash" size={20} color="#16A34A" />
                </View>
                <View>
                  <Text style={styles.formTitle}>
                    {lang === 'hi' ? 'मजदूरी भुगतान प्रविष्टि' : 'Labour Wage Payment Entry'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {lang === 'hi'
                      ? 'मजदूर को दिया गया भुगतान या एडवांस सीधे यहाँ दर्ज करें'
                      : 'Record wage payment or advance directly'}
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
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'कार्य स्थल (Work Site) *' : 'Work Site *'}
                </Text>
                <View style={styles.siteBoxContainer}>
                  <AppIcon name="business" size={16} color="#0284C7" />
                  <Text style={styles.siteBoxText} numberOfLines={1}>
                    {selectedSite
                      ? `🏢 ${selectedSite.name}`
                      : (lang === 'hi' ? 'साइट चुनें' : 'Select Work Site')}
                  </Text>
                  <AppIcon name="chevron-down" size={14} color="#64748B" />
                  <Picker
                    selectedValue={formSiteId}
                    onValueChange={(val) => setFormSiteId(String(val))}
                    style={styles.pickerOverlay}
                    dropdownIconColor="transparent"
                    prompt={lang === 'hi' ? 'साइट चुनें' : 'Select Work Site'}
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

              {/* Worker & Date Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'मजदूर (Worker) *' : 'Worker / Labour *'}
                  </Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon name="person" size={16} color="#16A34A" />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {selectedWorker
                        ? `${selectedWorker.name} (${selectedWorker.skill || 'Labour'})`
                        : (lang === 'hi' ? 'मजदूर चुनें' : 'Select Worker')}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      selectedValue={formWorkerId}
                      onValueChange={(val) => setFormWorkerId(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                      prompt={lang === 'hi' ? 'मजदूर चुनें' : 'Select Worker'}
                    >
                      {data.workers.map((w) => (
                        <Picker.Item
                          key={w.id}
                          label={`${w.name} (${w.skill || 'Labour'})`}
                          value={w.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'भुगतान दिनांक *' : 'Payment Date *'}
                  </Text>
                  <Pressable
                    onPress={() => setIsCalendarOpen(true)}
                    style={styles.datePickerBtn}
                  >
                    <Text style={styles.datePickerBtnText}>{formDate}</Text>
                    <AppIcon name="calendar" size={16} color="#2563EB" />
                  </Pressable>
                </View>
              </View>

              {/* Amount & Payment Mode Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                {/* 1. Paid Amount Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'भुगतान राशि (₹) *' : 'Paid Amount (₹) *'}
                  </Text>
                  <View style={styles.amountBoxContainer}>
                    <Text style={styles.amountCurrencyPrefix}>₹</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="1500"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={styles.amountInput}
                    />
                  </View>
                </View>

                {/* 2. Payment Mode Dropdown Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'भुगतान मोड *' : 'Payment Mode *'}
                  </Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon
                      name={
                        formMode === 'CASH'
                          ? 'cash'
                          : formMode === 'UPI'
                            ? 'card'
                            : formMode === 'BANK'
                              ? 'business'
                              : 'receipt'
                      }
                      size={16}
                      color="#16A34A"
                    />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {PAYMENT_MODES.find((m) => m.key === formMode)?.label || formMode}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      selectedValue={formMode}
                      onValueChange={(val) => setFormMode(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                      prompt={lang === 'hi' ? 'भुगतान मोड चुनें' : 'Select Mode'}
                    >
                      {PAYMENT_MODES.map((m) => (
                        <Picker.Item key={m.key} label={m.label} value={m.key} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Reference & Notes Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'संदर्भ / UTR / रसीद #' : 'Reference / UTR / Receipt #'}
                  </Text>
                  <TextInput
                    value={formRef}
                    onChangeText={setFormRef}
                    placeholder="e.g. UPI-984321 / Cash voucher"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'टिप्पणी / विवरण' : 'Notes / Remarks'}
                  </Text>
                  <TextInput
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder={lang === 'hi' ? 'जैसे: शनिवार साप्ताहिक मजदूरी' : 'e.g. Weekly settlement'}
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.formActionRow}>
                <Pressable
                  onPress={() => {
                    setFormAmount('');
                    setFormRef('');
                    setFormNotes('');
                    setLocalError('');
                  }}
                  style={styles.formCancelBtn}
                >
                  <Text style={styles.formCancelBtnText}>
                    {lang === 'hi' ? 'साफ़ करें' : 'Clear'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSavePayment}
                  disabled={busy}
                  style={[styles.formSaveBtn, busy && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.formSaveBtnText}>
                        {formAmount
                          ? `${lang === 'hi' ? 'मजदूरी दें' : 'Pay'} ${money(Number(formAmount) * 100)}`
                          : (lang === 'hi' ? 'मजदूरी दर्ज करें' : 'Save Payment')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Card>

          {/* 3. RECENT WAGE PAYMENTS LIST */}
          <Card style={styles.recentBillsCard}>
            <View style={styles.recentHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.recentHeaderIcon}>
                  <AppIcon name="cash" size={16} color="#16A34A" />
                </View>
                <View>
                  <Text style={styles.recentTitle}>
                    {lang === 'hi' ? 'हाल ही के लेबर भुगतान' : 'Recent Wage Payments'}
                  </Text>
                  <Text style={styles.recentSubtitle}>
                    {lang === 'hi'
                      ? 'अंतिम 10 मजदूरी भुगतान प्रविष्टियाँ'
                      : 'Last 10 wage payouts'}
                  </Text>
                </View>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{recentPayments.length} Payouts</Text>
              </View>
            </View>

            {recentPayments.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <AppIcon name="cash-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyStateTitle}>
                  {lang === 'hi' ? 'कोई मजदूरी भुगतान दर्ज नहीं है' : 'No wage payments yet'}
                </Text>
                <Text style={styles.emptyStateSubtitle}>
                  {lang === 'hi'
                    ? 'ऊपर दिए गए फ़ॉर्म से पहला भुगतान दर्ज करें'
                    : 'Use the form above to record your first payment'}
                </Text>
              </View>
            ) : (
              <View style={styles.billsList}>
                {recentPayments.map((p) => {
                  const site = data.sites.find((s) => s.id === p.site_id);
                  const worker = data.workers.find((w) => w.id === p.worker_id);

                  return (
                    <View key={p.id} style={styles.billItemRow}>
                      <View style={styles.billItemLeft}>
                        <View style={styles.billItemIcon}>
                          <AppIcon name="person" size={16} color="#16A34A" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.billItemDesc} numberOfLines={1}>
                            {worker?.name || p.party || 'Worker'}
                          </Text>
                          <View style={styles.billItemMetaRow}>
                            <Text style={styles.billItemParty} numberOfLines={1}>
                              🏢 {site?.name || 'Site'} • {p.description || 'Wage'}
                            </Text>
                            <Text style={styles.billItemDate}>
                              • {String(p.date).slice(0, 10)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.billItemRight}>
                        <Text style={styles.billItemAmount}>
                          {money(p.amount)}
                        </Text>
                        <View style={styles.billModeBadgePaid}>
                          <Text style={styles.billModeTextPaid}>
                            {p.mode || 'CASH'}
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
          title={lang === 'hi' ? 'भुगतान दिनांक चुनें' : 'Select Payment Date'}
          selectedDate={formDate}
          onSelect={(d) => {
            if (d) setFormDate(d);
            setIsCalendarOpen(false);
          }}
          onClose={() => setIsCalendarOpen(false)}
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
    borderColor: '#BBF7D0',
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
    backgroundColor: '#DCFCE7',
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
  workerBalanceMini: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  balanceDue: {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  balanceAdv: {
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
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
    color: '#16A34A',
  },
  amountInput: {
    flex: 1,
    height: 40,
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
    padding: 0,
  },
  formActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  formCancelBtn: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  formSaveBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Recent List Card
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
    backgroundColor: '#DCFCE7',
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
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
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
    backgroundColor: '#DCFCE7',
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
  billModeBadgePaid: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  billModeTextPaid: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
});
