import * as ImagePicker from 'expo-image-picker';
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
  Image,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { TopNavBar } from '../common/TopNavBar';
import { FormSpec, Row, Snapshot } from '../../types';
import { useLanguage } from '../../i18n';
import { showToast } from '../../context/ToastContext';

export interface WorkerFormModalProps {
  spec: FormSpec;
  data: Snapshot;
  worker?: Row;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
  onOpenPaymentModal?: (workerId: string) => void;
  onOpenAttendanceModal?: (workerId: string) => void;
  asPage?: boolean;
}

interface SkillOption {
  id: string;
  name: string;
  icon: string;
  defaultDailyRate: number;
}

const COMMON_SKILLS: SkillOption[] = [
  { id: 'mason', name: 'Mason', icon: 'hammer-outline', defaultDailyRate: 850 },
  { id: 'helper', name: 'Helper', icon: 'people-outline', defaultDailyRate: 500 },
  { id: 'painter', name: 'Painter', icon: 'color-palette-outline', defaultDailyRate: 750 },
  { id: 'electrician', name: 'Electrician', icon: 'flash-outline', defaultDailyRate: 800 },
  { id: 'plumber', name: 'Plumber', icon: 'water-outline', defaultDailyRate: 800 },
  { id: 'carpenter', name: 'Carpenter', icon: 'construct-outline', defaultDailyRate: 850 },
  { id: 'tile', name: 'Tile Mason', icon: 'grid-outline', defaultDailyRate: 900 },
  { id: 'welder', name: 'Welder', icon: 'flame-outline', defaultDailyRate: 800 },
  { id: 'supervisor', name: 'Supervisor', icon: 'shield-checkmark-outline', defaultDailyRate: 1000 },
  { id: 'other', name: 'Other', icon: 'create-outline', defaultDailyRate: 700 },
];

export function WorkerFormModal({
  spec,
  data,
  worker,
  busy,
  error,
  onClose,
  onSave,
  asPage = false,
}: WorkerFormModalProps) {
  const { lang } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const isEdit = spec.action === 'worker.update' || !!worker;

  const activeWorker = useMemo(() => {
    if (worker) return worker;
    if (spec.entity_id) {
      return data.workers.find((w) => w.id === spec.entity_id);
    }
    return undefined;
  }, [worker, spec.entity_id, data.workers]);

  // Form State
  const [name, setName] = useState<string>(
    String(spec.initial.name || activeWorker?.name || '')
  );
  const [phone, setPhone] = useState<string>(
    String(spec.initial.phone || activeWorker?.phone || '')
  );
  const [photo, setPhoto] = useState<string>(
    String(spec.initial.photo || activeWorker?.photo || '')
  );
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Skill State
  const initialSkillStr = String(spec.initial.skill || activeWorker?.skill || 'Mason');
  const matchedSkill = COMMON_SKILLS.find(
    (s) =>
      s.name.toLowerCase() === initialSkillStr.toLowerCase() ||
      initialSkillStr.toLowerCase().includes(s.id)
  );

  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    matchedSkill ? matchedSkill.id : 'other'
  );
  const [customSkill, setCustomSkill] = useState<string>(
    matchedSkill ? '' : initialSkillStr
  );
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);

  const selectedSkill = useMemo(() => {
    return COMMON_SKILLS.find((s) => s.id === selectedSkillId) || COMMON_SKILLS[0];
  }, [selectedSkillId]);

  // Daily Wage Rate
  const [dailyRate, setDailyRate] = useState<string>(
    spec.initial.daily_rate
      ? String(spec.initial.daily_rate)
      : activeWorker
        ? String(Number(activeWorker.daily_rate) / 100)
        : ''
  );

  // Overtime Rate per hour
  const [overtimeRate, setOvertimeRate] = useState<string>(() => {
    if (spec.initial.overtime_rate !== undefined && spec.initial.overtime_rate !== '') {
      const n = Number(spec.initial.overtime_rate);
      return n > 0 ? String(n) : '';
    }
    if (activeWorker?.overtime_rate !== undefined) {
      const n = Number(activeWorker.overtime_rate);
      return n > 0 ? String(n / 100) : '';
    }
    return '';
  });

  // Active Status
  const [active, setActive] = useState<boolean>(
    spec.initial.active !== undefined
      ? String(spec.initial.active) === 'true'
      : activeWorker
        ? activeWorker.active
        : true
  );

  const [validationError, setValidationError] = useState<string>('');

  const handlePickImage = async () => {
    try {
      setUploadingImage(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast(
          lang === 'hi'
            ? 'फ़ोटो चुनने के लिए गैलरी की अनुमति दें'
            : 'Please grant permission to access photos',
          'e'
        );
        setUploadingImage(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setPhoto(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setPhoto(asset.uri);
        }
      }
    } catch {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const rawDataUrl = uploadEvent.target?.result as string;
            if (rawDataUrl) {
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
                  setPhoto(canvas.toDataURL(outMime, 0.85));
                } else {
                  setPhoto(rawDataUrl);
                }
              };
              img.src = rawDataUrl;
            }
          };
          reader.readAsDataURL(file);
        };
        input.click();
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectSkill = (skill: SkillOption) => {
    setSelectedSkillId(skill.id);
    if (skill.id !== 'other') {
      setCustomSkill('');
    }
    setIsSkillDropdownOpen(false);
  };

  const handleSubmit = () => {
    setValidationError('');

    const cleanName = name.trim();
    if (!cleanName) {
      showToast(
        lang === 'hi' ? 'कृपया मजदूर का नाम लिखें' : 'Please enter worker full name',
        'e'
      );
      return;
    }

    const dailyNum = parseFloat(dailyRate);
    if (isNaN(dailyNum) || dailyNum <= 0) {
      showToast(
        lang === 'hi' ? 'कृपया सही दिहाड़ी रेट डालें' : 'Please enter a valid daily wage rate',
        'e'
      );
      return;
    }

    if (selectedSkillId === 'other' && !customSkill.trim()) {
      showToast(
        lang === 'hi' ? 'कृपया काम का नाम लिखें' : 'Please enter custom skill / work',
        'e'
      );
      return;
    }

    const finalSkill =
      selectedSkillId === 'other' ? customSkill.trim() : selectedSkill.name;

    const otNum = parseFloat(overtimeRate);
    const validOtNum = !isNaN(otNum) && otNum > 0 ? otNum : 0;

    onSave({
      name: cleanName,
      phone: phone.trim(),
      skill: finalSkill,
      daily_rate: String(dailyNum),
      overtime_rate: String(validOtNum),
      active: active ? 'true' : 'false',
      photo: photo.trim(),
    });
  };

  const displayError = validationError || error;

  const content = (
    <View style={styles.sheetContainer}>
      {/* 1. STANDARD PAGE TOP NAVBAR */}
      <TopNavBar
        title={
          isEdit
            ? lang === 'hi'
              ? 'मजदूर एडिट करें'
              : 'Edit Worker'
            : lang === 'hi'
              ? 'नया मजदूर जोड़ें'
              : 'Add New Worker'
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
        {/* 2. COMPACT CENTERED PHOTO AVATAR */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickImage}
            disabled={uploadingImage}
            style={({ pressed }) => [styles.avatarTouch, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Upload worker photo"
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <AppIcon name="person" size={30} color="#94A3B8" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon name="camera" size={13} color="#FFFFFF" />
              )}
            </View>
          </Pressable>

          <View style={styles.avatarLabelRow}>
            <Pressable onPress={handlePickImage} disabled={uploadingImage}>
              <Text style={styles.avatarActionText}>
                {photo
                  ? (lang === 'hi' ? 'फ़ोटो बदलें' : 'Change Photo')
                  : (lang === 'hi' ? 'फ़ोटो जोड़ें (वैकल्पिक)' : 'Add Photo (Optional)')}
              </Text>
            </Pressable>
            {photo ? (
              <>
                <Text style={styles.avatarDot}>•</Text>
                <Pressable onPress={() => setPhoto('')}>
                  <Text style={styles.avatarRemoveText}>
                    {lang === 'hi' ? 'हटाएं' : 'Remove'}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {/* 3. SINGLE CLEAN FORM CARD */}
        <View style={styles.formCard}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {lang === 'hi' ? 'पूरा नाम' : 'Full Name'} <Text style={styles.reqStar}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <AppIcon name="person-outline" size={16} color="#94A3B8" />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={lang === 'hi' ? 'उदा. रमेश कुमार' : 'e.g. Ramesh Kumar'}
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {name ? (
                <Pressable onPress={() => setName('')} hitSlop={8}>
                  <AppIcon name="close-circle" size={16} color="#CBD5E1" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Mobile Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {lang === 'hi' ? 'मोबाइल नंबर (वैकल्पिक)' : 'Mobile Number (Optional)'}
            </Text>
            <View style={styles.inputBox}>
              <Text style={styles.phonePrefix}>+91</Text>
              <View style={styles.prefixDivider} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={lang === 'hi' ? '10 अंकों का नंबर' : '10-digit mobile number'}
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                keyboardType="phone-pad"
                maxLength={13}
              />
              {phone ? (
                <Pressable onPress={() => setPhone('')} hitSlop={8}>
                  <AppIcon name="close-circle" size={16} color="#CBD5E1" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Skill / Work */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {lang === 'hi' ? 'काम / श्रेणी' : 'Skill / Work'} <Text style={styles.reqStar}>*</Text>
            </Text>
            <Pressable
              onPress={() => setIsSkillDropdownOpen((v) => !v)}
              style={styles.inputBox}
              accessibilityRole="button"
            >
              <AppIcon name={selectedSkill.icon} size={16} color="#2563EB" />
              <Text style={styles.dropdownValText} numberOfLines={1}>
                {selectedSkill.name}
              </Text>
              <AppIcon
                name={isSkillDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#94A3B8"
              />
            </Pressable>

            {isSkillDropdownOpen && (
              <View style={styles.dropdownList}>
                {COMMON_SKILLS.map((skill, idx) => {
                  const isSelected = selectedSkillId === skill.id;
                  return (
                    <Pressable
                      key={skill.id}
                      onPress={() => handleSelectSkill(skill)}
                      style={[
                        styles.dropdownRow,
                        idx < COMMON_SKILLS.length - 1 && styles.dropdownRowBorder,
                        isSelected && styles.dropdownRowActive,
                      ]}
                    >
                      <AppIcon
                        name={skill.icon}
                        size={15}
                        color={isSelected ? '#2563EB' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.dropdownRowText,
                          isSelected && styles.dropdownRowTextActive,
                        ]}
                      >
                        {skill.name}
                      </Text>
                      {isSelected && (
                        <AppIcon name="checkmark" size={16} color="#2563EB" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {selectedSkillId === 'other' && (
              <View style={[styles.inputBox, { marginTop: 6 }]}>
                <AppIcon name="create-outline" size={16} color="#94A3B8" />
                <TextInput
                  value={customSkill}
                  onChangeText={setCustomSkill}
                  placeholder={lang === 'hi' ? 'काम का नाम लिखें (जैसे POP)' : 'Enter custom skill (e.g. POP)'}
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>
            )}
          </View>

          {/* Rates Row — 2 Columns (Daily Wage & Overtime Rate) */}
          <View style={styles.twoColRatesRow}>
            {/* Column 1: Daily Wage Rate */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel} numberOfLines={1}>
                {lang === 'hi' ? 'दैनिक दिहाड़ी' : 'Daily Wage'} <Text style={styles.reqStar}>*</Text>
              </Text>
              <View style={styles.rateInputBox}>
                <Text style={styles.rupeePrefix}>₹</Text>
                <TextInput
                  value={dailyRate}
                  onChangeText={setDailyRate}
                  placeholder="700"
                  placeholderTextColor="#94A3B8"
                  style={[styles.textInput, styles.rateInputText]}
                  keyboardType="numeric"
                />
                <View style={styles.unitBadge}>
                  <Text style={styles.unitSuffix}>/day</Text>
                </View>
              </View>
            </View>

            {/* Column 2: Overtime Rate */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel} numberOfLines={1}>
                {lang === 'hi' ? 'ओवरटाइम दर' : 'Overtime Rate'}
              </Text>
              <View style={styles.rateInputBox}>
                <Text style={styles.rupeePrefix}>₹</Text>
                <TextInput
                  value={overtimeRate}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setOvertimeRate(cleaned);
                  }}
                  placeholder="100"
                  placeholderTextColor="#94A3B8"
                  style={[styles.textInput, styles.rateInputText]}
                  keyboardType="numeric"
                />
                <View style={styles.unitBadge}>
                  <Text style={styles.unitSuffix}>/hr</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Worker Status (Active / Inactive) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {lang === 'hi' ? 'स्थिति' : 'Status'}
            </Text>
            <View style={styles.statusTrack}>
              <Pressable
                onPress={() => setActive(true)}
                style={({ pressed }) => [
                  styles.statusPill,
                  active && styles.statusPillActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={active ? '#16A34A' : '#94A3B8'}
                />
                <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>
                  {lang === 'hi' ? 'सक्रिय (Active)' : 'Active'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActive(false)}
                style={({ pressed }) => [
                  styles.statusPill,
                  !active && styles.statusPillInactive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={!active ? 'pause-circle' : 'ellipse-outline'}
                  size={16}
                  color={!active ? '#DC2626' : '#94A3B8'}
                />
                <Text style={[styles.statusPillText, !active && styles.statusPillTextInactive]}>
                  {lang === 'hi' ? 'निष्क्रिय (Inactive)' : 'Inactive'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 4. CLEAN STICKY FOOTER */}
      <View style={styles.footerBar}>
        <Pressable
          onPress={() => !busy && onClose()}
          style={styles.cancelBtn}
          disabled={busy}
        >
          <Text style={styles.cancelBtnText}>
            {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.saveBtn,
            busy && { opacity: 0.65 },
            pressed && !busy && { opacity: 0.9 },
          ]}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEdit
                ? (lang === 'hi' ? 'सेव करें' : 'Save Changes')
                : (lang === 'hi' ? 'मजदूर जोड़ें' : 'Add Worker')}
            </Text>
          )}
        </Pressable>
      </View>
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
    maxWidth: 460,
    width: '100%',
    maxHeight: '90%',
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

  /* Header */
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
  iconBtn: {
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
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  scrollContentDesktop: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 18,
  },

  /* Compact Avatar Upload */
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  avatarTouch: {
    width: 74,
    height: 74,
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  avatarDot: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  avatarRemoveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },

  /* Single Clean Form Card */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  twoColRatesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  reqStar: {
    color: '#EF4444',
  },
  inputBox: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  rateInputBox: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
    ...(Platform.OS === 'web'
      ? ({
        outline: 'none',
        outlineStyle: 'none',
        outlineWidth: 0,
        border: 'none',
        boxShadow: 'none',
      } as any)
      : {}),
  },
  phonePrefix: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  prefixDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
  },
  rupeePrefix: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 0,
  },
  rateInputText: {
    fontSize: 15,
    fontWeight: '700',
  },
  unitBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitSuffix: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    flexShrink: 0,
    lineHeight: 14,
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap', userSelect: 'none' } as any) : {}),
  },
  dropdownValText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  dropdownRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownRowActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownRowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownRowTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Status Segmented Track */
  statusTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 11,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPill: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  statusPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BBF7D0',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusPillInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  statusPillTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  statusPillTextInactive: {
    color: '#B91C1C',
    fontWeight: '700',
  },

  /* Sticky Footer */
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
