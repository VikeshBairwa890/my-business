import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { showToast } from '../../context/ToastContext';

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'Current' | 'Savings' | 'Cash Credit (CC)';
  upiId?: string;
  isPrimary: boolean;
}

export interface BanksPageProps {
  data?: Snapshot | null;
  onBack: () => void;
  onNavigateTab?: (tabKey: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const STORAGE_KEY = 'thekabook_bank_accounts_v1';
const PROFILE_KEY = 'thekabook_contractor_profile_v3';

const POPULAR_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Canara Bank',
];

export function BanksPage({
  data,
  onBack,
  onNavigateTab,
  onRefresh,
  refreshing = false,
}: BanksPageProps) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountType, setAccountType] = useState<'Current' | 'Savings' | 'Cash Credit (CC)'>('Current');
  const [upiId, setUpiId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Load accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        let storedStr: string | null = null;
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          storedStr = localStorage.getItem(STORAGE_KEY);
        } else {
          storedStr = await SecureStore.getItemAsync(STORAGE_KEY);
        }

        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAccounts(parsed);
            return;
          }
        }

        // If no bank accounts yet, check Profile storage or initialize sample account
        let defaultAccounts: BankAccount[] = [];
        let profileStr: string | null = null;
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          profileStr = localStorage.getItem(PROFILE_KEY) || localStorage.getItem('thekabook_contractor_profile_v2');
        } else {
          profileStr = await SecureStore.getItemAsync(PROFILE_KEY);
        }

        if (profileStr) {
          const prof = JSON.parse(profileStr);
          if (prof.bankName || prof.accountNumber) {
            defaultAccounts.push({
              id: 'bank-profile-primary',
              bankName: prof.bankName || 'State Bank of India',
              accountHolder: prof.contractorName || data?.user?.name || 'Contractor',
              accountNumber: prof.accountNumber || '389201948291',
              ifscCode: prof.ifscCode || 'SBIN0001234',
              accountType: 'Current',
              upiId: prof.upiId || 'contractor@upi',
              isPrimary: true,
            });
          }
        }

        if (defaultAccounts.length === 0) {
          defaultAccounts = [
            {
              id: 'bank-default-1',
              bankName: 'State Bank of India',
              accountHolder: data?.user?.name || 'Rajesh Sharma',
              accountNumber: '392019482910',
              ifscCode: 'SBIN0004521',
              accountType: 'Current',
              upiId: 'sharmaconstruction@sbi',
              isPrimary: true,
            },
          ];
        }

        setAccounts(defaultAccounts);
        saveAccountsToStorage(defaultAccounts);
      } catch {}
    }
    loadAccounts();
  }, [data]);

  // Persist accounts
  const saveAccountsToStorage = async (list: BankAccount[]) => {
    try {
      const json = JSON.stringify(list);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, json);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, json);
      }
    } catch {}
  };

  // Open modal for new account
  const handleOpenAdd = () => {
    setEditingId(null);
    setBankName('');
    setAccountHolder(data?.user?.name || '');
    setAccountNumber('');
    setIfscCode('');
    setAccountType('Current');
    setUpiId('');
    setIsPrimary(accounts.length === 0);
    setModalVisible(true);
  };

  // Open modal for editing
  const handleOpenEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setBankName(acc.bankName);
    setAccountHolder(acc.accountHolder);
    setAccountNumber(acc.accountNumber);
    setIfscCode(acc.ifscCode);
    setAccountType(acc.accountType);
    setUpiId(acc.upiId || '');
    setIsPrimary(acc.isPrimary);
    setModalVisible(true);
  };

  // Save account
  const handleSaveAccount = () => {
    if (!bankName.trim()) {
      showToast('Please enter bank name', 'w');
      return;
    }
    if (!accountNumber.trim()) {
      showToast('Please enter account number', 'w');
      return;
    }
    if (!ifscCode.trim()) {
      showToast('Please enter IFSC code', 'w');
      return;
    }

    let updated: BankAccount[] = [];

    if (editingId) {
      updated = accounts.map((item) => {
        if (item.id === editingId) {
          return {
            ...item,
            bankName: bankName.trim(),
            accountHolder: accountHolder.trim() || 'Contractor',
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            accountType,
            upiId: upiId.trim() || undefined,
            isPrimary,
          };
        }
        return isPrimary ? { ...item, isPrimary: false } : item;
      });
      showToast('Bank account updated successfully', 's');
    } else {
      const newAcc: BankAccount = {
        id: `bank-${Date.now()}`,
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim() || 'Contractor',
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        accountType,
        upiId: upiId.trim() || undefined,
        isPrimary: isPrimary || accounts.length === 0,
      };

      if (newAcc.isPrimary) {
        updated = [newAcc, ...accounts.map((a) => ({ ...a, isPrimary: false }))];
      } else {
        updated = [...accounts, newAcc];
      }
      showToast('Bank account saved successfully', 's');
    }

    setAccounts(updated);
    saveAccountsToStorage(updated);
    setModalVisible(false);
  };

  // Delete account
  const handleDeleteAccount = (id: string) => {
    const target = accounts.find((a) => a.id === id);
    const confirmDelete = () => {
      let filtered = accounts.filter((a) => a.id !== id);
      if (target?.isPrimary && filtered.length > 0) {
        filtered[0].isPrimary = true;
      }
      setAccounts(filtered);
      saveAccountsToStorage(filtered);
      showToast('Account removed', 's');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this bank account?')) {
        confirmDelete();
      }
    } else {
      Alert.alert('Delete Account', 'Are you sure you want to remove this bank account?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  // Set as primary
  const handleSetPrimary = (id: string) => {
    const updated = accounts.map((a) => ({
      ...a,
      isPrimary: a.id === id,
    }));
    setAccounts(updated);
    saveAccountsToStorage(updated);
    showToast('Default bank account updated', 's');
  };

  // Toggle reveal account number
  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard!`, 's');
    } else {
      showToast(`${label}: ${text}`, 'i');
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* 1. STANDARDIZED TOP NAVBAR */}
      <TopNavBar
        title="Bank Accounts & UPI"
        subtitle="Manage business bank accounts & settlement details"
        onBack={onBack}
        actions={
          <Pressable
            style={({ pressed }) => [styles.addNavBtn, pressed && styles.btnPressed]}
            onPress={handleOpenAdd}
          >
            <Ionicons name="add" size={17} color="#2563EB" />
            <Text style={styles.addNavBtnText}>Add Bank</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Informational Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
          <Text style={styles.infoBannerText}>
            Primary bank details will automatically be printed on client bill invoices, PDF statements, and payment receipts.
          </Text>
        </View>

        {/* 2. LIST OF SAVED BANK ACCOUNTS */}
        {accounts.map((acc) => {
          const isRevealed = revealedIds.has(acc.id);
          const maskedNumber =
            acc.accountNumber.length > 4
              ? `•••• •••• ${acc.accountNumber.slice(-4)}`
              : acc.accountNumber;

          return (
            <View
              key={acc.id}
              style={[
                styles.bankCard,
                acc.isPrimary && styles.bankCardPrimary,
              ]}
            >
              {/* Card Header: Bank Name + Primary Tag */}
              <View style={styles.cardHeader}>
                <View style={styles.bankTitleRow}>
                  <View style={[styles.bankLogoCircle, acc.isPrimary && styles.bankLogoPrimary]}>
                    <Ionicons name="business" size={18} color={acc.isPrimary ? '#FFFFFF' : '#1E293B'} />
                  </View>
                  <View>
                    <Text style={styles.bankNameText} numberOfLines={1}>
                      {acc.bankName}
                    </Text>
                    <Text style={styles.accountTypeSub}>
                      {acc.accountType} Account
                    </Text>
                  </View>
                </View>

                {acc.isPrimary ? (
                  <View style={styles.primaryBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.setPrimaryBtn, pressed && styles.btnPressed]}
                    onPress={() => handleSetPrimary(acc.id)}
                  >
                    <Text style={styles.setPrimaryBtnText}>Make Default</Text>
                  </Pressable>
                )}
              </View>

              {/* Account Number Row */}
              <View style={styles.accNumberRow}>
                <View style={styles.accNumberTextWrap}>
                  <Text style={styles.fieldLabel}>ACCOUNT NUMBER</Text>
                  <Text style={styles.accNumberText}>
                    {isRevealed ? acc.accountNumber : maskedNumber}
                  </Text>
                </View>

                <View style={styles.iconActionsRow}>
                  <Pressable
                    style={styles.smallIconBtn}
                    onPress={() => toggleReveal(acc.id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#64748B"
                    />
                  </Pressable>

                  <Pressable
                    style={styles.smallIconBtn}
                    onPress={() => handleCopy(acc.accountNumber, 'Account number')}
                    hitSlop={8}
                  >
                    <Ionicons name="copy-outline" size={18} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              {/* Two Column Grid: Holder & IFSC */}
              <View style={styles.cardDetailsGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.fieldLabel}>A/C HOLDER</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {acc.accountHolder}
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.fieldLabel}>IFSC CODE</Text>
                  <Pressable
                    style={styles.ifscCopyRow}
                    onPress={() => handleCopy(acc.ifscCode, 'IFSC Code')}
                  >
                    <Text style={styles.ifscCodeText}>{acc.ifscCode}</Text>
                    <Ionicons name="copy-outline" size={13} color="#2563EB" />
                  </Pressable>
                </View>
              </View>

              {/* UPI ID Row (if provided) */}
              {acc.upiId ? (
                <View style={styles.upiRow}>
                  <Ionicons name="qr-code-outline" size={14} color="#D97706" />
                  <Text style={styles.upiLabel}>UPI / VPA:</Text>
                  <Text style={styles.upiValueText} numberOfLines={1}>
                    {acc.upiId}
                  </Text>
                  <Pressable
                    onPress={() => handleCopy(acc.upiId || '', 'UPI ID')}
                    hitSlop={6}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Ionicons name="copy-outline" size={14} color="#64748B" />
                  </Pressable>
                </View>
              ) : null}

              {/* Card Footer: Edit & Delete */}
              <View style={styles.cardFooter}>
                <Pressable
                  style={({ pressed }) => [styles.actionLinkBtn, pressed && styles.btnPressed]}
                  onPress={() => handleOpenEdit(acc)}
                >
                  <Ionicons name="create-outline" size={15} color="#2563EB" />
                  <Text style={styles.actionLinkText}>Edit</Text>
                </Pressable>

                {accounts.length > 1 ? (
                  <Pressable
                    style={({ pressed }) => [styles.actionLinkBtn, pressed && styles.btnPressed]}
                    onPress={() => handleDeleteAccount(acc.id)}
                  >
                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    <Text style={[styles.actionLinkText, { color: '#DC2626' }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        {/* Big Add Account Button */}
        <Pressable
          style={({ pressed }) => [styles.bigAddBtn, pressed && styles.btnPressed]}
          onPress={handleOpenAdd}
        >
          <Ionicons name="add-circle" size={20} color="#2563EB" />
          <Text style={styles.bigAddBtnText}>Add Another Bank Account</Text>
        </Pressable>
      </ScrollView>

      {/* ========================================================= */}
      {/* 3. ADD / EDIT BANK ACCOUNT MODAL                          */}
      {/* ========================================================= */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingId ? 'Edit Bank Account' : 'Add Bank Account'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  For client payments & billing settlement
                </Text>
              </View>

              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Popular Banks Chips */}
              <Text style={styles.inputLabel}>QUICK SELECT BANK</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankChipsScroll}>
                {POPULAR_BANKS.map((b) => (
                  <Pressable
                    key={b}
                    style={[
                      styles.bankChip,
                      bankName === b && styles.bankChipSelected,
                    ]}
                    onPress={() => setBankName(b)}
                  >
                    <Text
                      style={[
                        styles.bankChipText,
                        bankName === b && styles.bankChipTextSelected,
                      ]}
                    >
                      {b}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Bank Name Field */}
              <Text style={styles.inputLabel}>BANK NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. State Bank of India"
                placeholderTextColor="#94A3B8"
                value={bankName}
                onChangeText={setBankName}
              />

              {/* Account Holder Name */}
              <Text style={styles.inputLabel}>ACCOUNT HOLDER NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Contractor / Firm Name"
                placeholderTextColor="#94A3B8"
                value={accountHolder}
                onChangeText={setAccountHolder}
              />

              {/* Account Number */}
              <Text style={styles.inputLabel}>ACCOUNT NUMBER *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 392019482910"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={accountNumber}
                onChangeText={setAccountNumber}
              />

              {/* IFSC Code */}
              <Text style={styles.inputLabel}>IFSC CODE *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. SBIN0001234"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={ifscCode}
                onChangeText={(val) => setIfscCode(val.toUpperCase())}
              />

              {/* Account Type Selector */}
              <Text style={styles.inputLabel}>ACCOUNT TYPE</Text>
              <View style={styles.typeSelectorRow}>
                {(['Current', 'Savings', 'Cash Credit (CC)'] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[
                      styles.typeOptionBtn,
                      accountType === t && styles.typeOptionBtnActive,
                    ]}
                    onPress={() => setAccountType(t)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        accountType === t && styles.typeOptionTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* UPI ID */}
              <Text style={styles.inputLabel}>UPI ID / VPA (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. sharma@upi or 9876543210@paytm"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                value={upiId}
                onChangeText={setUpiId}
              />

              {/* Default Account Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchTitle}>Make Primary Account</Text>
                  <Text style={styles.switchSub}>
                    Used as the default settlement account for client payments
                  </Text>
                </View>
                <Switch
                  value={isPrimary}
                  onValueChange={setIsPrimary}
                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.cancelModalBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.saveModalBtn}
                onPress={handleSaveAccount}
              >
                <Text style={styles.saveModalBtnText}>Save Account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  addNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  addNavBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
    gap: 9,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
    fontWeight: '500',
  },

  /* Bank Card */
  bankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' },
      default: { elevation: 2 },
    }),
  },
  bankCardPrimary: {
    borderColor: '#93C5FD',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  bankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  bankLogoCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogoPrimary: {
    backgroundColor: '#2563EB',
  },
  bankNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  accountTypeSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  setPrimaryBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  setPrimaryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  /* Number Row */
  accNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  accNumberTextWrap: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  accNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  iconActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallIconBtn: {
    padding: 4,
  },

  /* Grid */
  cardDetailsGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
    paddingRight: 6,
  },
  fieldValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  ifscCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ifscCodeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2563EB',
  },

  /* UPI Row */
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 10,
  },
  upiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  upiValueText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 16,
  },
  actionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Big Add Button */
  bigAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  bigAddBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    ...Platform.select({
      web: { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)' },
      default: { elevation: 10 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  bankChipsScroll: {
    marginBottom: 10,
  },
  bankChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  bankChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  bankChipTextSelected: {
    color: '#2563EB',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeOptionBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  typeOptionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  typeOptionTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  switchTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveModalBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
