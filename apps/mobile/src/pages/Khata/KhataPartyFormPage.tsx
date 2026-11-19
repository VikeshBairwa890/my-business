import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TopNavBar, formatNameInitials } from '../../components/common/TopNavBar';
import { AppIcon } from '../../components/icons/AppIcon';
import { Colors } from '../../theme/colors';
import { showToast } from '../../context/ToastContext';
import { Row } from '../../types';
import {
  KHATA_CATEGORIES,
  KhataCategory,
  getReminderDateStr,
} from './khataUtils';

interface KhataPartyFormPageProps {
  party?: Row;
  entryCount?: number;
  workers: Row[];
  existingParties: Row[];
  onBack: () => void;
  onSave: (values: {
    name: string;
    phone: string;
    category: KhataCategory;
    worker_id?: string | null;
    reminder_date?: string | null;
    notes: string;
    photo?: string;
  }) => void;
  onDelete?: (partyId: string) => void;
}

export function KhataPartyFormPage({
  party,
  entryCount = 0,
  onBack,
  onSave,
  onDelete,
}: KhataPartyFormPageProps) {
  const isEdit = Boolean(party?.id);
  const [name, setName] = useState(String(party?.name || ''));
  const [phone, setPhone] = useState(String(party?.phone || ''));
  const [category, setCategory] = useState<KhataCategory>(
    (String(party?.category || 'FRIEND').toUpperCase() as KhataCategory) || 'FRIEND'
  );
  const [notes, setNotes] = useState(String(party?.notes || ''));
  const [photo, setPhoto] = useState<string>(String(party?.photo || party?.avatar || ''));
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleLaunchCamera = async () => {
    setShowPickerModal(false);
    try {
      setUploadingPhoto(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Please grant camera permission to take photo', 'e');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
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
      showToast('Could not open camera', 'e');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLaunchGallery = async () => {
    setShowPickerModal(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        setUploadingPhoto(true);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (!file) {
            setUploadingPhoto(false);
            return;
          }
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
                setUploadingPhoto(false);
              };
              img.onerror = () => setUploadingPhoto(false);
              img.src = rawDataUrl;
            } else {
              setUploadingPhoto(false);
            }
          };
          reader.onerror = () => setUploadingPhoto(false);
          reader.readAsDataURL(file);
        };
        input.click();
      } catch {
        setUploadingPhoto(false);
      }
      return;
    }

    try {
      setUploadingPhoto(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Please grant photo library permission', 'e');
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
      showToast('Could not open photo gallery', 'e');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleOpenPhotoMenu = () => {
    if (uploadingPhoto) return;
    if (Platform.OS === 'web') {
      if (photo) {
        setShowPickerModal(true);
      } else {
        handleLaunchGallery();
      }
      return;
    }
    setShowPickerModal(true);
  };

  const handleSubmit = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Please enter person name', 'e');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length < 10) {
      showToast('Enter a valid 10-digit mobile number', 'e');
      return;
    }

    onSave({
      name: cleanName,
      phone: phone.trim(),
      category,
      worker_id: party?.worker_id || party?.workerId || null,
      reminder_date: party ? getReminderDateStr(party) || null : null,
      notes: notes.trim(),
      photo: photo.trim(),
    });
  };

  return (
    <View style={styles.pageRoot}>
      <TopNavBar
        title={isEdit ? 'Edit Person' : 'Add Person'}
        subtitle="Personal & Party Account"
        onBack={onBack}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Centered Profile Avatar Section */}
          <View style={styles.avatarSection}>
            <Pressable
              onPress={handleOpenPhotoMenu}
              disabled={uploadingPhoto}
              style={({ pressed }) => [styles.avatarTouch, pressed && { opacity: 0.85 }]}
              accessibilityLabel="Upload person photo"
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatarPhoto} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {name.trim() ? (
                    <Text style={styles.avatarInitialsText}>
                      {formatNameInitials(name, 'P')}
                    </Text>
                  ) : (
                    <AppIcon name="person" size={34} color="#94A3B8" />
                  )}
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <AppIcon name="camera" size={13} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          </View>

          {/* Main Person Details Card */}
          <View style={styles.card}>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Person Name <Text style={styles.req}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <AppIcon name="person-outline" size={17} color={Colors.textSubtle} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  placeholderTextColor="#94A3B8"
                  autoFocus={!isEdit}
                />
                {name ? (
                  <Pressable onPress={() => setName('')} hitSlop={8}>
                    <AppIcon name="close-circle" size={17} color="#CBD5E1" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Mobile Number with +91 Prefix */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputWrap}>
                <View style={styles.countryPrefix}>
                  <Text style={styles.countryPrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
            </View>

            {/* Category Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {KHATA_CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategory(c.value)}
                      style={({ pressed }) => [
                        styles.catChip,
                        active && styles.catChipActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          active && styles.catChipTextActive,
                        ]}
                      >
                        {c.value === 'LABOUR' ? 'Worker' : c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Notes (Optional) */}
            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <View style={[styles.inputWrap, { alignItems: 'flex-start', paddingVertical: 8 }]}>
                <TextInput
                  style={[styles.input, { minHeight: 68, textAlignVertical: 'top' }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Address, landmark, or any helpful note..."
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>
            </View>
          </View>

          {/* Delete Party Section (Edit Mode Only) */}
          {isEdit && onDelete && party?.id ? (
            <View style={styles.dangerCard}>
              {!confirmDelete ? (
                <Pressable
                  onPress={() => {
                    if (entryCount > 0) {
                      showToast(
                        'Cannot delete this person because their ledger has existing entries',
                        'e'
                      );
                      return;
                    }
                    setConfirmDelete(true);
                  }}
                  style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.75 }]}
                >
                  <AppIcon name="trash-outline" size={16} color={Colors.danger} />
                  <Text style={styles.dangerBtnText}>Delete Person</Text>
                </Pressable>
              ) : (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>
                    Delete {party.name} permanently?
                  </Text>
                  <Text style={styles.confirmSub}>
                    This person has no transactions and will be removed from Khata Book.
                  </Text>
                  <View style={styles.confirmActions}>
                    <Pressable
                      onPress={() => setConfirmDelete(false)}
                      style={styles.confirmCancel}
                    >
                      <Text style={styles.confirmCancelText}>Keep</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (entryCount > 0) {
                          setConfirmDelete(false);
                          showToast(
                            'Cannot delete this person because their ledger has existing entries',
                            'e'
                          );
                          return;
                        }
                        onDelete(party.id);
                      }}
                      style={styles.confirmDel}
                    >
                      <Text style={styles.confirmDelText}>Yes, Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Uniform Full-Width 50/50 Cancel + Save Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.footerCancelBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.footerCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [styles.footerSaveBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.footerSaveText}>
              {isEdit ? 'Update Person' : 'Save Person'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Photo Picker Options Modal */}
      <Modal
        visible={showPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPickerModal(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Person Photo</Text>
              <Pressable
                onPress={() => setShowPickerModal(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <AppIcon name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.modalOptions}>
              {Platform.OS !== 'web' ? (
                <Pressable
                  style={({ pressed }) => [styles.modalOptionItem, pressed && styles.modalOptionPressed]}
                  onPress={handleLaunchCamera}
                >
                  <View style={[styles.modalOptionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <AppIcon name="camera" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalOptionTitle}>Take Photo</Text>
                    <Text style={styles.modalOptionSub}>Click using camera</Text>
                  </View>
                  <AppIcon name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.modalOptionItem, pressed && styles.modalOptionPressed]}
                onPress={handleLaunchGallery}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <AppIcon name="images" size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitle}>
                    {Platform.OS === 'web' ? 'Upload from Device' : 'Choose from Gallery'}
                  </Text>
                  <Text style={styles.modalOptionSub}>Select an existing photo</Text>
                </View>
                <AppIcon name="chevron-forward" size={16} color="#94A3B8" />
              </Pressable>

              {photo ? (
                <Pressable
                  style={({ pressed }) => [styles.modalOptionItem, pressed && styles.modalOptionPressed]}
                  onPress={() => {
                    setPhoto('');
                    setShowPickerModal(false);
                  }}
                >
                  <View style={[styles.modalOptionIconWrap, { backgroundColor: '#FEF2F2' }]}>
                    <AppIcon name="trash-outline" size={18} color={Colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalOptionTitle, { color: Colors.danger }]}>Remove Photo</Text>
                    <Text style={styles.modalOptionSub}>Delete current profile photo</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
    gap: 12,
  },

  /* Centered Profile Avatar Section */
  avatarSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  avatarTouch: {
    width: 76,
    height: 76,
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  avatarPhoto: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#EFF6FF',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Main Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  fieldGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  req: {
    color: Colors.danger,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  countryPrefix: {
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  countryPrefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingVertical: 10,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },

  /* Danger Delete Card */
  dangerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  dangerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  confirmBox: {
    gap: 6,
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  confirmSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmDel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  confirmDelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Uniform Full-Width 50/50 Footer */
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  footerSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Photo Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 16,
    ...Platform.select({
      web: { boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)' } as any,
      default: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptions: {
    gap: 10,
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  modalOptionPressed: {
    backgroundColor: '#F1F5F9',
  },
  modalOptionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalOptionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
