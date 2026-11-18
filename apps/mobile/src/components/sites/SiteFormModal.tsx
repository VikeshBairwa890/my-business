import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Switch,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { TopNavBar } from '../common/TopNavBar';
import { FormSpec } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { viewSiteDocument } from '../../report';
import { siteForm } from '../../forms';
import { saveDocToIndexedDB, uploadDocToServer } from '../../storage/docStorage';
import { useLanguage } from '../../i18n';
import { showToast } from '../../context/ToastContext';

export interface SiteDocument {
  id: string;
  name: string;
  category: 'AGREEMENT' | 'QUOTATION' | 'DRAWING' | 'PHOTO' | 'OTHER';
  date: string;
  size?: string;
  refNo?: string;
  terms?: string;
  dataUrl?: string;
}

export interface SiteMetadata {
  userNotes: string;
  documents: SiteDocument[];
  gstin?: string;
  state?: string;
  stateCode?: string;
  businessName?: string;
}

export interface SiteFormModalProps {
  spec?: FormSpec;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
  asPage?: boolean;
}

export const INDIAN_STATES: Array<{ code: string; name: string }> = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

const GST_STATE_MAP = INDIAN_STATES.reduce((acc, curr) => {
  acc[curr.code] = curr.name;
  return acc;
}, {} as Record<string, string>);

const COMMON_UNITS = [
  { label: 'Sq Ft', value: 'sq ft' },
  { label: 'Sq Mtr', value: 'sq mtr' },
  { label: 'Rft', value: 'rft' },
  { label: 'Brass', value: 'brass' },
  { label: 'Job', value: 'job' },
];

const SITE_STATUSES = [
  { id: 'ONGOING', label: 'Ongoing', labelHi: 'चालू', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'UPCOMING', label: 'Upcoming', labelHi: 'आगामी', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { id: 'PAUSED', label: 'Paused', labelHi: 'रुका हुआ', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'COMPLETED', label: 'Done', labelHi: 'पूरा', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
];

const META_MARKER = '--- SITE_METADATA_JSON ---';
const DOC_MARKER = '--- ATTACHED DOCUMENTS ---';

export function parseSiteNotesAndDocs(rawNotes: string = ''): SiteMetadata {
  if (!rawNotes) {
    return {
      userNotes: '',
      documents: [],
      gstin: '',
      state: '',
      stateCode: '',
      businessName: '',
    };
  }

  const metaIdx = rawNotes.indexOf(META_MARKER);
  if (metaIdx !== -1) {
    const userNotes = rawNotes.slice(0, metaIdx).trim();
    const jsonPart = rawNotes.slice(metaIdx + META_MARKER.length).trim();
    try {
      const parsed = JSON.parse(jsonPart);
      return {
        userNotes,
        documents: (parsed.documents || []) as SiteDocument[],
        gstin: parsed.gstin || '',
        state: parsed.state || '',
        stateCode: parsed.stateCode || '',
        businessName: parsed.businessName || '',
      };
    } catch {
      // Ignore parse error
    }
  }

  const docIdx = rawNotes.indexOf(DOC_MARKER);
  if (docIdx !== -1) {
    const userNotes = rawNotes.slice(0, docIdx).trim();
    const docPart = rawNotes.slice(docIdx + DOC_MARKER.length).trim();
    try {
      const parsed = JSON.parse(docPart);
      if (Array.isArray(parsed)) {
        return {
          userNotes,
          documents: parsed as SiteDocument[],
          gstin: '',
          state: '',
          stateCode: '',
          businessName: '',
        };
      }
    } catch {
      // Ignore parse error
    }
  }

  return {
    userNotes: rawNotes.trim(),
    documents: [],
    gstin: '',
    state: '',
    stateCode: '',
    businessName: '',
  };
}

export function serializeSiteNotesAndDocs(
  userNotes: string,
  documents: SiteDocument[],
  gstin?: string,
  state?: string,
  stateCode?: string,
  businessName?: string
): string {
  const cleanNotes = userNotes.trim();
  const metaObj: Record<string, any> = {};

  if (documents && documents.length) {
    metaObj.documents = documents.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      date: d.date,
      size: d.size || undefined,
      refNo: d.refNo || undefined,
      terms: d.terms || undefined,
    }));
  }

  if (gstin && gstin.trim()) metaObj.gstin = gstin.trim().toUpperCase();
  if (state && state.trim()) metaObj.state = state.trim();
  if (stateCode && stateCode.trim()) metaObj.stateCode = stateCode.trim();
  if (businessName && businessName.trim()) metaObj.businessName = businessName.trim();

  if (Object.keys(metaObj).length === 0) {
    return cleanNotes;
  }

  const jsonStr = JSON.stringify(metaObj);
  return cleanNotes
    ? `${cleanNotes}\n\n${META_MARKER}\n${jsonStr}`
    : `${META_MARKER}\n${jsonStr}`;
}

const formatDateShort = (isoDate: string) => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatIndianShort = (val: number) => {
  if (!val || isNaN(val) || val <= 0) return '';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export function SiteFormModal({
  spec,
  busy,
  error,
  onClose,
  onSave,
  asPage = false,
}: SiteFormModalProps) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';
  const activeSpec = spec || siteForm();
  const isEdit = activeSpec.action === 'site.update';
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const initialData = useMemo(
    () => parseSiteNotesAndDocs(activeSpec.initial.notes || ''),
    [activeSpec.initial.notes]
  );

  // Core Site & Client fields
  const [name, setName] = useState(activeSpec.initial.name || '');
  const [ownerName, setOwnerName] = useState(activeSpec.initial.owner_name || '');
  const [phone, setPhone] = useState(activeSpec.initial.phone || '');
  const [address, setAddress] = useState(activeSpec.initial.address || '');

  // Contract & Pricing fields
  const [workType, setWorkType] = useState<'LABOUR' | 'MATERIAL'>(
    (activeSpec.initial.work_type as any) || 'LABOUR'
  );
  const [pricing, setPricing] = useState<'FIXED' | 'UNIT' | 'DAILY'>(
    (activeSpec.initial.pricing as any) || 'FIXED'
  );
  const [contractAmount, setContractAmount] = useState(
    activeSpec.initial.contract_amount && Number(activeSpec.initial.contract_amount) > 0
      ? activeSpec.initial.contract_amount
      : ''
  );
  const [quantity, setQuantity] = useState(activeSpec.initial.quantity || '1');
  const [unit, setUnit] = useState(
    activeSpec.initial.unit || (pricing === 'DAILY' ? 'days' : 'sq ft')
  );
  const [unitRate, setUnitRate] = useState(
    activeSpec.initial.unit_rate && Number(activeSpec.initial.unit_rate) > 0
      ? activeSpec.initial.unit_rate
      : ''
  );

  // Timeline & Status
  const [status, setStatus] = useState(activeSpec.initial.status || 'ONGOING');
  const [startDate, setStartDate] = useState(
    activeSpec.initial.start_date ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [endDate, setEndDate] = useState(activeSpec.initial.end_date || '');
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);

  // Optional Advanced Details (collapsed by default on new site for clean UX)
  const hasInitialOptional = Boolean(
    initialData.userNotes ||
    initialData.documents.length > 0 ||
    (isEdit && Number(activeSpec.initial.remaining_estimate || 0) > 0)
  );
  const [showMoreDetails, setShowMoreDetails] = useState(hasInitialOptional);

  const [remainingEstimate, setRemainingEstimate] = useState(
    activeSpec.initial.remaining_estimate && Number(activeSpec.initial.remaining_estimate) > 0
      ? activeSpec.initial.remaining_estimate
      : ''
  );
  const [notes, setNotes] = useState(initialData.userNotes);

  // GST & State
  const [isGstRegistered, setIsGstRegistered] = useState(Boolean(initialData.gstin));
  const [gstin, setGstin] = useState(initialData.gstin || '');
  const [selectedState, setSelectedState] = useState(initialData.state || '');
  const [selectedStateCode, setSelectedStateCode] = useState(initialData.stateCode || '');
  const [businessName, setBusinessName] = useState(initialData.businessName || '');
  const [isStatePickerOpen, setIsStatePickerOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Documents
  const [documents, setDocuments] = useState<SiteDocument[]>(initialData.documents);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<
    'AGREEMENT' | 'QUOTATION' | 'DRAWING' | 'PHOTO' | 'OTHER'
  >('AGREEMENT');
  const [newDocRef, setNewDocRef] = useState('');
  const [newDocTerms, setNewDocTerms] = useState('');

  const [localError, setLocalError] = useState('');

  const handleGstinChange = (text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    setGstin(clean);
    if (clean.length >= 2) {
      const code = clean.slice(0, 2);
      const stateName = GST_STATE_MAP[code];
      if (stateName && !selectedStateCode) {
        setSelectedState(stateName);
        setSelectedStateCode(code);
      }
    }
  };

  const gstValidation = useMemo(() => {
    if (!isGstRegistered || !gstin.trim()) return null;
    const clean = gstin.trim().toUpperCase();
    const code = clean.slice(0, 2);
    const gstStateName = GST_STATE_MAP[code];

    let mismatchError = '';
    if (clean.length >= 2) {
      if (!gstStateName) {
        mismatchError = `Invalid GST state code "${code}".`;
      } else if (selectedStateCode && selectedStateCode !== code) {
        mismatchError = 'State code does not match GSTIN.';
      }
    }

    let formatError = '';
    if (clean.length > 0 && clean.length < 15) {
      formatError = `GSTIN must be 15 characters (${clean.length}/15).`;
    } else if (clean.length === 15) {
      const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!pattern.test(clean)) {
        formatError = 'Invalid GSTIN format (e.g. 08AAAAA0000A1Z5).';
      }
    }

    return {
      isValid: !mismatchError && !formatError && clean.length === 15,
      mismatchError,
      formatError,
      gstStateCode: code,
      gstStateName,
    };
  }, [isGstRegistered, gstin, selectedStateCode]);

  const effectiveContractAmount = useMemo(() => {
    if (pricing === 'FIXED') {
      return parseFloat(contractAmount) || 0;
    }
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(unitRate) || 0;
    return Math.round(q * r);
  }, [pricing, contractAmount, quantity, unitRate]);

  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return INDIAN_STATES;
    const q = stateSearch.toLowerCase();
    return INDIAN_STATES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.includes(q)
    );
  }, [stateSearch]);

  const handleAddDocument = () => {
    if (!newDocName.trim()) return;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const doc: SiteDocument = {
      id: `doc-${Date.now()}`,
      name: newDocName.trim(),
      category: newDocCategory,
      date: todayStr,
      refNo: newDocRef.trim() || undefined,
      terms: newDocTerms.trim() || undefined,
    };
    setDocuments((prev) => [...prev, doc]);
    setNewDocName('');
    setNewDocRef('');
    setNewDocTerms('');
    setIsDocModalOpen(false);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleViewDoc = async (doc: SiteDocument) => {
    try {
      await viewSiteDocument(doc, {
        name: name || 'Site Project',
        owner_name: ownerName || 'Client',
        phone,
        address,
        gstin: isGstRegistered ? gstin : '',
        state: isGstRegistered ? selectedState : '',
        stateCode: isGstRegistered ? selectedStateCode : '',
        businessName: isGstRegistered ? businessName : '',
        work_type: workType,
        pricing,
      });
    } catch {
      // Ignore view errors
    }
  };

  const triggerFilePicker = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,image/*,.doc,.docx';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (!file) return;
          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const sizeInMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
          const lower = file.name.toLowerCase();
          const cat: SiteDocument['category'] = lower.includes('agreement')
            ? 'AGREEMENT'
            : lower.includes('drawing')
              ? 'DRAWING'
              : lower.includes('quote')
                ? 'QUOTATION'
                : 'OTHER';

          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
            const docId = `doc-${Date.now()}`;
            const doc: SiteDocument = {
              id: docId,
              name: file.name,
              category: cat,
              date: todayStr,
              size: sizeInMb,
              dataUrl,
            };
            setDocuments((prev) => [...prev, doc]);
            if (dataUrl) {
              await saveDocToIndexedDB(docId, file.name, dataUrl, file.type);
              uploadDocToServer(docId, file.name, dataUrl, file.type).catch(() => { });
            }
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      } catch {
        // Fallback to manual sheet
      }
    }
    setIsDocModalOpen(true);
  };

  const handleSave = () => {
    setLocalError('');

    if (!name.trim()) {
      showToast(
        isHi ? 'कृपया साइट / प्रोजेक्ट का नाम लिखें' : 'Please enter site / project name',
        'e'
      );
      return;
    }
    if (!ownerName.trim()) {
      showToast(
        isHi ? 'कृपया क्लाइंट / मालिक का नाम लिखें' : 'Please enter client / owner name',
        'e'
      );
      return;
    }
    if (!startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      showToast(
        isHi ? 'कृपया सही शुरू की तारीख चुनें' : 'Please select a valid start date',
        'e'
      );
      return;
    }
    if (endDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      showToast('End date must be in YYYY-MM-DD format', 'e');
      return;
    }
    if (endDate.trim() && endDate.trim() < startDate.trim()) {
      showToast(
        isHi
          ? 'समाप्ति तारीख शुरू की तारीख से पहले नहीं हो सकती'
          : 'End date cannot be before start date',
        'e'
      );
      return;
    }

    if (pricing === 'FIXED') {
      if (!contractAmount.trim() || isNaN(parseFloat(contractAmount)) || parseFloat(contractAmount) < 0) {
        showToast(
          isHi ? 'कृपया कुल ठेका राशि (₹) दर्ज करें' : 'Please enter contract amount',
          'e'
        );
        return;
      }
    } else {
      if (!unitRate.trim() || isNaN(parseFloat(unitRate)) || parseFloat(unitRate) <= 0) {
        showToast(isHi ? 'कृपया सही रेट (₹) दर्ज करें' : 'Please enter a valid rate', 'e');
        return;
      }
      if (!quantity.trim() || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
        showToast(
          isHi ? 'कृपया मात्रा या दिन दर्ज करें' : 'Please enter quantity or working days',
          'e'
        );
        return;
      }
    }

    if (isGstRegistered) {
      if (!gstin.trim()) {
        showToast(
          isHi ? 'कृपया GSTIN नंबर दर्ज करें' : 'Please enter client GSTIN or turn off GST',
          'e'
        );
        return;
      }
      if (gstValidation?.mismatchError) {
        showToast(gstValidation.mismatchError, 'e');
        return;
      }
      if (gstValidation?.formatError) {
        showToast(gstValidation.formatError, 'e');
        return;
      }
    }

    const finalNotes = serializeSiteNotesAndDocs(
      notes,
      documents,
      isGstRegistered ? gstin : '',
      isGstRegistered ? selectedState : '',
      isGstRegistered ? selectedStateCode : '',
      isGstRegistered ? businessName : ''
    );

    const payload: Record<string, string> = {
      name: name.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      work_type: workType,
      pricing,
      contract_amount:
        pricing === 'FIXED' ? contractAmount.trim() : String(effectiveContractAmount),
      quantity: quantity.trim() || '1',
      unit: unit.trim() || (pricing === 'DAILY' ? 'days' : 'job'),
      unit_rate: pricing === 'FIXED' ? '0' : unitRate.trim(),
      remaining_estimate: remainingEstimate.trim() || '0',
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      status,
      notes: finalNotes,
    };

    onSave(payload);
  };

  const displayError = localError || error;

  const optionalCount =
    (remainingEstimate ? 1 : 0) +
    (notes.trim() ? 1 : 0) +
    documents.length;

  const content = (
    <View style={styles.sheetContainer}>
      {/* 1. STANDARD PAGE TOP NAVBAR */}
      <TopNavBar
        title={
          isEdit
            ? isHi
              ? 'साइट एडिट करें'
              : 'Edit Work Site'
            : isHi
              ? 'नई साइट जोड़ें'
              : 'New Work Site'
        }
        onBack={() => !busy && onClose()}
      />

      {/* Error Banner */}
      {displayError ? (
        <View style={styles.errorBanner}>
          <AppIcon name="alert-circle" size={15} color={Colors.danger} />
          <Text style={styles.errorBannerText}>{displayError}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* CARD 1: SITE & CLIENT DETAILS */}
        <View style={styles.formCard}>
          {/* Site Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isHi ? 'साइट / प्रोजेक्ट का नाम' : 'Site / Project Name'}{' '}
              <Text style={styles.req}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <AppIcon name="business-outline" size={16} color="#94A3B8" />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={isHi ? 'उदा. शर्मा विला · पेंटिंग' : 'e.g. Sharma Villa · Painting'}
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Owner / Client Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isHi ? 'क्लाइंट / मालिक का नाम' : 'Client / Owner Name'}{' '}
              <Text style={styles.req}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <AppIcon name="person-outline" size={16} color="#94A3B8" />
              <TextInput
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder={isHi ? 'उदा. राजेश शर्मा' : 'e.g. Rajesh Sharma'}
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Client Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isHi ? 'मोबाइल नंबर' : 'Client Mobile'}{' '}
              <Text style={styles.optionalTag}>({isHi ? 'वैकल्पिक' : 'Optional'})</Text>
            </Text>
            <View style={styles.inputBox}>
              <Text style={styles.prefixText}>+91</Text>
              <View style={styles.prefixDivider} />
              <TextInput
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {isHi ? 'पता / लोकेशन' : 'Site Location'}{' '}
              <Text style={styles.optionalTag}>({isHi ? 'वैकल्पिक' : 'Optional'})</Text>
            </Text>
            <View style={styles.inputBox}>
              <AppIcon name="location-outline" size={16} color="#94A3B8" />
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder={isHi ? 'उदा. मालवीय नगर, जयपुर' : 'e.g. Malviya Nagar, Jaipur'}
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* GST Registered Toggle & GSTIN (Visible upfront inside Client Details) */}
          <View style={styles.gstBox}>
            <View style={styles.gstSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gstTitle}>
                  {isHi ? 'क्लाइंट GST रजिस्टर्ड है' : 'Client is GST Registered'}
                </Text>
              </View>
              <Switch
                value={isGstRegistered}
                onValueChange={setIsGstRegistered}
                trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {isGstRegistered ? (
              <View style={styles.gstFields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    GSTIN Number <Text style={styles.req}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      Boolean(gstValidation?.mismatchError || gstValidation?.formatError) &&
                      styles.inputBoxError,
                      Boolean(gstValidation?.isValid) && styles.inputBoxValid,
                    ]}
                  >
                    <TextInput
                      value={gstin}
                      onChangeText={handleGstinChange}
                      placeholder="08AAAAA0000A1Z5"
                      placeholderTextColor="#94A3B8"
                      style={[styles.textInput, { fontWeight: '700', letterSpacing: 0.4 }]}
                      autoCapitalize="characters"
                      maxLength={15}
                    />
                    {Boolean(gstValidation?.isValid) ? (
                      <AppIcon name="checkmark-circle" size={17} color="#16A34A" />
                    ) : null}
                  </View>
                  {gstValidation?.mismatchError || gstValidation?.formatError ? (
                    <Text style={styles.inlineErr}>
                      {gstValidation.mismatchError || gstValidation.formatError}
                    </Text>
                  ) : null}
                </View>

                {/* State Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>State / UT</Text>
                  <Pressable
                    onPress={() => {
                      setIsStatePickerOpen((prev) => !prev);
                      setStateSearch('');
                    }}
                    style={styles.inputBox}
                  >
                    <Text
                      style={[styles.textInput, !selectedState && { color: '#94A3B8' }]}
                      numberOfLines={1}
                    >
                      {selectedState
                        ? `${selectedState} (${selectedStateCode})`
                        : 'Select State'}
                    </Text>
                    <AppIcon
                      name={isStatePickerOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#64748B"
                    />
                  </Pressable>

                  {isStatePickerOpen ? (
                    <View style={styles.dropdownPanel}>
                      <View style={styles.dropdownSearch}>
                        <AppIcon name="search" size={14} color="#94A3B8" />
                        <TextInput
                          value={stateSearch}
                          onChangeText={setStateSearch}
                          placeholder="Search state..."
                          placeholderTextColor="#94A3B8"
                          style={styles.dropdownSearchInput}
                        />
                      </View>
                      <ScrollView
                        style={{ maxHeight: 160 }}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                      >
                        {filteredStates.map((s) => {
                          const sel = selectedStateCode === s.code;
                          return (
                            <Pressable
                              key={s.code}
                              onPress={() => {
                                setSelectedState(s.name);
                                setSelectedStateCode(s.code);
                                setIsStatePickerOpen(false);
                                setStateSearch('');
                              }}
                              style={[styles.dropdownItem, sel && styles.dropdownItemActive]}
                            >
                              <Text style={styles.stateCode}>{s.code}</Text>
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  sel && styles.dropdownItemTextActive,
                                ]}
                              >
                                {s.name}
                              </Text>
                              {sel ? <AppIcon name="checkmark" size={14} color="#2563EB" /> : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                {/* Legal Firm Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Firm / Legal Name (Optional)</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      value={businessName}
                      onChangeText={setBusinessName}
                      placeholder="e.g. Rajesh Infra Pvt Ltd"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* CARD 2: CONTRACT & PRICING */}
        <View style={styles.formCard}>
          {/* Work Type Segmented */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{isHi ? 'ठेके का प्रकार' : 'Contract Type'}</Text>
            <View style={styles.segmentedTrack}>
              {[
                { id: 'LABOUR', label: isHi ? 'सिर्फ लेबर' : 'Labour Only' },
                { id: 'MATERIAL', label: isHi ? 'लेबर + मटेरियल' : 'Labour + Material' },
              ].map((opt) => {
                const selected = workType === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setWorkType(opt.id as 'LABOUR' | 'MATERIAL')}
                    style={[styles.segmentedBtn, selected && styles.segmentedBtnActive]}
                  >
                    <Text style={[styles.segmentedText, selected && styles.segmentedTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Pricing Basis Segmented */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{isHi ? 'रेट का आधार' : 'Pricing Basis'}</Text>
            <View style={styles.segmentedTrack}>
              {[
                { id: 'FIXED', label: isHi ? 'फिक्स्ड' : 'Fixed' },
                { id: 'UNIT', label: isHi ? 'यूनिट रेट' : 'Unit Rate' },
                { id: 'DAILY', label: isHi ? 'दैनिक' : 'Daily' },
              ].map((opt) => {
                const selected = pricing === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setPricing(opt.id as 'FIXED' | 'UNIT' | 'DAILY');
                      if (opt.id === 'DAILY') setUnit('days');
                      else if (opt.id === 'UNIT' && unit === 'days') setUnit('sq ft');
                    }}
                    style={[styles.segmentedBtn, selected && styles.segmentedBtnActive]}
                  >
                    <Text style={[styles.segmentedText, selected && styles.segmentedTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Dynamic Amount Inputs */}
          {pricing === 'FIXED' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {isHi ? 'कुल ठेका राशि' : 'Contract Amount'} <Text style={styles.req}>*</Text>
              </Text>
              <View style={styles.inputBox}>
                <Text style={styles.rupeeSign}>₹</Text>
                <TextInput
                  value={contractAmount}
                  onChangeText={(t) => setContractAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder="150000"
                  placeholderTextColor="#94A3B8"
                  style={[styles.textInput, styles.amountInput]}
                  keyboardType="decimal-pad"
                />
                {parseFloat(contractAmount) > 0 ? (
                  <Text style={styles.amountPreviewBadge}>
                    {formatIndianShort(parseFloat(contractAmount))}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.fieldGroup}>
              <View style={styles.twoColRow}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.fieldLabel}>
                    {pricing === 'UNIT'
                      ? isHi
                        ? 'रेट / यूनिट'
                        : 'Rate / Unit'
                      : isHi
                        ? 'दैनिक रेट'
                        : 'Daily Rate'}{' '}
                    <Text style={styles.req}>*</Text>
                  </Text>
                  <View style={styles.inputBox}>
                    <Text style={styles.rupeeSign}>₹</Text>
                    <TextInput
                      value={unitRate}
                      onChangeText={(t) => setUnitRate(t.replace(/[^0-9.]/g, ''))}
                      placeholder={pricing === 'UNIT' ? '150' : '800'}
                      placeholderTextColor="#94A3B8"
                      style={[styles.textInput, styles.amountInput]}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.fieldLabel}>
                    {pricing === 'UNIT'
                      ? isHi
                        ? 'कुल मात्रा'
                        : 'Quantity'
                      : isHi
                        ? 'अनुमानित दिन'
                        : 'Est. Days'}{' '}
                    <Text style={styles.req}>*</Text>
                  </Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      value={quantity}
                      onChangeText={(t) => setQuantity(t.replace(/[^0-9.]/g, ''))}
                      placeholder={pricing === 'UNIT' ? '1200' : '30'}
                      placeholderTextColor="#94A3B8"
                      style={[styles.textInput, styles.amountInput]}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              {pricing === 'UNIT' ? (
                <View style={styles.unitChipsRow}>
                  {COMMON_UNITS.map((u) => {
                    const active = unit === u.value;
                    return (
                      <Pressable
                        key={u.value}
                        onPress={() => setUnit(u.value)}
                        style={[styles.unitChip, active && styles.unitChipActive]}
                      >
                        <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                          {u.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.calcStrip}>
                <Text style={styles.calcFormula}>
                  {quantity || '0'} {pricing === 'DAILY' ? 'days' : unit} × ₹{unitRate || '0'}
                </Text>
                <Text style={styles.calcResult}>
                  ₹{effectiveContractAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* CARD 3: TIMELINE & STATUS */}
        <View style={styles.formCard}>
          {/* Status Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{isHi ? 'साइट की स्थिति' : 'Site Status'}</Text>
            <View style={styles.statusRow}>
              {SITE_STATUSES.map((s) => {
                const selected = status === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setStatus(s.id)}
                    style={[
                      styles.statusChip,
                      selected && { backgroundColor: s.bg, borderColor: s.border },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                    <Text
                      style={[
                        styles.statusChipText,
                        selected && { color: s.color, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {isHi ? s.labelHi : s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Compact Side-by-Side Dates */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.fieldLabel}>
                {isHi ? 'शुरू की तारीख' : 'Start Date'} <Text style={styles.req}>*</Text>
              </Text>
              <Pressable
                onPress={() => setIsStartCalendarOpen(true)}
                style={({ pressed }) => [styles.dateBtn, pressed && { opacity: 0.8 }]}
              >
                <AppIcon name="calendar-outline" size={15} color="#2563EB" />
                <Text style={styles.dateBtnText} numberOfLines={1}>
                  {formatDateShort(startDate) || 'Select'}
                </Text>
              </Pressable>
            </View>

            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.fieldLabel}>
                {isHi ? 'लक्ष्य तारीख' : 'Target End'}{' '}
                <Text style={styles.optionalTag}>({isHi ? 'वैक.' : 'Opt.'})</Text>
              </Text>
              <Pressable
                onPress={() => setIsEndCalendarOpen(true)}
                style={({ pressed }) => [styles.dateBtn, pressed && { opacity: 0.8 }]}
              >
                <AppIcon
                  name="calendar-outline"
                  size={15}
                  color={endDate ? '#16A34A' : '#94A3B8'}
                />
                <Text
                  style={[styles.dateBtnText, !endDate && styles.dateBtnPlaceholder]}
                  numberOfLines={1}
                >
                  {endDate ? formatDateShort(endDate) : 'Optional'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* CARD 4: COLLAPSIBLE MORE DETAILS (ESTIMATE, NOTES, DOCS) */}
        <View style={styles.accordionCard}>
          <Pressable
            onPress={() => setShowMoreDetails((prev) => !prev)}
            style={({ pressed }) => [styles.accordionHeader, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.accordionLeft}>
              <AppIcon name="options-outline" size={16} color="#475569" />
              <Text style={styles.accordionTitle}>
                {isHi ? 'अतिरिक्त जानकारी (बजट, नोट्स, डॉक्यूमेंट्स)' : 'More Details (Budget, Notes & Docs)'}
              </Text>
              {optionalCount > 0 ? (
                <View style={styles.accordionBadge}>
                  <Text style={styles.accordionBadgeText}>{optionalCount}</Text>
                </View>
              ) : null}
            </View>
            <AppIcon
              name={showMoreDetails ? 'chevron-up' : 'chevron-down'}
              size={17}
              color="#64748B"
            />
          </Pressable>

          {showMoreDetails ? (
            <View style={styles.accordionBody}>
              {/* Remaining Estimate */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {isHi ? 'अनुमानित खर्च (₹)' : 'Estimated Cost / Budget'}
                </Text>
                <View style={styles.inputBox}>
                  <Text style={styles.rupeeSign}>₹</Text>
                  <TextInput
                    value={remainingEstimate}
                    onChangeText={(t) => setRemainingEstimate(t.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 90000"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {isHi ? 'ठेके की शर्तें / नोट्स' : 'Contract Notes / Terms'}
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={isHi ? 'अतिरिक्त जानकारी लिखें...' : 'Payment terms, scope or remarks...'}
                  placeholderTextColor="#94A3B8"
                  style={styles.notesInput}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Documents */}
              <View style={styles.fieldGroup}>
                <View style={styles.docHeaderRow}>
                  <Text style={styles.fieldLabel}>
                    {isHi ? 'डॉक्यूमेंट्स / एग्रीमेंट' : 'Documents & Agreements'}
                  </Text>
                  <Pressable
                    onPress={triggerFilePicker}
                    style={({ pressed }) => [styles.uploadMiniBtn, pressed && { opacity: 0.75 }]}
                  >
                    <AppIcon name="cloud-upload-outline" size={14} color="#2563EB" />
                    <Text style={styles.uploadMiniBtnText}>
                      {isHi ? 'अपलोड' : 'Attach'}
                    </Text>
                  </Pressable>
                </View>

                {documents.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    {documents.map((doc) => (
                      <View key={doc.id} style={styles.docRow}>
                        <AppIcon name="document-text-outline" size={16} color="#2563EB" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.docName} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <Text style={styles.docMeta}>
                            {doc.category} • {doc.date}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleViewDoc(doc)} hitSlop={8}>
                          <AppIcon name="eye-outline" size={16} color="#2563EB" />
                        </Pressable>
                        <Pressable onPress={() => handleRemoveDocument(doc.id)} hitSlop={8}>
                          <AppIcon name="trash-outline" size={15} color={Colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* STICKY BOTTOM FOOTER */}
      <View style={styles.footerBar}>
        <View style={[styles.footerInner, isDesktop && styles.footerInnerDesktop]}>
          <Pressable
            onPress={() => !busy && onClose()}
            disabled={busy}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.cancelBtnText}>{isHi ? 'रद्द करें' : 'Cancel'}</Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={busy}
            style={({ pressed }) => [
              styles.saveBtn,
              busy && { opacity: 0.65 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEdit
                  ? isHi
                    ? 'बदलाव सेव करें'
                    : 'Save Changes'
                  : isHi
                    ? 'साइट सेव करें'
                    : 'Save Site'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* START DATE CALENDAR PICKER */}
      <CalendarPickerModal
        visible={isStartCalendarOpen}
        title={isHi ? 'शुरू की तारीख चुनें' : 'Select Start Date'}
        selectedDate={startDate}
        onSelect={(newDate) => {
          if (newDate) setStartDate(newDate);
        }}
        onClose={() => setIsStartCalendarOpen(false)}
      />

      {/* END DATE CALENDAR PICKER */}
      <CalendarPickerModal
        visible={isEndCalendarOpen}
        title={isHi ? 'लक्ष्य समाप्ति तारीख' : 'Target Completion Date'}
        selectedDate={endDate}
        minDate={startDate}
        allowClear
        onSelect={(newDate) => setEndDate(newDate)}
        onClose={() => setIsEndCalendarOpen(false)}
      />

      {/* INLINE ATTACH DOCUMENT PANEL (Mobile fallback - no Modal!) */}
      {isDocModalOpen ? (
        <View style={styles.docInlineOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsDocModalOpen(false)}
          />
          <View style={styles.docModalSheet}>
            <View style={styles.docModalHeader}>
              <Text style={styles.docModalTitle}>Attach Document</Text>
              <Pressable onPress={() => setIsDocModalOpen(false)} hitSlop={8}>
                <AppIcon name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.unitChipsRow}>
              {(['AGREEMENT', 'QUOTATION', 'DRAWING', 'PHOTO', 'OTHER'] as const).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setNewDocCategory(cat)}
                  style={[styles.unitChip, newDocCategory === cat && styles.unitChipActive]}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      newDocCategory === cat && styles.unitChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Document Name *</Text>
              <View style={styles.inputBox}>
                <TextInput
                  value={newDocName}
                  onChangeText={setNewDocName}
                  placeholder="e.g. Work_Agreement.pdf"
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Reference No. (Optional)</Text>
              <View style={styles.inputBox}>
                <TextInput
                  value={newDocRef}
                  onChangeText={setNewDocRef}
                  placeholder="e.g. AGR-2026-01"
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.docModalFooter}>
              <Pressable onPress={() => setIsDocModalOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAddDocument} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Attach</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.pageRoot}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  modalCardDesktop: {
    maxWidth: 500,
    width: '100%',
    maxHeight: '92%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* Minimal Header */
  topHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none' as any } : {}),
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Live Site Preview Strip */
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  previewIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewCenter: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  previewTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  previewSub: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
  previewRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  previewAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: -0.2,
  },
  previewAmountActive: {
    color: '#15803D',
  },
  previewTag: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
    flex: 1,
  },

  /* Body */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
    gap: 12,
  },
  scrollContentDesktop: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 18,
  },

  /* Cards */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  req: {
    color: Colors.danger,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  inputBox: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  inputBoxError: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inputBoxValid: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  amountInput: {
    fontWeight: '700',
    fontSize: 15,
  },
  prefixText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  prefixDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
  },
  rupeeSign: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  amountPreviewBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  /* Segmented Control */
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  segmentedBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  segmentedBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentedText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },

  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unitChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  unitChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  unitChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  calcStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  calcFormula: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  calcResult: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Status Chips */
  statusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusChip: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* Date Buttons */
  dateBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 11,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  dateBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dateBtnPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },

  /* Collapsible Accordion */
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 13,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  accordionBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  accordionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  accordionBody: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    paddingTop: 4,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  notesInput: {
    minHeight: 74,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },

  /* GST Block */
  gstBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
  },
  gstSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  gstFields: {
    gap: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  inlineErr: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.danger,
  },
  dropdownPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  stateCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    width: 22,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  dropdownItemTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Documents */
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadMiniBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  docName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  docMeta: {
    fontSize: 10.5,
    color: '#64748B',
  },

  /* Sticky Footer */
  footerBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    alignSelf: 'center',
  },
  footerInnerDesktop: {
    maxWidth: 532,
    alignSelf: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 1,
    height: 46,
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
  saveBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Attach Document Inline Overlay */
  docInlineOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 100,
  },
  docModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  docModalSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  docModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  docModalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
