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

export interface ExtraWorkPageProps {
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

const APPROVAL_PRESETS = [
  'WhatsApp message confirmation',
  'Client verbal approval on site',
  'Signed drawing / site slip',
  'Phone call confirmation',
  'Client Email / Letter',
];

const EXTRA_STATUS_OPTIONS = [
  { key: 'RECORD', label: 'Bill Due', icon: 'document-text' },
  { key: 'CASH', label: 'Cash', icon: 'cash' },
  { key: 'UPI', label: 'UPI', icon: 'card' },
  { key: 'BANK', label: 'Bank', icon: 'business' },
];

export function ExtraWorkPage({
  data,
  busy,
  error,
  onBack,
  onSave,
  onRefresh,
  refreshing = false,
  onOpenProfile,
  siteId: initialSiteId,
}: ExtraWorkPageProps) {
  const { lang } = useLanguage();

  // Form State
  const [formSiteId, setFormSiteId] = useState<string>(
    initialSiteId || (data.sites[0]?.id ? String(data.sites[0].id) : '')
  );
  const [formDate, setFormDate] = useState(today());
  const [formParty, setFormParty] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formReference, setFormReference] = useState(APPROVAL_PRESETS[0]);
  const [formMode, setFormMode] = useState('RECORD');
  const [formMeasurement, setFormMeasurement] = useState('');
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

  // Recent extra work entries
  const recentExtras = useMemo(() => {
    return data.entries
      .filter((e) => !e.voided_at && e.kind === 'EXTRA')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10);
  }, [data.entries]);

  const handleSaveExtra = async () => {
    setLocalError('');
    if (!formSiteId) {
      setLocalError(lang === 'hi' ? 'कृपया कार्य स्थल (Site) चुनें' : 'Please select a work site');
      return;
    }
    if (!formDescription.trim()) {
      setLocalError(
        lang === 'hi'
          ? 'कृपया अतिरिक्त काम का विवरण भरें'
          : 'Please enter extra work description'
      );
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setLocalError(
        lang === 'hi' ? 'कृपया सही अतिरिक्त राशि भरें' : 'Please enter a valid extra amount'
      );
      return;
    }

    let finalDocId = '';
    if (formPhotoUrl) {
      const genId = 'doc_' + Date.now();
      try {
        await saveDocToIndexedDB(
          genId,
          formPhotoName || 'extra_work.jpg',
          formPhotoUrl,
          'image/jpeg'
        );
        uploadDocToServer(
          genId,
          formPhotoName || 'extra_work.jpg',
          formPhotoUrl,
          'image/jpeg'
        ).catch(() => { });
        finalDocId = genId;
      } catch (e) {
        // Continue if local storage fails
      }
    }

    const descParts = [formDescription.trim()];
    if (formMeasurement.trim()) descParts.push(`Measurement: ${formMeasurement.trim()}`);
    if (formReference) descParts.push(`Approval: ${formReference}`);

    onSave({
      site_id: formSiteId,
      date: formDate,
      party: formParty.trim() || selectedSite?.owner_name || selectedSite?.name || 'Client',
      description: descParts.join(' • '),
      amount: formAmount,
      mode: formMode,
      reference: formReference.trim() || finalDocId || 'Client approval',
      due_date: '',
    });

    // Reset Form
    setFormParty('');
    setFormDescription('');
    setFormAmount('');
    setFormMeasurement('');
    setFormPhotoUrl('');
    setFormPhotoName('');
  };

  return (
    <View style={styles.pageWrapper}>
      {/* 1. TOP NAVIGATION BAR */}
      <TopNavBar
        title={lang === 'hi' ? 'एक्स्ट्रा काम (अतिरिक्त कार्य)' : 'Extra Work Register'}
        subtitle={
          lang === 'hi'
            ? 'ठेके के अलावा ग्राहक द्वारा कराया गया अतिरिक्त काम'
            : 'Contract scope additions, variations & extra client billing'
        }
        icon="add-circle"
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
          {/* 2. DIRECT INLINE EXTRA WORK FORM CARD */}
          <Card style={styles.inlineFormCard}>
            <View style={styles.formCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.formHeaderIcon}>
                  <AppIcon name="add-circle" size={20} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.formTitle}>
                    {lang === 'hi' ? 'एक्स्ट्रा काम प्रविष्टि' : 'Extra Work Entry'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {lang === 'hi'
                      ? 'अतिरिक्त काम, एक्स्ट्रा बिलिंग व अप्रूवल सीधे यहाँ दर्ज करें'
                      : 'Record extra work scope, client approval & billing'}
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

              {/* Client Name & Work Date Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'ग्राहक / अप्रूवर का नाम' : 'Client / Approver Name'}
                  </Text>
                  <TextInput
                    value={formParty}
                    onChangeText={setFormParty}
                    placeholder={selectedSite?.owner_name || 'Client Name'}
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'कार्य दिनांक *' : 'Work Date *'}
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

              {/* Extra Work Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {lang === 'hi' ? 'अतिरिक्त काम का पूरा विवरण *' : 'Extra Work Description *'}
                </Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder={
                    lang === 'hi'
                      ? 'जैसे: बाउंड्री वॉल 50ft अतिरिक्त निर्माण, बालकनी टाइल्स कार्य'
                      : 'e.g. Boundary wall 50ft extra construction, Balcony tile work'
                  }
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>

              {/* Approval Type & Bill Status Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'ग्राहक अप्रूवल माध्यम *' : 'Approval Confirmation *'}
                  </Text>
                  <View style={styles.siteBoxContainer}>
                    <AppIcon name="checkmark-circle" size={16} color="#0284C7" />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {formReference}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      mode="dropdown"
                      selectedValue={formReference}
                      onValueChange={(val) => setFormReference(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                    >
                      {APPROVAL_PRESETS.map((app) => (
                        <Picker.Item key={app} label={app} value={app} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'पेमेंट / बिल स्थिति *' : 'Billing Status *'}
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
                              : 'business'
                      }
                      size={16}
                      color="#0284C7"
                    />
                    <Text style={styles.siteBoxText} numberOfLines={1}>
                      {EXTRA_STATUS_OPTIONS.find((s) => s.key === formMode)?.label || formMode}
                    </Text>
                    <AppIcon name="chevron-down" size={14} color="#64748B" />
                    <Picker
                      mode="dropdown"
                      selectedValue={formMode}
                      onValueChange={(val) => setFormMode(String(val))}
                      style={styles.pickerOverlay}
                      dropdownIconColor="transparent"
                    >
                      {EXTRA_STATUS_OPTIONS.map((opt) => (
                        <Picker.Item key={opt.key} label={opt.label} value={opt.key} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Extra Amount & Measurement Row (50% / 50%) */}
              <View style={styles.twoColRow}>
                {/* 1. Extra Amount Card */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'अतिरिक्त काम की राशि (₹) *' : 'Extra Work Amount (₹) *'}
                  </Text>
                  <View style={styles.amountBoxContainer}>
                    <Text style={[styles.amountCurrencyPrefix, { color: '#0284C7' }]}>₹</Text>
                    <TextInput
                      value={formAmount}
                      onChangeText={setFormAmount}
                      placeholder="25000"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={[styles.amountInput, { color: '#0284C7' }]}
                    />
                  </View>
                </View>

                {/* 2. Measurement / Area Notes */}
                <View style={[styles.inputGroup, { flex: 1, minWidth: 0, width: '50%', maxWidth: '50%' }]}>
                  <Text style={styles.inputLabel}>
                    {lang === 'hi' ? 'नाप / क्षेत्रफल (Measurement)' : 'Measurement / Area'}
                  </Text>
                  <TextInput
                    value={formMeasurement}
                    onChangeText={setFormMeasurement}
                    placeholder={lang === 'hi' ? 'उदा: 150 Sq Ft @ ₹180' : 'e.g. 150 Sq Ft @ ₹180'}
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Site Photo / Drawing Attachment */}
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
                    setFormMeasurement('');
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
                  onPress={handleSaveExtra}
                  disabled={busy}
                  style={[styles.formSaveBtn, { backgroundColor: '#0284C7' }, busy && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.formSaveBtnText}>
                        {lang === 'hi' ? 'एक्स्ट्रा काम सेव करें' : 'Save Extra Work'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Card>

          {/* 3. RECENT EXTRA WORK LIST */}
          <Card style={styles.recentBillsCard}>
            <View style={styles.recentHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.recentHeaderIcon, { backgroundColor: '#E0F2FE' }]}>
                  <AppIcon name="add-circle" size={16} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.recentTitle}>
                    {lang === 'hi' ? 'हाल ही के एक्स्ट्रा काम' : 'Recent Extra Work Records'}
                  </Text>
                  <Text style={styles.recentSubtitle}>
                    {lang === 'hi'
                      ? 'अंतिम 10 अतिरिक्त कार्य प्रविष्टियाँ'
                      : 'Last 10 recorded extra work entries'}
                  </Text>
                </View>
              </View>
              <View style={[styles.badgePill, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.badgePillText, { color: '#0284C7' }]}>{recentExtras.length} Items</Text>
              </View>
            </View>

            {recentExtras.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <AppIcon name="add-circle-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyStateTitle}>
                  {lang === 'hi' ? 'कोई एक्स्ट्रा काम दर्ज नहीं है' : 'No extra work recorded yet'}
                </Text>
                <Text style={styles.emptyStateSubtitle}>
                  {lang === 'hi'
                    ? 'ऊपर दिए गए फ़ॉर्म से पहला एक्स्ट्रा काम दर्ज करें'
                    : 'Use the form above to add extra work'}
                </Text>
              </View>
            ) : (
              <View style={styles.billsList}>
                {recentExtras.map((item) => {
                  const site = data.sites.find((s) => s.id === item.site_id);
                  const isDue = item.mode === 'RECORD';

                  return (
                    <View key={item.id} style={styles.billItemRow}>
                      <View style={styles.billItemLeft}>
                        <View style={[styles.billItemIcon, { backgroundColor: '#E0F2FE' }]}>
                          <AppIcon name="add-circle" size={16} color="#0284C7" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.billItemDesc} numberOfLines={1}>
                            {item.description || 'Extra Work Scope'}
                          </Text>
                          <View style={styles.billItemMetaRow}>
                            <Text style={styles.billItemParty} numberOfLines={1}>
                              🏢 {site?.name || 'Site'} • {item.party || 'Client'}
                            </Text>
                            <Text style={styles.billItemDate}>
                              • {String(item.date).slice(0, 10)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.billItemRight}>
                        <Text style={styles.billItemAmount}>
                          {money(item.amount)}
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
                            {isDue ? 'Due' : (item.mode || 'CASH')}
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
          title={lang === 'hi' ? 'कार्य दिनांक चुनें' : 'Select Work Date'}
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
    borderColor: '#BAE6FD',
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
    backgroundColor: '#E0F2FE',
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
    color: '#0284C7',
  },
  amountInput: {
    flex: 1,
    height: 40,
    fontSize: 18,
    fontWeight: '800',
    color: '#0284C7',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Recent Extra Work Card
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
