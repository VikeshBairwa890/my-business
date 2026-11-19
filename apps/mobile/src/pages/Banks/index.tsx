import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Switch,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

// Brand colors for Indian banks (fintech aesthetic)
const getBankBrandColor = (bankName: string): string => {
  const lower = (bankName || '').toLowerCase();
  if (lower.includes('state bank') || lower.includes('sbi')) return '#0A3B7E';
  if (lower.includes('hdfc')) return '#004C8F';
  if (lower.includes('icici')) return '#B82C10';
  if (lower.includes('axis')) return '#97144D';
  if (lower.includes('baroda') || lower.includes('bob')) return '#F26522';
  if (lower.includes('punjab') || lower.includes('pnb')) return '#A20000';
  if (lower.includes('kotak')) return '#ED1C24';
  if (lower.includes('canara')) return '#0091DA';
  if (lower.includes('union')) return '#005A9C';
  if (lower.includes('indusind')) return '#8B181B';
  if (lower.includes('yes bank')) return '#003366';
  return '#1E40AF';
};

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
      } catch { }
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
    } catch { }
  };

  const openBankForm = (mode: 'new' | 'edit') => {
    setModalVisible(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const targetUrl = mode === 'edit' ? '/banks/edit' : '/banks/new';
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  };

  const closeBankForm = () => {
    setModalVisible(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.location.pathname !== '/banks') {
        window.history.pushState(null, '', '/banks');
      }
    }
  };

  // Handle browser back on Web for /banks/new or /banks/edit
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPop = () => {
      if (window.location.pathname === '/banks') {
        setModalVisible(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Open dedicated page for new account
  const handleOpenAdd = () => {
    setEditingId(null);
    setBankName('');
    setAccountHolder('');
    setAccountNumber('');
    setIfscCode('');
    setAccountType('Current');
    setUpiId('');
    setIsPrimary(accounts.length === 0);
    openBankForm('new');
  };

  // Open dedicated page for editing
  const handleOpenEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setBankName(acc.bankName);
    setAccountHolder(acc.accountHolder);
    setAccountNumber(acc.accountNumber);
    setIfscCode(acc.ifscCode);
    setAccountType(acc.accountType);
    setUpiId(acc.upiId || '');
    setIsPrimary(acc.isPrimary);
    openBankForm('edit');
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
            accountHolder: accountHolder.trim(),
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
        accountHolder: accountHolder.trim(),
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
    closeBankForm();
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

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Handle Android back button when Add/Edit Bank page is open
  useEffect(() => {
    if (Platform.OS === 'web' || !modalVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeBankForm();
      return true;
    });
    return () => sub.remove();
  }, [modalVisible]);

  // Dedicated Full Page for Add / Edit Bank Account
  if (modalVisible) {
    return (
      <View style={styles.pageContainer}>
        {/* Standard Page Top NavBar */}
        <TopNavBar
          title={editingId ? 'Edit Bank Account' : 'Add Bank Account'}
          onBack={closeBankForm}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.formPageScroll,
              isDesktop && styles.formPageScrollDesktop,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formPageCard}>
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
            </View>
          </ScrollView>

          {/* Sticky 50/50 Footer */}
          <View style={styles.formPageFooter}>
            <View
              style={[
                styles.formPageFooterInner,
                isDesktop && styles.formPageFooterInnerDesktop,
              ]}
            >
              <Pressable
                style={styles.cancelPageBtn}
                onPress={closeBankForm}
              >
                <Text style={styles.cancelPageBtnText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.savePageBtn} onPress={handleSaveAccount}>
                <Text style={styles.savePageBtnText}>Save Account</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

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
            <Text style={styles.addNavBtnText}>Add</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. LIST OF SAVED BANK ACCOUNTS */}
        {accounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="bank-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Bank Accounts Added</Text>
            <Text style={styles.emptySub}>
              Add your business account to show bank details on invoices and receipts.
            </Text>
            <Pressable style={styles.emptyAddBtn} onPress={handleOpenAdd}>
              <Text style={styles.emptyAddBtnText}>Add Bank Account</Text>
            </Pressable>
          </View>
        ) : (
          accounts.map((acc) => {
            const isRevealed = revealedIds.has(acc.id);
            const maskedNumber =
              acc.accountNumber.length > 4
                ? `•••• •••• ${acc.accountNumber.slice(-4)}`
                : acc.accountNumber;
            const bankColor = getBankBrandColor(acc.bankName);

            return (
              <View
                key={acc.id}
                style={[
                  styles.bankCard,
                  acc.isPrimary && styles.bankCardPrimary,
                ]}
              >
                {/* Card Header: Real Bank Icon + Name/Type + Primary Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.bankTitleRow}>
                    <View style={[styles.bankLogoCircle, { backgroundColor: bankColor }]}>
                      <MaterialCommunityIcons
                        name="bank"
                        size={17}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
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
                      <Ionicons name="checkmark-circle" size={11} color="#059669" />
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

                {/* 2-Column Body: Left (Name, A/C No) | Right (IFSC, UPI) */}
                <View style={styles.cardTwoColBody}>
                  {/* Left Column */}
                  <View style={styles.cardCol}>
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>NAME</Text>
                      <Text style={styles.fieldValueBold} numberOfLines={1}>
                        {acc.accountHolder || data?.user?.name || 'Contractor'}
                      </Text>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>A/C NO</Text>
                      <View style={styles.accNumberInlineRow}>
                        <Text style={styles.accNumberText} numberOfLines={1}>
                          {isRevealed ? acc.accountNumber : maskedNumber}
                        </Text>
                        <Pressable
                          style={styles.inlineIconBtn}
                          onPress={() => toggleReveal(acc.id)}
                          hitSlop={6}
                        >
                          <Ionicons
                            name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
                            size={14}
                            color="#64748B"
                          />
                        </Pressable>
                        <Pressable
                          style={styles.inlineIconBtn}
                          onPress={() => handleCopy(acc.accountNumber, 'Account number')}
                          hitSlop={6}
                        >
                          <Ionicons name="copy-outline" size={13} color="#2563EB" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Vertical Divider between Columns */}
                  <View style={styles.cardColDivider} />

                  {/* Right Column */}
                  <View style={styles.cardCol}>
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>IFSC CODE</Text>
                      <Pressable
                        style={styles.inlineCopyRow}
                        onPress={() => handleCopy(acc.ifscCode, 'IFSC Code')}
                        hitSlop={6}
                      >
                        <Text style={styles.ifscCodeText} numberOfLines={1}>{acc.ifscCode}</Text>
                        <Ionicons name="copy-outline" size={11} color="#2563EB" />
                      </Pressable>
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>UPI ID</Text>
                      {acc.upiId ? (
                        <Pressable
                          style={styles.inlineCopyRow}
                          onPress={() => handleCopy(acc.upiId || '', 'UPI ID')}
                          hitSlop={6}
                        >
                          <Text style={styles.upiText} numberOfLines={1}>{acc.upiId}</Text>
                          <Ionicons name="copy-outline" size={11} color="#15803D" />
                        </Pressable>
                      ) : (
                        <Text style={styles.emptyFieldText}>Not set</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Card Footer: Compact Edit & Delete */}
                <View style={styles.cardFooter}>
                  <Pressable
                    style={({ pressed }) => [styles.actionEditBtn, pressed && styles.btnPressed]}
                    onPress={() => handleOpenEdit(acc)}
                    hitSlop={6}
                    accessibilityLabel="Edit bank account"
                  >
                    <Ionicons name="create-outline" size={14} color="#2563EB" />
                  </Pressable>

                  {accounts.length > 1 ? (
                    <Pressable
                      style={({ pressed }) => [styles.actionRemoveBtn, pressed && styles.btnPressed]}
                      onPress={() => handleDeleteAccount(acc.id)}
                    >
                      <Ionicons name="trash-outline" size={12} color="#DC2626" />
                      <Text style={styles.actionRemoveText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* Subtle Bottom Note */}
        <View style={styles.subtleFootnote}>
          <Ionicons name="information-circle-outline" size={13} color="#64748B" />
          <Text style={styles.subtleFootnoteText}>
            Primary bank details will automatically be printed on client bill invoices & receipts.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  formPageHeader: {
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
  formPageBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none' as any } : {}),
  },
  formPageTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  formPageScroll: {
    padding: 14,
    paddingBottom: 28,
  },
  formPageScrollDesktop: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 18,
  },
  formPageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formPageFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formPageFooterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  formPageFooterInnerDesktop: {
    maxWidth: 532,
    alignSelf: 'center',
  },
  cancelPageBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  cancelPageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  savePageBtn: {
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
  savePageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  addNavBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  addNavBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* Bank Card - Sleek Compact Fintech Size */
  bankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' },
      default: { elevation: 2 },
    }),
  },
  bankCardPrimary: {
    borderColor: '#93C5FD',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3.5,
    borderLeftColor: '#1E40AF',
    ...Platform.select({
      web: { boxShadow: '0 3px 12px rgba(30, 64, 175, 0.07)' },
      default: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  bankLogoCircle: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankNameText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  accountTypeBadge: {
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  accountTypeSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  setPrimaryBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  setPrimaryBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },

  /* 2-Column Card Body */
  cardTwoColBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 12,
  },
  cardCol: {
    flex: 1,
    gap: 8,
  },
  cardColDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#F1F5F9',
  },
  fieldBlock: {
    minHeight: 30,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  accNumberInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  inlineIconBtn: {
    padding: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  inlineCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  ifscCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  upiText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
  },
  emptyFieldText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  subtleFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  subtleFootnoteText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 6,
    gap: 8,
  },
  actionEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  actionRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  actionRemoveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 16,
  },
  emptyAddBtn: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
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
