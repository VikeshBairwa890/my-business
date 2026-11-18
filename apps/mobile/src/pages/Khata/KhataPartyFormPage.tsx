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
} from 'react-native';
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
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          {/* Main Person Details Card */}
          <View style={styles.card}>
            {/* Clean Live Initials Header */}
            <View style={styles.identityRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {formatNameInitials(name, 'P')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {name.trim() || 'New Person'}
                </Text>
                {phone.trim() ? (
                  <Text style={styles.identitySub}>+91 {phone.trim()}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

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
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  identityName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  identitySub: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
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
});
