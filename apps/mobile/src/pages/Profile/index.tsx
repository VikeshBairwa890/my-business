import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  BackHandler,
  Image,
  Modal,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { showToast } from '../../context/ToastContext';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar, formatNameInitials } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { useLanguage } from '../../i18n';
import {
  BusinessProfileData,
  getBusinessProfile,
  saveBusinessProfileData,
} from '../../storage/profileStorage';

export { BusinessProfileData };

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi NCR',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

interface ProfilePageProps {
  data: Snapshot;
  onBack: () => void;
  onUpdateProfile?: (values: { name?: string; organization_name?: string }) => Promise<void> | void;
  onLogout?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ProfilePage({
  data,
  onBack,
  onUpdateProfile,
  onRefresh,
  refreshing = false,
}: ProfilePageProps) {
  const { lang, t } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const scrollRef = useRef<ScrollView>(null);
  const fileInputRef = useRef<any>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showLogoViewer, setShowLogoViewer] = useState(false);
  const [confirmingDeleteLogo, setConfirmingDeleteLogo] = useState(false);

  // Form State
  const [form, setForm] = useState<BusinessProfileData>({
    contractorName: data.user.name || '',
    firmName: data.organization.name || '',
    phone: '',
    email: '',
    state: 'Delhi NCR',
    city: '',
    address: '',
    gstin: '',
    pan: '',
    logo: '',
  });

  // Load saved profile data on mount
  useEffect(() => {
    async function loadSavedProfile() {
      try {
        const parsed = await getBusinessProfile();
        if (parsed) {
          setForm((prev) => ({
            ...prev,
            ...parsed,
            contractorName: data.user.name || parsed.contractorName || prev.contractorName,
            firmName: data.organization.name || parsed.firmName || prev.firmName,
            logo: parsed.logo || prev.logo || '',
          }));
        }
      } catch { }
    }
    loadSavedProfile();
  }, [data.user.name, data.organization.name]);

  // Auto-dismiss notification
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (copiedKey) {
      const timer = setTimeout(() => setCopiedKey(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [copiedKey]);

  // Handle hardware back button in Profile
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (statePickerOpen) {
        setStatePickerOpen(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => backSub.remove();
  }, [statePickerOpen, onBack]);

  const updateField = (key: keyof BusinessProfileData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const processImageFile = (file: File) => {
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const rawDataUrl = uploadEvent.target?.result as string;
      if (rawDataUrl) {
        if (typeof window !== 'undefined' && typeof (window as any).Image !== 'undefined') {
          const img = new (window as any).Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 320;
            let w = img.width;
            let h = img.height;
            if (w > h) {
              if (w > maxDim) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              }
            } else {
              if (h > maxDim) {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const outMime =
                file.type === 'image/png' || file.type === 'image/webp'
                  ? 'image/png'
                  : 'image/jpeg';
              updateField('logo', canvas.toDataURL(outMime, 0.85));
            } else {
              updateField('logo', rawDataUrl);
            }
            setUploadingLogo(false);
            showToast(
              lang === 'hi' ? 'लोगो सफलतापूर्वक चुना गया' : 'Logo selected successfully',
              's'
            );
          };
          img.onerror = () => {
            updateField('logo', rawDataUrl);
            setUploadingLogo(false);
            showToast(
              lang === 'hi' ? 'लोगो चुना गया' : 'Logo selected',
              's'
            );
          };
          img.src = rawDataUrl;
        } else {
          updateField('logo', rawDataUrl);
          setUploadingLogo(false);
        }
      } else {
        setUploadingLogo(false);
      }
    };
    reader.onerror = () => {
      setUploadingLogo(false);
      showToast(lang === 'hi' ? 'फ़ाइल पढ़ने में त्रुटि' : 'Could not read file', 'e');
    };
    reader.readAsDataURL(file);
  };

  const handleWebFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      processImageFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleOpenLogoPicker = async () => {
    if (uploadingLogo) return;

    if (Platform.OS === 'web') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
        return;
      }
      if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) processImageFile(file);
        };
        input.click();
        return;
      }
    }

    try {
      setUploadingLogo(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast(
          lang === 'hi'
            ? 'कृपया फोटो लाइब्रेरी परमिशन दें'
            : 'Please grant photo library permission',
          'e'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          updateField('logo', `data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          updateField('logo', asset.uri);
        }
        showToast(lang === 'hi' ? 'लोगो चुना गया' : 'Logo selected', 's');
      }
    } catch {
      showToast(lang === 'hi' ? 'गैलरी खोलने में त्रुटि हुई' : 'Could not open photo gallery', 'e');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAvatarPress = () => {
    if (uploadingLogo) return;
    if (form.logo) {
      setConfirmingDeleteLogo(false);
      setShowLogoViewer(true);
    } else {
      handleOpenLogoPicker();
    }
  };

  const handleCopy = (text: string, keyName: string) => {
    if (!text) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      // 1. Save locally in Storage
      await saveBusinessProfileData(form);

      // 2. Sync core name & org with backend commands if changed
      if (onUpdateProfile) {
        await onUpdateProfile({
          name: form.contractorName.trim() || undefined,
          organization_name: form.firmName.trim() || undefined,
        });
      }

      setSuccessMsg(
        lang === 'hi'
          ? 'फर्म और प्रोफ़ाइल की जानकारी सुरक्षित हो गई है।'
          : 'Firm and contractor profile saved successfully.'
      );

      // Auto-scroll smoothly to top so user sees the confirmation popup banner
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e: any) {
      setSuccessMsg(`❌ Error: ${e.message}`);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  const contractorDisplayName =
    form.contractorName || data.user.name || data.organization.name || 'ThekaBook';
  const firmDisplayName = form.firmName || data.organization.name || 'ThekaBook';
  const firmInitials = formatNameInitials(firmDisplayName, 'TB');

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title={t('businessProfile', 'Business & Firm Profile')}
        subtitle={form.firmName || data.organization.name}
        onBack={onBack}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
          {/* Notification Banner */}
          {successMsg ? (
            <View style={styles.notificationBanner}>
              <AppIcon
                name={successMsg.includes('❌') || successMsg.toLowerCase().includes('error') ? 'alert-circle' : 'checkmark-circle'}
                size={17}
                color={successMsg.includes('❌') || successMsg.toLowerCase().includes('error') ? '#DC2626' : '#059669'}
              />
              <Text
                style={[
                  styles.notificationText,
                  (successMsg.includes('❌') || successMsg.toLowerCase().includes('error')) && styles.notificationTextError,
                ]}
              >
                {successMsg}
              </Text>
            </View>
          ) : null}

          {/* ========================================================= */}
          {/* 1. ULTRA-PREMIUM EXECUTIVE CONTRACTOR HERO CARD */}
          {/* ========================================================= */}
          <View style={styles.heroCard}>
            {/* Top Identity Block */}
            <View style={styles.heroTopRow}>
              {/* Clickable Avatar: View if exists, else Pick */}
              <View style={styles.avatarContainer}>
                <Pressable
                  onPress={handleAvatarPress}
                  disabled={uploadingLogo}
                  style={({ pressed }) => [styles.avatarWrapper, pressed && { opacity: 0.85 }]}
                  accessibilityLabel={form.logo ? 'View company logo' : 'Upload company logo'}
                >
                  {form.logo ? (
                    <Image source={{ uri: form.logo }} style={styles.avatarLogoImg} />
                  ) : (
                    <View style={styles.avatarCircle}>
                      {firmInitials ? (
                        <Text style={styles.avatarText}>{firmInitials}</Text>
                      ) : (
                        <AppIcon name="business" size={26} color="#1D4ED8" />
                      )}
                    </View>
                  )}
                  {/* Camera badge: clicking it directly changes the logo */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleOpenLogoPicker();
                    }}
                    hitSlop={6}
                    style={styles.avatarCameraBadge}
                    accessibilityLabel="Change company logo"
                  >
                    {uploadingLogo ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <AppIcon name="camera" size={11} color="#FFFFFF" />
                    )}
                  </Pressable>
                </Pressable>
              </View>

              <View style={styles.heroMainInfo}>
                <View style={styles.firmTitleRow}>
                  <Text style={styles.firmTitle} numberOfLines={2}>
                    {form.firmName || data.organization.name || 'ThekaBook Business'}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <AppIcon name="shield-checkmark" size={12} color="#15803D" />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                </View>

                <View style={styles.proprietorRow}>
                  <AppIcon name="person-outline" size={13} color="#475569" />
                  <Text style={styles.proprietorText} numberOfLines={1}>
                    {form.contractorName || data.user.name || 'Contractor / Owner'}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  {form.city ? (
                    <View style={styles.metaPill}>
                      <AppIcon name="location-outline" size={11} color="#2563EB" />
                      <Text style={styles.metaPillText} numberOfLines={1}>{form.city}, {form.state}</Text>
                    </View>
                  ) : (
                    <View style={styles.metaPill}>
                      <AppIcon name="location-outline" size={11} color="#2563EB" />
                      <Text style={styles.metaPillText} numberOfLines={1}>{form.state}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* BUSINESS & FIRM PROFILE DETAILS                           */}
          {/* ========================================================= */}
          <View style={styles.tabContentBlock}>
            {/* Card 1: Identity & Primary Info */}
            <View style={styles.premiumCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="business" size={17} color="#1D4ED8" />
                </View>
                <View style={styles.cardHeaderContent}>
                  <Text style={styles.cardHeaderMainTitle}>
                    {t('firmIdentity', 'Firm & Proprietor Identity')}
                  </Text>
                  <Text style={styles.cardHeaderSubtitle}>
                    {t('firmIdentitySub', 'Official details used for client quotations, bills & PDF reports')}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldsContainer}>
                {/* Firm / Company Name */}
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>
                    {t('firmNameLabel', 'Firm / Company Name')} <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <AppIcon name="business-outline" size={16} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      value={form.firmName}
                      onChangeText={(v) => updateField('firmName', v)}
                      placeholder={t('enterCompanyName', 'e.g. Sharma Constructions')}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Contractor / Proprietor Name */}
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>
                    {t('contractorNameLabel', 'Contractor / Proprietor Name')} <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <AppIcon name="person-outline" size={16} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      value={form.contractorName}
                      onChangeText={(v) => updateField('contractorName', v)}
                      placeholder={t('enterContractorName', 'e.g. Ramesh Sharma')}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Card 2: Contact & Location */}
            <View style={styles.premiumCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: '#F0FDF4' }]}>
                  <AppIcon name="location" size={17} color="#16A34A" />
                </View>
                <View style={styles.cardHeaderContent}>
                  <Text style={styles.cardHeaderMainTitle}>{t('contactAndLocation', 'Contact & Location')}</Text>
                  <Text style={styles.cardHeaderSubtitle}>
                    {t('contactAndLocationSub', 'Regional office, site yard, and direct contact numbers')}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldsContainer}>
                {/* Phone & Email (Responsive: column on mobile, row on desktop) */}
                <View style={[styles.responsiveGridRow, !isDesktop && styles.responsiveGridCol]}>
                  <View style={styles.flexFieldItem}>
                    <Text style={styles.fieldLabel}>{t('contactMobileLabel', 'Contact Mobile Number')}</Text>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="call-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.phone}
                        onChangeText={(v) => updateField('phone', v)}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.flexFieldItem}>
                    <Text style={styles.fieldLabel}>{t('emailAddressLabel', 'Email Address')}</Text>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="mail-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.email}
                        onChangeText={(v) => updateField('email', v)}
                        placeholder="contractor@thekabook.in"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>

                {/* State & City */}
                <View style={[styles.responsiveGridRow, !isDesktop && styles.responsiveGridCol]}>
                  <View style={styles.flexFieldItem}>
                    <Text style={styles.fieldLabel}>{t('stateLabel', 'State / UT')}</Text>
                    <Pressable
                      onPress={() => setStatePickerOpen((v) => !v)}
                      style={styles.stateSelectBtn}
                    >
                      <View style={styles.stateSelectTextWrap}>
                        <AppIcon name="map-outline" size={16} color="#64748B" />
                        <Text style={styles.stateSelectText} numberOfLines={1}>
                          {form.state}
                        </Text>
                      </View>
                      <AppIcon
                        name={statePickerOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#64748B"
                      />
                    </Pressable>

                    {/* State Dropdown List */}
                    {statePickerOpen && (
                      <View style={styles.stateDropdownContainer}>
                        <ScrollView
                          style={styles.stateDropdownScroll}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {INDIAN_STATES.map((st) => (
                            <Pressable
                              key={st}
                              onPress={() => {
                                updateField('state', st);
                                setStatePickerOpen(false);
                              }}
                              style={[
                                styles.stateItem,
                                form.state === st && styles.stateItemActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.stateItemText,
                                  form.state === st && styles.stateItemTextActive,
                                ]}
                              >
                                {st}
                              </Text>
                              {form.state === st && (
                                <AppIcon name="checkmark-circle" size={15} color="#1D4ED8" />
                              )}
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={styles.flexFieldItem}>
                    <Text style={styles.fieldLabel}>{t('cityDistrictLabel', 'City / District')}</Text>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="business-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.city}
                        onChangeText={(v) => updateField('city', v)}
                        placeholder="e.g. Noida / Gurugram"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>

                {/* Office / Yard Address */}
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>{t('officeAddressLabel', 'Office / Site Yard Address')}</Text>
                  <View style={[styles.inputWrapper, { alignItems: 'flex-start', height: 'auto', minHeight: 50, paddingVertical: 6 }]}>
                    <AppIcon name="home-outline" size={16} color="#64748B" style={[styles.inputIcon, { marginTop: 2 }]} />
                    <TextInput
                      style={[styles.fieldInput, { height: 42, textAlignVertical: 'top' }]}
                      value={form.address}
                      onChangeText={(v) => updateField('address', v)}
                      placeholder="Shop/Office No., Street, Sector/Colony, Landmark..."
                      placeholderTextColor="#94A3B8"
                      multiline
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Card 3: Tax & Legal Identifiers (Optional) */}
            <View style={styles.premiumCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: '#FAF5FF' }]}>
                  <AppIcon name="receipt" size={17} color="#7E22CE" />
                </View>
                <View style={styles.cardHeaderContent}>
                  <Text style={styles.cardHeaderMainTitle}>{t('taxAndRegistration', 'Tax & Registration (Optional)')}</Text>
                  <Text style={styles.cardHeaderSubtitle}>
                    {t('taxAndRegistrationSub', 'Printed on GST invoice vouchers and legal client agreements')}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldsContainer}>
                <View style={[styles.responsiveGridRow, !isDesktop && styles.responsiveGridCol]}>
                  {/* GSTIN */}
                  <View style={styles.flexFieldItem}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>{t('gstinLabel', 'GSTIN (GST Number)')}</Text>
                      {form.gstin ? (
                        <Pressable onPress={() => handleCopy(form.gstin, 'gstin')}>
                          <Text style={styles.copyHelperText}>
                            {copiedKey === 'gstin' ? t('copiedText', 'Copied!') : t('copyText', 'Copy')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="document-text-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.gstin}
                        onChangeText={(v) => updateField('gstin', v.toUpperCase())}
                        placeholder="07AAAAA0000A1Z5"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                        maxLength={15}
                      />
                    </View>
                  </View>

                  {/* PAN */}
                  <View style={styles.flexFieldItem}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>{t('panLabel', 'PAN Card Number')}</Text>
                      {form.pan ? (
                        <Pressable onPress={() => handleCopy(form.pan, 'pan')}>
                          <Text style={styles.copyHelperText}>
                            {copiedKey === 'pan' ? t('copiedText', 'Copied!') : t('copyText', 'Copy')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={styles.inputWrapper}>
                      <AppIcon name="card-outline" size={16} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.fieldInput}
                        value={form.pan}
                        onChangeText={(v) => updateField('pan', v.toUpperCase())}
                        placeholder="ABCDE1234F"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                        maxLength={10}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Save Action Bar */}
            <View style={styles.primarySaveBtnWrap}>
              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primarySaveBtn,
                  isDesktop && styles.primarySaveBtnDesktop,
                  saving && { opacity: 0.65 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.primarySaveBtnText}>
                      {lang === 'hi' ? 'सुरक्षित हो रहा है...' : 'Saving Profile...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <AppIcon name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.primarySaveBtnText}>
                      {t('saveBusinessProfile', 'Save Business Profile')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Hidden file input for web upload */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
      )}

      {/* Full Company Logo Viewer Modal */}
      {form.logo ? (
        <Modal
          visible={showLogoViewer}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowLogoViewer(false);
            setConfirmingDeleteLogo(false);
          }}
        >
          <Pressable
            style={styles.viewerModalOverlay}
            onPress={() => {
              setShowLogoViewer(false);
              setConfirmingDeleteLogo(false);
            }}
          >
            <Pressable
              style={styles.viewerModalCard}
              onPress={(e) => {
                e.stopPropagation();
              }}
            >
              {/* Header */}
              <View style={styles.viewerModalHeader}>
                <View style={styles.viewerHeaderTitleWrap}>
                  <View style={styles.viewerIconCircle}>
                    <AppIcon name="business" size={16} color="#1D4ED8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerModalTitle}>
                      {lang === 'hi' ? 'कंपनी का लोगो' : 'Firm & Company Logo'}
                    </Text>
                    <Text style={styles.viewerModalSub} numberOfLines={1}>
                      {firmDisplayName}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    setShowLogoViewer(false);
                    setConfirmingDeleteLogo(false);
                  }}
                  hitSlop={8}
                  style={styles.viewerCloseBtn}
                >
                  <AppIcon name="close" size={18} color="#64748B" />
                </Pressable>
              </View>

              {/* Logo Preview Showcase */}
              <View style={styles.viewerImageContainer}>
                <Image
                  source={{ uri: form.logo }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>

              {!confirmingDeleteLogo ? (
                /* Primary Actions: Change Logo & Remove Logo */
                <View style={styles.viewerActionRow}>
                  <Pressable
                    style={({ pressed }) => [styles.viewerChangeBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => {
                      handleOpenLogoPicker();
                      setShowLogoViewer(false);
                    }}
                  >
                    <AppIcon name="camera" size={16} color="#FFFFFF" />
                    <Text style={styles.viewerChangeBtnText}>
                      {lang === 'hi' ? 'लोगो बदलें' : 'Change Logo'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.viewerDeleteBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => setConfirmingDeleteLogo(true)}
                  >
                    <AppIcon name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.viewerDeleteBtnText}>
                      {lang === 'hi' ? 'लोगो हटाएं' : 'Remove Logo'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                /* Inline Delete Warning Confirmation */
                <View style={styles.inlineConfirmBox}>
                  <View style={styles.inlineConfirmHeader}>
                    <View style={styles.inlineAlertIconWrap}>
                      <AppIcon name="alert-circle" size={18} color="#DC2626" />
                    </View>
                    <Text style={styles.inlineConfirmTitle}>
                      {lang === 'hi' ? 'क्या वाकई लोगो हटाना चाहते हैं?' : 'Remove this company logo?'}
                    </Text>
                  </View>
                  <Text style={styles.inlineConfirmSub}>
                    {lang === 'hi'
                      ? 'हटाने के बाद यह आपके बिल, सैलरी स्लिप और स्टेटमेंट से भी हट जाएगा।'
                      : 'This will permanently remove the logo from all future bills and statements.'}
                  </Text>
                  <View style={styles.inlineConfirmActionRow}>
                    <Pressable
                      style={({ pressed }) => [styles.inlineCancelBtn, pressed && { opacity: 0.75 }]}
                      onPress={() => setConfirmingDeleteLogo(false)}
                    >
                      <Text style={styles.inlineCancelBtnText}>
                        {lang === 'hi' ? 'नहीं, रहने दें' : 'Cancel'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.inlineDeleteBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        updateField('logo', '');
                        setConfirmingDeleteLogo(false);
                        setShowLogoViewer(false);
                        showToast(
                          lang === 'hi' ? 'लोगो हटा दिया गया है' : 'Logo removed successfully',
                          's'
                        );
                      }}
                    >
                      <AppIcon name="trash-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.inlineDeleteBtnText}>
                        {lang === 'hi' ? 'हाँ, हटाएं' : 'Yes, Remove'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  root: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  desktopContainer: {
    paddingTop: 24,
  },

  /* Notification Banner */
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  notificationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    textAlign: 'center',
  },
  notificationTextError: {
    color: '#991B1B',
  },

  /* ========================================================= */
  /* 1. Ultra-Premium Executive Hero Card */
  /* ========================================================= */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarWrapper: {
    position: 'relative',
    cursor: 'pointer' as any,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    fontSize: 21,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  avatarLogoImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  heroMainInfo: {
    flex: 1,
    gap: 4,
  },
  firmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  firmTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  verifiedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
  proprietorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  proprietorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  /* ========================================================= */
  /* Form & Cards Styling */
  /* ========================================================= */
  tabContentBlock: {
    gap: 16,
  },
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardHeaderMainTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },

  fieldsContainer: {
    gap: 11,
  },
  fieldItem: {
    gap: 4,
    width: '100%',
  },
  flexFieldItem: {
    flex: 1,
    gap: 4,
    width: '100%',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  logoHelperLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    cursor: 'pointer' as any,
  },
  logoHelperLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  copyHelperText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '900',
  },
  responsiveGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  responsiveGridCol: {
    flexDirection: 'column',
    gap: 10,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    minHeight: 38,
    gap: 7,
  },
  inputIcon: {
    marginLeft: 1,
  },
  inputLogoBadge: {
    position: 'relative',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    cursor: 'pointer' as any,
  },
  inputLogoImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  inputLogoInitials: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLogoInitialsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  inputLogoCameraIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#2563EB',
    width: 11,
    height: 11,
    borderRadius: 5.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 0,
    height: 36,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
      : {}),
  },

  /* State Selector */
  stateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    minHeight: 38,
  },
  stateSelectTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  stateSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  stateDropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stateDropdownScroll: {
    maxHeight: 180,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateItemActive: {
    backgroundColor: '#EFF6FF',
  },
  stateItemText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  stateItemTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },

  /* Primary Save Button */
  primarySaveBtnWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  primarySaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#1E40AF',
    width: '100%',
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primarySaveBtnDesktop: {
    maxWidth: 420,
    alignSelf: 'center',
  },
  primarySaveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /* Viewer Modal Styles */
  viewerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    gap: 14,
    cursor: 'default' as any,
  },
  viewerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  viewerHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  viewerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewerModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  viewerCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    cursor: 'pointer' as any,
  },
  viewerImageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    overflow: 'hidden',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  viewerChangeBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    cursor: 'pointer' as any,
  },
  viewerChangeBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewerDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 12,
    cursor: 'pointer' as any,
  },
  viewerDeleteBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Inline Delete Warning */
  inlineConfirmBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  inlineConfirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineAlertIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineConfirmTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991B1B',
    flex: 1,
  },
  inlineConfirmSub: {
    fontSize: 11.5,
    color: '#B91C1C',
    lineHeight: 16,
  },
  inlineConfirmActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inlineCancelBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  inlineCancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  inlineDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    cursor: 'pointer' as any,
  },
  inlineDeleteBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
