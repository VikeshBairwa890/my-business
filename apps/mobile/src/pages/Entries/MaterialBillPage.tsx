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
  Image,
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

export interface MaterialBillPageProps {
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

const MATERIAL_UNITS = [
  'Bags',
  'Tons',
  'Kg',
  'Pcs',
  'Sq.Ft',
  'Brass',
  'Truck',
  'Ltr',
  'Bundle',
  'Cft',
  'Job',
];

const BILL_MODE_OPTIONS = [
  { key: 'RECORD', label: 'Due / Credit', icon: 'document-text' },
  { key: 'CASH', label: 'Cash', icon: 'cash' },
  { key: 'UPI', label: 'UPI', icon: 'card' },
  { key: 'BANK', label: 'Bank', icon: 'business' },
  { key: 'CHEQUE', label: 'Cheque', icon: 'receipt' },
];

export function MaterialBillPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: MaterialBillPageProps) {
  const { lang } = useLanguage();

  // Form State
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formParty, setFormParty] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formUnit, setFormUnit] = useState('Bags');
  const [formRate, setFormRate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMode, setFormMode] = useState('RECORD');
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

  // Recent material entries for quick reference
  const recentBills = useMemo(() => {
    return data.entries
      .filter((e) => !e.voided_at && e.kind === 'MATERIAL')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10);
  }, [data.entries]);

  const handleCalculateAmount = (qtyStr: string, rateStr: string) => {
    const q = parseFloat(qtyStr);
    const r = parseFloat(rateStr);
    if (!isNaN(q) && !isNaN(r) && q > 0 && r > 0) {
      setFormAmount(String(Math.round(q * r)));
    }
  };

  const handleSaveBill = async () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError(lang === 'hi' ? 'कृपया कार्य स्थल (Site) चुनें' : 'Please select a work site');
      return;
    }
    if (!formDescription.trim()) {
      setLocalError(
        lang === 'hi'
          ? 'कृपया मटेरियल का नाम / विवरण भरें'
          : 'Please enter material item description'
      );
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError(
        lang === 'hi' ? 'कृपया सही बिल राशि भरें' : 'Please enter a valid bill amount'
      );
      return;
    }

    let finalDocId = '';
    if (formPhotoUrl) {
      const genId = 'doc_' + Date.now();
      try {
        await saveDocToIndexedDB(
          genId,
          formPhotoName || 'bill.jpg',
          formPhotoUrl,
          'image/jpeg'
        );
        uploadDocToServer(
          genId,
          formPhotoName || 'bill.jpg',
          formPhotoUrl,
          'image/jpeg'
        ).catch(() => { });
        finalDocId = genId;
      } catch (e) {
        // Continue if local storage fails
      }
    }

    // Build clear reference / description
    const descParts = [formDescription.trim()];
    if (formQty && formUnit) {
      descParts.push(`Qty: ${formQty} ${formUnit}`);
      if (formRate) descParts.push(`@ ₹${formRate}`);
    }
    if (formNotes.trim()) {
      descParts.push(formNotes.trim());
    }

    onSave({
      site_id: formSiteId,
      date: formDate,
      party: formParty.trim() || 'Material Supplier',
      description: descParts.join(' • '),
      quantity: formQty.trim() || '',
      unit: formUnit.trim() || 'job',
      amount: formAmount,
      mode: formMode,
      reference: formRef.trim() || finalDocId || '',
      due_date: '',
    });

    // Reset Form fields
    setFormParty('');
    setFormDescription('');
    setFormQty('');
    setFormRate('');
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
        title={lang === 'hi' ? 'मटेरियल रजिस्टर (सामान खरीद)' : 'Material Bill Register'}
        subtitle={
          lang === 'hi'
            ? 'सीमेंट, सरिया, टाइल्स, पेंट व सप्लायर खरीद का हिसाब'
            : 'Cement, steel, tiles, paint & material purchases'
        }
        icon="cube"
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
          {/* 2. DIRECT INLINE MATERIAL BILL FORM CARD (Matching ReceivePaymentPage) */}
          <Card style={styles.inlineFormCard}>
            <View style={styles.formCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formHeaderIcon}>
                  <AppIcon name="cube" size={20} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.formTitle}>
                    {lang === 'hi' ? 'मटेरियल बिल प्रविष्टि' : 'Material Bill Entry'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {lang === 'hi'
                      ? 'सामान खरीद या सप्लायर बिल सीधे यहाँ दर्ज करें'
                      : 'Record material purchase, vendor bill or receipt'}
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
              {/* Site Selector (No cut lines) */}
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

              {/* Supplier & Date Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'सप्लायर / दुकान का नाम' : 'Supplier / Vendor Name'}
                  </Text>
                  <TextInput
                    value={formParty}
                    onChangeText={setFormParty}
                    placeholder={lang === 'hi' ? 'जैसे: शर्मा सीमेंट, गुप्ता हार्डवेयर' : 'e.g. Sharma Hardware'}
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'बिल दिनांक *' : 'Bill Date *'}
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

              {/* Material Item Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'मटेरियल सामान का विवरण *' : 'Material Item Description *'}
                </Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder={
                    lang === 'hi'
                      ? 'जैसे: 50 बैग अल्ट्राटेक सीमेंट, 10mm सरिया, एशियन पेंट पुट्टी'
                      : 'e.g. 50 Bags Ultratech Cement, 10mm Steel TMT'
                  }
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>

              {/* Quantity, Unit & Rate Row */}
              <View style={styles.threeColRow}>
                {/* Qty */}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'मात्रा (Qty)' : 'Quantity'}
                  </Text>
                  <TextInput
                    value={formQty}
                    onChangeText={(v) => {
                      setFormQty(v);
                      handleCalculateAmount(v, formRate);
                    }}
                    placeholder="50"
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                {/* Unit */}
                <View style={[styles.inputGroup, { flex: 1.1 }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'इकाई (Unit)' : 'Unit'}
                  </Text>
                  <View style={styles.siteBoxContainer}>
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {formUnit || 'Bags'}
                    </Text>
                    <AppIcon name="chevron-down" size={12} color="#64748B" />
                    <Picker
                      mode="dropdown"
                      selectedValue={formUnit}
                      onValueChange={(val) => setFormUnit(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                    >
                      {MATERIAL_UNITS.map((u) => (
                        <Picker.Item key={u} label={u} value={u} />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Rate */}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'दर (Rate ₹)' : 'Rate (₹)'}
                  </Text>
                  <TextInput
                    value={formRate}
                    onChangeText={(v) => {
                      setFormRate(v);
                      handleCalculateAmount(formQty, v);
                    }}
                    placeholder="380"
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Amount & Mode Row (2 Cards Side by Side) */}
              <View style={styles.twoColRow}>
                {/* 1. Total Bill Amount Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'कुल बिल राशि (₹) *' : 'Total Bill Amount (₹) *'}
                  </Text>
                  <View style={styles.amountBoxContainer}>
                    <Text style={styles.amountCurrencyPrefix}>₹</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="19000"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={styles.amountInput}
                    />
                  </View>
                </View>

                {/* 2. Bill Mode Dropdown Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'पेमेंट / बिल मोड *' : 'Payment / Bill Mode *'}
                  </Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon
                      name={
                        formMode === 'RECORD'
                          ? 'document-text'
                          : formMode === 'CASH'
                            ? 'cash'
                            : formMode === 'UPI'
                              ? 'card'
                              : formMode === 'BANK'
                                ? 'business'
                                : 'receipt'
                      }
                      size={16}
                      color="#D97706"
                    />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {BILL_MODE_OPTIONS.find((b) => b.key === formMode)?.label || formMode}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      mode="dropdown"
                      selectedValue={formMode}
                      onValueChange={(val) => setFormMode(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                    >
                      {BILL_MODE_OPTIONS.map((m) => (
                        <Picker.Item key={m.key} label={m.label} value={m.key} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Bill / Invoice # & Notes Row */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'बिल / चालान संख्या' : 'Bill # / Challan #'}
                  </Text>
                  <TextInput
                    value={formRef}
                    onChangeText={setFormRef}
                    placeholder="e.g. INV-9042"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'टिप्पणी / संदर्भ' : 'Notes / Remarks'}
                  </Text>
                  <TextInput
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder={lang === 'hi' ? 'जैसे: पहली मंजिल स्लैब' : 'e.g. 1st Floor Slab'}
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Bill Photo Attachment (Camera + Gallery) */}
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

              {/* Action Buttons (Clear & Save) */}
              <View style={styles.formActionRow}>
                <Pressable
                  onPress={() => {
                    setFormParty('');
                    setFormDescription('');
                    setFormQty('');
                    setFormRate('');
                    setFormAmount('');
                    setFormRef('');
                    setFormNotes('');
                    setFormPhotoUrl('');
                    setFormPhotoName('');
                    setLocalError('');
                  }}
                  style={styles.formCancelBtn}
                >
                  <Text style={styles.formCancelBtnText}>
                    {lang === 'hi' ? 'साफ़ करें' : 'Clear'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveBill}
                  disabled={busy}
                  style={[styles.formSaveBtn, busy && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.formSaveBtnText}>
                        {lang === 'hi' ? 'बिल सेव करें' : 'Save Bill'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Card>

          {/* 3. RECENT MATERIAL BILLS LIST (Clean, compact ledger view) */}
          <Card style={styles.recentBillsCard}>
            <View style={styles.recentHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.recentHeaderIcon}>
                  <AppIcon name="receipt" size={16} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.recentTitle}>
                    {lang === 'hi' ? 'हाल ही के मटेरियल बिल' : 'Recent Material Bills'}
                  </Text>
                  <Text style={styles.recentSubtitle}>
                    {lang === 'hi'
                      ? 'अंतिम 10 सामान खरीद प्रविष्टियाँ'
                      : 'Last 10 recorded material purchases'}
                  </Text>
                </View>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{recentBills.length} Bills</Text>
              </View>
            </View>

            {recentBills.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <AppIcon name="cube-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyStateTitle}>
                  {lang === 'hi' ? 'कोई मटेरियल बिल दर्ज नहीं है' : 'No material bills yet'}
                </Text>
                <Text style={styles.emptyStateSubtitle}>
                  {lang === 'hi'
                    ? 'ऊपर दिए गए फ़ॉर्म से पहला बिल दर्ज करें'
                    : 'Use the form above to add your first bill'}
                </Text>
              </View>
            ) : (
              <View style={styles.billsList}>
                {recentBills.map((bill) => {
                  const site = data.sites.find((s) => s.id === bill.site_id);
                  const isDue = bill.mode === 'RECORD';

                  return (
                    <View key={bill.id} style={styles.billItemRow}>
                      <View style={styles.billItemLeft}>
                        <View style={styles.billItemIcon}>
                          <AppIcon name="cube" size={16} color="#D97706" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.billItemDesc} numberOfLines={1}>
                            {bill.description || 'Material Purchase'}
                          </Text>
                          <View style={styles.billItemMetaRow}>
                            <Text style={styles.billItemParty} numberOfLines={1}>
                              🏢 {site?.name || 'Site'} • {bill.party || 'Supplier'}
                            </Text>
                            <Text style={styles.billItemDate}>
                              • {String(bill.date).slice(0, 10)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.billItemRight}>
                        <Text style={styles.billItemAmount}>
                          {money(bill.amount)}
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
                            {isDue ? 'Due' : (bill.mode || 'PAID')}
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

      {/* Bill Date Picker Modal */}
      {isCalendarOpen && (
        <CalendarPickerModal
          visible={isCalendarOpen}
          title={lang === 'hi' ? 'बिल दिनांक चुनें' : 'Select Bill Date'}
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

  // Site Dropdown / Box with No Cut Lines
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

  // Inline Form Card (Styled like ReceivePaymentPage)
  inlineFormCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
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
    backgroundColor: '#FEF3C7',
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
  threeColRow: {
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
    color: '#D97706',
  },
  amountInput: {
    flex: 1,
    height: 40,
    fontSize: 18,
    fontWeight: '800',
    color: '#D97706',
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
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Recent Bills Card
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
    backgroundColor: '#FEF3C7',
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
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
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
    backgroundColor: '#FEF3C7',
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
