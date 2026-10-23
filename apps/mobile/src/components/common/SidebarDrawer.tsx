import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { UserInfo } from '../../api';
import { showToast } from '../../context/ToastContext';

export interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo | null;
  firmName?: string;
  contractorName?: string;
  avatarUri?: string | null;
  initials?: string;
  onNavigateTab: (tabKey: string) => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onShareReport?: () => void;
}

export function SidebarDrawer({
  isOpen,
  onClose,
  user,
  firmName = 'ThekaBook Business',
  contractorName,
  avatarUri,
  initials = 'CB',
  onNavigateTab,
  onOpenProfile,
  onLogout,
  onShareReport,
}: SidebarDrawerProps) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(320, width * 0.82);

  const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: -drawerWidth,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isOpen, drawerWidth, fadeAnim, slideAnim]);

  if (!isOpen) return null;

  const rawName = contractorName || user?.name || 'Contractor';
  const displayName = rawName;

  const handleItemPress = (action: () => void) => {
    onClose();
    setTimeout(() => {
      action();
    }, 150);
  };

  const handleWhatsAppSupport = () => {
    const text = `Namaste ThekaBook Support Team, mujhe app related help chahiye (Contractor: ${rawName}, Phone: ${user?.phone || 'N/A'})`;
    const url = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(text)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        showToast('WhatsApp not installed', 'w');
      });
    }
  };

  const handleShareReferral = () => {
    const msg = `Bhai, ThekaBook app use kar — Apni sites ka hisaab, mazdoor haziri, aur material bill manage karne ke liye best app hai! Download link: https://thekabook.com/invite?ref=${user?.phone || 'contractor'}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        showToast('Referral link copied to clipboard!', 's');
      });
    }
  };


  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
        {/* Dark Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>

        {/* Sliding Sidebar Panel */}
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              width: drawerWidth,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* ========================================================= */}
          {/* 1. TOP SECTION: USER & BUSINESS PROFILE CARD */}
          {/* ========================================================= */}
          <View style={styles.profileHeaderCard}>
            {/* Close Button at top-right */}
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="#0F172A" />
            </Pressable>

            <View style={styles.avatarRow}>
              {/* Profile Avatar with Online Dot */}
              <View style={styles.avatarWrap}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.profileTextWrap}>
                <Text style={styles.contractorName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.firmName} numberOfLines={1}>
                  {firmName}
                </Text>
                {user?.phone ? (
                  <Text style={styles.phoneText}>+91 {user.phone}</Text>
                ) : null}
              </View>
            </View>



          </View>

          {/* ========================================================= */}
          {/* 2. MIDDLE SECTION: MENU ITEMS & NAVIGATION LINKS */}
          {/* ========================================================= */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.menuSectionHeader}>MANAGEMENT & WORKSPACE</Text>

            {/* Sites */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(() => onNavigateTab('sites'))}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="business" size={18} color="#2563EB" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Work Sites</Text>
                <Text style={styles.menuItemSub}>Site balance, parties & material</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
            </Pressable>

            {/* Labour / Team */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(() => onNavigateTab('team'))}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="people" size={18} color="#16A34A" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Labour & Team</Text>
                <Text style={styles.menuItemSub}>Workers, rates & ID cards</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
            </Pressable>

            {/* Ledger Hisaab */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(() => onNavigateTab('ledger'))}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="receipt" size={18} color="#D97706" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Hisaab Ledger</Text>
                <Text style={styles.menuItemSub}>Daily khata & cash flow</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
            </Pressable>

            {/* Reports */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(() => onShareReport?.() || onNavigateTab('reports'))}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="document-text" size={18} color="#9333EA" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>PDF Reports</Text>
                <Text style={styles.menuItemSub}>Statements & balance sheets</Text>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>PDF</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Text style={styles.menuSectionHeader}>PREFERENCES & SUPPORT</Text>

            {/* Bank Accounts & UPI */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(() => onNavigateTab('banks'))}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="card-outline" size={18} color="#16A34A" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Bank Accounts & UPI</Text>
                <Text style={styles.menuItemSub}>Settlement accounts & QR details</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
            </Pressable>

            {/* Settings */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(() => onNavigateTab('settings'))}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="settings-outline" size={18} color="#475569" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Settings</Text>
                <Text style={styles.menuItemSub}>Business profile, bank & sync</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
            </Pressable>

            {/* Refer & Earn ₹120 */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(handleShareReferral)}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="gift" size={18} color="#059669" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>Refer & Earn</Text>
                <Text style={styles.menuItemSub}>Get ₹120 for each contractor friend</Text>
              </View>
              <View style={styles.rewardPill}>
                <Text style={styles.rewardPillText}>₹120</Text>
              </View>
            </Pressable>

            {/* WhatsApp Help */}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
              onPress={() => handleItemPress(handleWhatsAppSupport)}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuItemTitle}>WhatsApp Help & Support</Text>
                <Text style={styles.menuItemSub}>Direct chat with support team</Text>
              </View>
              <Ionicons name="open-outline" size={15} color="#94A3B8" />
            </Pressable>
          </ScrollView>

          {/* ========================================================= */}
          {/* 3. BOTTOM SECTION: LOGOUT & VERSION FOOTER */}
          {/* ========================================================= */}
          <View style={styles.drawerFooter}>
            <Pressable
              onPress={() => handleItemPress(() => onLogout?.())}
              style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
            >
              <Ionicons name="log-out-outline" size={19} color="#DC2626" />
              <Text style={styles.logoutBtnText}>Log Out Account</Text>
            </Pressable>

            <Text style={styles.versionText}>ThekaBook v2.4.0 • Made with ❤️ in India</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 1,
  },
  backdropPressable: {
    flex: 1,
  },
  drawerPanel: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '8px 0 30px rgba(0, 0, 0, 0.25)',
      },
      default: {
        elevation: 16,
      },
    }),
  },

  /* 1. Profile Top Card (Matching Premium Light Theme) */
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: Platform.OS === 'ios' ? 48 : 28,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    position: 'relative',
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' },
      default: { elevation: 2 },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileTextWrap: {
    flex: 1,
    paddingRight: 30,
  },
  contractorName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  firmName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  phoneText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  verifiedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  viewProfileBtnText: {
    flex: 1,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },

  /* 2. Menu Links */
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  menuSectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
    marginTop: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  menuItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  badgePill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9333EA',
  },
  rewardPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rewardPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
    marginHorizontal: 6,
  },

  /* 3. Footer */
  drawerFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  logoutBtnPressed: {
    opacity: 0.8,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  versionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
  },

  itemPressed: {
    opacity: 0.75,
    backgroundColor: '#F8FAFC',
  },
});
