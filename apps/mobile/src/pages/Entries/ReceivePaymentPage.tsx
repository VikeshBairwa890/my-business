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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';

export interface ReceivePaymentPageProps {
  data: Snapshot;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (values: Record<string, string>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenProfile?: () => void;
  siteId?: string;
}

const PAYMENT_MODES = [
  { key: 'ALL', label: 'All Modes' },
  { key: 'UPI', label: 'UPI / PhonePe / GPay' },
  { key: 'BANK', label: 'Bank Transfer (NEFT/RTGS)' },
  { key: 'CASH', label: 'Cash (Nokad)' },
  { key: 'CHEQUE', label: 'Cheque' },
];

export function ReceivePaymentPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: ReceivePaymentPageProps) {
  const { t, lang } = useLanguage();

  // Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || 'ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Add Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formParty, setFormParty] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('UPI');
  const [formRef, setFormRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isFormCalendarOpen, setIsFormCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  const activeEntries = useMemo(
    () => data.entries.filter((e) => !e.voided_at && e.kind === 'RECEIPT'),
    [data.entries]
  );

  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === formSiteId),
    [data.sites, formSiteId]
  );

  // Statistics
  const stats = useMemo(() => {
    let totalReceived = 0;
    let thisMonthReceived = 0;
    const nowMonth = today().slice(0, 7);
    const siteIds = new Set<string>();

    for (const e of activeEntries) {
      const amt = Number(e.amount || 0);
      totalReceived += amt;
      const entryMonth = String(e.date || '').slice(0, 7);
      if (entryMonth === nowMonth) {
        thisMonthReceived += amt;
      }
      if (e.site_id) siteIds.add(String(e.site_id));
    }

    return {
      totalReceived,
      thisMonthReceived,
      totalReceipts: activeEntries.length,
      sitesCount: siteIds.size,
    };
  }, [activeEntries]);

  // Filtered List
  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeEntries.filter((e) => {
      if (selectedSiteId !== 'ALL' && String(e.site_id) !== String(selectedSiteId)) {
        return false;
      }
      if (selectedDate && String(e.date).slice(0, 10) !== selectedDate) {
        return false;
      }
      if (selectedMode !== 'ALL') {
        const desc = String(e.description || '').toUpperCase();
        if (!desc.includes(selectedMode)) return false;
      }
      if (q) {
        const site = data.sites.find((s) => s.id === e.site_id);
        const matchSite = site ? site.name.toLowerCase().includes(q) : false;
        const matchParty = String(e.party || '').toLowerCase().includes(q);
        const matchDesc = String(e.description || '').toLowerCase().includes(q);
        if (!matchSite && !matchParty && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [activeEntries, selectedSiteId, selectedDate, selectedMode, search, data.sites]);

  const handleSavePayment = () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError('Please select a work site');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError('Please enter a valid amount');
      return;
    }

    const descParts = [`Mode: ${formMode}`];
    if (formRef.trim()) descParts.push(`Ref: ${formRef.trim()}`);
    if (formNotes.trim()) descParts.push(formNotes.trim());

    onSave({
      site_id: formSiteId,
      date: formDate,
      party: formParty.trim() || (selectedSite?.client_name || ''),
      amount: String(Math.round(Number(formAmount) * 100)),
      description: descParts.join(' • '),
    });

    // Reset Form
    setIsFormOpen(false);
    setFormParty('');
    setFormAmount('');
    setFormRef('');
    setFormNotes('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title={t('receivePayment', 'Payment In Register')}
        subtitle={t('receiveSubtitle', 'Client receipts, milestone payments & incoming cashflow')}
        icon="arrow-down-circle"
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
          {/* 2. STATS SUMMARY CARDS (Like AttendancePage) */}
          <View style={styles.statsSummaryGrid}>
            <View style={[styles.statKpiCard, styles.statKpiInflow]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <AppIcon name="arrow-down-circle" size={16} color="#15803D" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#166534' }]}>Total Received</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#15803D' }]}>
                {money(stats.totalReceived)}
              </Text>
              <Text style={styles.statKpiFoot}>All-time cash in</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiMonth]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="trending-up" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#1E40AF' }]}>This Month</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#1D4ED8' }]}>
                {money(stats.thisMonthReceived)}
              </Text>
              <Text style={styles.statKpiFoot}>Current month receipts</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiReceipts]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <AppIcon name="receipt" size={16} color="#D97706" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#92400E' }]}>Total Receipts</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#B45309' }]}>
                {stats.totalReceipts}
              </Text>
              <Text style={styles.statKpiFoot}>Recorded payments</Text>
            </View>

            <View style={[styles.statKpiCard, styles.statKpiSites]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#F3E8FF' }]}>
                  <AppIcon name="business" size={16} color="#7C3AED" />
                </View>
                <Text style={[styles.statKpiLabel, { color: '#6D28D9' }]}>Work Sites</Text>
              </View>
              <Text style={[styles.statKpiValue, { color: '#7C3AED' }]}>
                {stats.sitesCount}
              </Text>
              <Text style={styles.statKpiFoot}>Contributing sites</Text>
            </View>
          </View>

          {/* 3. PRIMARY ACTION & CREATION DRAWER */}
          <View style={styles.actionBox}>
            {!isFormOpen ? (
              <Pressable
                onPress={() => setIsFormOpen(true)}
                style={({ pressed }) => [
                  styles.primaryAddBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={styles.addBtnIconBox}>
                  <AppIcon name="add" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryAddBtnTitle}>+ Receive Client Payment</Text>
                  <Text style={styles.primaryAddBtnSub}>Record client milestone payment, cash in or advance</Text>
                </View>
                <AppIcon name="chevron-forward" size={18} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Card style={styles.inlineFormCard}>
                <View style={styles.formCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.formHeaderIcon}>
                      <AppIcon name="arrow-down-circle" size={18} color="#15803D" />
                    </View>
                    <View>
                      <Text style={styles.formTitle}>Receive Payment Entry</Text>
                      <Text style={styles.formSubtitle}>Record client cash in or milestone receipt</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setIsFormOpen(false)}
                    style={styles.formCloseBtn}
                  >
                    <AppIcon name="close" size={18} color="#64748B" />
                  </Pressable>
                </View>

                {localError || error ? (
                  <View style={styles.formErrorBox}>
                    <AppIcon name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.formErrorText}>{localError || error}</Text>
                  </View>
                ) : null}

                {/* Form Fields */}
                <View style={styles.formBody}>
                  {/* Site Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Work Site *</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={formSiteId}
                        onValueChange={(val) => setFormSiteId(String(val))}
                        style={styles.picker}
                      >
                        {data.sites.map((s) => (
                          <Picker.Item key={s.id} label={`🏢 ${s.name}`} value={s.id} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {/* Client & Date Row */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Client / Payer Name</Text>
                      <TextInput
                        value={formParty}
                        onChangeText={setFormParty}
                        placeholder={selectedSite?.client_name || 'Client Name'}
                        placeholderTextColor="#94A3B8"
                        style={styles.textInput}
                      />
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Receipt Date *</Text>
                      <Pressable
                        onPress={() => setIsFormCalendarOpen(true)}
                        style={styles.datePickerBtn}
                      >
                        <Text style={styles.datePickerBtnText}>{formDate}</Text>
                        <AppIcon name="calendar" size={16} color="#2563EB" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Amount with Big Typography */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Received Amount (₹) *</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="e.g. 50000"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={[styles.textInput, { fontSize: 20, fontWeight: '800', color: '#15803D' }]}
                    />
                  </View>

                  {/* Payment Mode Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Mode</Text>
                    <View style={styles.modeTabsRow}>
                      {[
                        { key: 'UPI', label: '📱 UPI' },
                        { key: 'BANK', label: '🏦 Bank' },
                        { key: 'CASH', label: '💵 Cash' },
                        { key: 'CHEQUE', label: '📜 Cheque' },
                      ].map((m) => (
                        <Pressable
                          key={m.key}
                          onPress={() => setFormMode(m.key)}
                          style={[
                            styles.modeTab,
                            formMode === m.key && styles.modeTabActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.modeTabText,
                              formMode === m.key && styles.modeTabTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Reference & Notes */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Reference / UTR / Cheque #</Text>
                      <TextInput
                        value={formRef}
                        onChangeText={setFormRef}
                        placeholder="e.g. UTR-982312"
                        placeholderTextColor="#94A3B8"
                        style={styles.textInput}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Notes / Milestone</Text>
                      <TextInput
                        value={formNotes}
                        onChangeText={setFormNotes}
                        placeholder="e.g. 2nd Slab Payment"
                        placeholderTextColor="#94A3B8"
                        style={styles.textInput}
                      />
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.formActionRow}>
                    <Pressable
                      onPress={() => setIsFormOpen(false)}
                      style={styles.formCancelBtn}
                    >
                      <Text style={styles.formCancelBtnText}>Cancel</Text>
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
                            {formAmount ? `Receive ${money(Number(formAmount) * 100)}` : 'Save Payment'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </Card>
            )}
          </View>

          {/* 4. SEARCH & FILTER TOOLBAR (Like AttendancePage) */}
          <View style={styles.toolbarBox}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <AppIcon name="search" size={16} color={Colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search client, site or reference..."
                placeholderTextColor={Colors.textSubtle}
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <AppIcon name="close-circle" size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Site & Date Filter Row */}
            <View style={styles.filterDropdownRow}>
              <View style={[styles.dropdownBox, { flex: 1 }]}>
                <AppIcon name="business" size={14} color="#0284C7" />
                <Picker
                  selectedValue={selectedSiteId}
                  onValueChange={(val) => setSelectedSiteId(String(val))}
                  style={styles.filterPicker}
                >
                  <Picker.Item label="🏢 All Work Sites" value="ALL" />
                  {data.sites.map((s) => (
                    <Picker.Item key={s.id} label={`🏢 ${s.name}`} value={s.id} />
                  ))}
                </Picker>
              </View>

              <Pressable
                onPress={() => setIsCalendarOpen(true)}
                style={[styles.dateFilterBtn, selectedDate && styles.dateFilterBtnActive]}
              >
                <AppIcon name="calendar" size={14} color={selectedDate ? '#2563EB' : '#64748B'} />
                <Text style={[styles.dateFilterText, selectedDate && { color: '#2563EB', fontWeight: '700' }]}>
                  {selectedDate ? selectedDate : 'All Dates'}
                </Text>
                {selectedDate ? (
                  <Pressable onPress={() => setSelectedDate(null)} hitSlop={6}>
                    <AppIcon name="close" size={12} color="#2563EB" />
                  </Pressable>
                ) : null}
              </Pressable>
            </View>

            {/* Payment Mode Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsScroll}
            >
              {PAYMENT_MODES.map((m) => {
                const isSelected = selectedMode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setSelectedMode(m.key)}
                    style={[
                      styles.modeChip,
                      isSelected && styles.modeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        isSelected && styles.modeChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. RECORDS LIST SECTION (Like AttendancePage) */}
          <View style={styles.recordsListSection}>
            <View style={styles.recordsHeaderRow}>
              <View>
                <Text style={styles.recordsHeaderTitle}>
                  Client Receipts ({filteredReceipts.length})
                </Text>
                <Text style={styles.recordsHeaderSub}>
                  Sorted by date • payments received ledger
                </Text>
              </View>
            </View>

            {filteredReceipts.length === 0 ? (
              <EmptyState
                icon="arrow-down-circle-outline"
                title="No Receipts Recorded"
                description={
                  search || selectedSiteId !== 'ALL'
                    ? 'No receipts found matching your filter criteria'
                    : 'Tap "+ Receive Client Payment" above to record your first receipt'
                }
              />
            ) : (
              filteredReceipts.map((entry) => {
                const site = data.sites.find((s) => s.id === entry.site_id);
                const entryDate = String(entry.date || '').slice(0, 10);

                return (
                  <Card key={entry.id} style={styles.receiptCard}>
                    <View style={styles.receiptCardTop}>
                      {/* Inflow Icon Badge */}
                      <View style={styles.inflowIconBadge}>
                        <AppIcon name="arrow-down-circle" size={20} color="#15803D" />
                      </View>

                      {/* Middle Details */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.receiptClientText} numberOfLines={1}>
                          {entry.party || site?.client_name || 'Client Payment'}
                        </Text>

                        <View style={styles.receiptMetaRow}>
                          <AppIcon name="business-outline" size={12} color="#0284C7" />
                          <Text style={styles.receiptSiteText} numberOfLines={1}>
                            {site?.name || 'Site'}
                          </Text>
                          <Text style={styles.metaDivider}>•</Text>
                          <Text style={styles.receiptDateText}>{entryDate}</Text>
                        </View>

                        {entry.description ? (
                          <Text style={styles.receiptDescText} numberOfLines={1}>
                            {entry.description}
                          </Text>
                        ) : null}
                      </View>

                      {/* Right Amount Badge */}
                      <View style={styles.receiptAmountBadge}>
                        <Text style={styles.receiptAmountText}>+ {money(entry.amount)}</Text>
                        <Text style={styles.receiptAmountSub}>Received</Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Date Filter Calendar Modal */}
      {isCalendarOpen && (
        <CalendarPickerModal
          visible={isCalendarOpen}
          title="Select Date"
          selectedDate={selectedDate || today()}
          onSelect={(d) => {
            if (d) setSelectedDate(d);
            setIsCalendarOpen(false);
          }}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}

      {/* Form Date Picker Modal */}
      {isFormCalendarOpen && (
        <CalendarPickerModal
          visible={isFormCalendarOpen}
          title="Select Receipt Date"
          selectedDate={formDate}
          onSelect={(d) => {
            if (d) setFormDate(d);
            setIsFormCalendarOpen(false);
          }}
          onClose={() => setIsFormCalendarOpen(false)}
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

  // Stats KPI Grid
  statsSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statKpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  statKpiInflow: { borderLeftWidth: 3, borderLeftColor: '#15803D' },
  statKpiMonth: { borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  statKpiReceipts: { borderLeftWidth: 3, borderLeftColor: '#D97706' },
  statKpiSites: { borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  statKpiTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIconBadge: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  statKpiLabel: { fontSize: 11, fontWeight: '700' },
  statKpiValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  statKpiFoot: { fontSize: 10, color: '#94A3B8' },

  // Primary Add Action
  actionBox: { width: '100%' },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F2851',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#0F2851',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAddBtnTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  primaryAddBtnSub: { fontSize: 11, color: '#CBD5E1', marginTop: 1 },

  // Inline Form
  inlineFormCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    gap: 14,
  },
  formCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formHeaderIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  formSubtitle: { fontSize: 11, color: '#64748B' },
  formCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  formErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8 },
  formErrorText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  formBody: { gap: 12 },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  pickerWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: { width: '100%', height: 42, color: '#0F172A' },
  twoColRow: { flexDirection: 'row', gap: 10 },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerBtnText: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  modeTabsRow: { flexDirection: 'row', gap: 6 },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modeTabActive: { backgroundColor: '#15803D' },
  modeTabText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  modeTabTextActive: { color: '#FFFFFF' },
  formActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  formCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  formCancelBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  formSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // Toolbar
  toolbarBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', padding: 0 },
  filterDropdownRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dropdownBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingLeft: 8, overflow: 'hidden' },
  filterPicker: { flex: 1, height: 38, color: '#0F172A' },
  dateFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 8 },
  dateFilterBtnActive: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  dateFilterText: { fontSize: 12, color: '#64748B' },
  filterChipsScroll: { gap: 6, paddingVertical: 2 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  modeChipActive: { backgroundColor: '#15803D' },
  modeChipText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  modeChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Records List Section
  recordsListSection: { gap: 10 },
  recordsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordsHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  recordsHeaderSub: { fontSize: 11, color: '#64748B' },
  receiptCard: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  receiptCardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  inflowIconBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center' },
  receiptClientText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  receiptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  receiptSiteText: { fontSize: 11, color: '#0284C7', fontWeight: '600' },
  metaDivider: { fontSize: 11, color: '#CBD5E1' },
  receiptDateText: { fontSize: 11, color: '#64748B' },
  receiptDescText: { fontSize: 11, color: '#64748B', marginTop: 3 },
  receiptAmountBadge: { alignItems: 'flex-end' },
  receiptAmountText: { fontSize: 16, fontWeight: '800', color: '#15803D' },
  receiptAmountSub: { fontSize: 10, color: '#16A34A', fontWeight: '600', marginTop: 1 },
});
