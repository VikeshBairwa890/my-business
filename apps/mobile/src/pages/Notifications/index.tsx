import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot } from '../../types';
import { money } from '../../finance';
import { showToast } from '../../context/ToastContext';
import { openWhatsAppReminder, openSmsReminder } from '../Khata/khataUtils';
import {
  NotificationItem,
  generateNotificationItems,
  getReadNotificationIds,
  saveReadNotificationIds,
} from '../../storage/notificationStorage';

export { NotificationItem };

export interface NotificationsPageProps {
  data?: Snapshot | null;
  onBack: () => void;
  onNavigateTab: (tabKey: string, targetId?: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  readIds?: Set<string>;
  onUpdateReadIds?: (ids: Set<string>) => void;
}

export function NotificationsPage({
  data,
  onBack,
  onNavigateTab,
  onRefresh,
  refreshing = false,
  readIds: externalReadIds,
  onUpdateReadIds,
}: NotificationsPageProps) {
  const [internalReadIds, setInternalReadIds] = useState<Set<string>>(new Set());
  const [remindItem, setRemindItem] = useState<NotificationItem | null>(null);

  // Load persisted read IDs on mount if not provided externally
  useEffect(() => {
    if (!externalReadIds) {
      getReadNotificationIds().then((ids) => {
        setInternalReadIds(ids);
      });
    }
  }, [externalReadIds]);

  const activeReadIds = externalReadIds || internalReadIds;
  const senderName = data?.organization?.name || data?.user?.name || 'ThekaBook';

  // Generate dynamic contextual notifications from current snapshot data
  const rawNotifications: NotificationItem[] = useMemo(() => {
    return generateNotificationItems(data, activeReadIds);
  }, [data, activeReadIds]);

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    const allIds = new Set([...activeReadIds, ...rawNotifications.map((n) => n.id)]);
    setInternalReadIds(allIds);
    if (onUpdateReadIds) {
      onUpdateReadIds(allIds);
    }
    await saveReadNotificationIds(allIds);
    showToast('All notifications marked as read', 's');
  };

  // Toggle Single Read & Navigate
  const handleItemPress = async (item: NotificationItem) => {
    const next = new Set(activeReadIds);
    next.add(item.id);
    setInternalReadIds(next);
    if (onUpdateReadIds) {
      onUpdateReadIds(next);
    }
    await saveReadNotificationIds(next);

    if (item.actionTab) {
      onNavigateTab(item.actionTab, item.targetId);
    }
  };

  const unreadCount = useMemo(() => {
    return rawNotifications.filter((n) => !n.read && !activeReadIds.has(n.id)).length;
  }, [rawNotifications, activeReadIds]);

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'khata':
        return { name: 'alarm-outline' as const, color: '#DC2626', bg: '#FEF2F2' };
      case 'payment':
        return { name: 'arrow-down-circle' as const, color: '#16A34A', bg: '#DCFCE7' };
      case 'wage':
        return { name: 'cash-outline' as const, color: '#D97706', bg: '#FEF3C7' };
      case 'haziri':
        return { name: 'calendar-outline' as const, color: '#2563EB', bg: '#EFF6FF' };
      case 'site':
        return { name: 'business-outline' as const, color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { name: 'shield-checkmark-outline' as const, color: '#059669', bg: '#ECFDF5' };
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* 1. STANDARDIZED PAGE HEADER */}
      <TopNavBar
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
        onBack={onBack}
        actions={
          unreadCount > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.markAllBtn, pressed && styles.btnPressed]}
              onPress={handleMarkAllRead}
            >
              <Ionicons name="checkmark-done" size={14} color="#059669" />
              <Text style={styles.markAllText}>Mark Read</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* 2. NOTIFICATION LIST CONTENT */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#162032" />
          ) : undefined
        }
      >
        {rawNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySub}>
              You have no active alerts right now. New updates will appear here.
            </Text>
          </View>
        ) : (
          rawNotifications.map((item) => {
            const isRead = item.read || activeReadIds.has(item.id);
            const iconConfig = getIconForType(item.type);

            return (
              <Pressable
                key={item.id}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => [
                  styles.notificationCard,
                  !isRead && styles.unreadCard,
                  pressed && styles.cardPressed,
                ]}
              >
                {/* 1. Left Type Icon */}
                <View style={[styles.iconBox, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.name} size={17} color={iconConfig.color} />
                </View>

                {/* 2. Middle Text Info */}
                <View style={styles.cardContent}>
                  <Text
                    style={[styles.itemTitle, !isRead && styles.unreadTitleText]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.itemMessage} numberOfLines={1}>
                    {item.message}
                  </Text>
                </View>

                {/* 3. Right Action & Timestamp Column */}
                <View style={styles.cardRightCol}>
                  <View style={styles.timeAndDotRow}>
                    <Text style={styles.timeText}>{item.timeAgo}</Text>
                    {!isRead && <View style={styles.unreadBlueDot} />}
                  </View>

                  {item.khataSummary ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setRemindItem(item);
                      }}
                      style={({ pressed }) => [
                        styles.compactRemindBtn,
                        pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                      ]}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="notifications-outline" size={12} color="#1E40AF" />
                      <Text style={styles.compactRemindBtnText}>Remind</Text>
                    </Pressable>
                  ) : item.actionTab ? (
                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color="#94A3B8"
                      style={{ marginTop: 4 }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* 3. REMIND CHANNEL PICKER MODAL (WhatsApp or SMS) */}
      {remindItem && remindItem.khataSummary ? (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setRemindItem(null)}
        >
          <Pressable
            style={styles.remindModalBackdrop}
            onPress={() => setRemindItem(null)}
          >
            <Pressable
              style={styles.remindModalCard}
              onPress={(e) => {
                e.stopPropagation?.();
              }}
            >
              {/* Modal Header */}
              <View style={styles.remindModalHeader}>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={styles.remindModalTitle}>Send Reminder</Text>
                  <Text style={styles.remindModalSubtitle} numberOfLines={1}>
                    {remindItem.khataSummary.party.name} • {money(remindItem.khataSummary.balance)}
                  </Text>
                </View>
                <Pressable
                  style={styles.remindModalCloseBtn}
                  onPress={() => setRemindItem(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color="#64748B" />
                </Pressable>
              </View>

              <Text style={styles.remindModalInstruction}>
                Select channel to send payment reminder:
              </Text>

              {/* 1. WhatsApp Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.remindOptionBtn,
                  pressed && styles.remindOptionPressed,
                ]}
                onPress={() => {
                  const ks = remindItem.khataSummary!;
                  setRemindItem(null);
                  openWhatsAppReminder(
                    ks.party,
                    ks.balance,
                    senderName,
                    ks.lastEntryDate,
                    (m) => showToast(m, 'w')
                  );
                }}
              >
                <View style={[styles.remindOptionIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                </View>
                <View style={styles.remindOptionTextWrap}>
                  <Text style={styles.remindOptionTitle}>WhatsApp</Text>
                  <Text style={styles.remindOptionSub}>
                    Send bill reminder on WhatsApp
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
              </Pressable>

              {/* 2. Text SMS Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.remindOptionBtn,
                  pressed && styles.remindOptionPressed,
                ]}
                onPress={() => {
                  const ks = remindItem.khataSummary!;
                  setRemindItem(null);
                  openSmsReminder(
                    ks.party,
                    ks.balance,
                    senderName,
                    ks.lastEntryDate,
                    (m) => showToast(m, 'w')
                  );
                }}
              >
                <View style={[styles.remindOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="chatbubble-ellipses" size={17} color="#2563EB" />
                </View>
                <View style={styles.remindOptionTextWrap}>
                  <Text style={styles.remindOptionTitle}>Text SMS</Text>
                  <Text style={styles.remindOptionSub}>
                    Send SMS message to contact
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
              </Pressable>

              {/* Close Button */}
              <Pressable
                style={styles.remindModalCancelBtn}
                onPress={() => setRemindItem(null)}
              >
                <Text style={styles.remindModalCancelText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* 1. Header Action */
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  /* 2. Compact Notification Cards List */
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 110,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        cursor: 'pointer',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderLeftWidth: 3.5,
    borderLeftColor: '#2563EB',
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 6,
  },
  itemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  unreadTitleText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  itemMessage: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  cardRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 34,
  },
  timeAndDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  unreadBlueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  compactRemindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    marginTop: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  compactRemindBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.1,
  },

  /* 3. Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 5,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  btnPressed: {
    opacity: 0.7,
  },

  /* 4. Compact Remind Channel Picker Modal Styles */
  remindModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  remindModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    ...Platform.select({
      web: { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.16)' } as any,
      default: { elevation: 8 },
    }),
  },
  remindModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  remindModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  remindModalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  remindModalCloseBtn: {
    padding: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  remindModalInstruction: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  remindOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  remindOptionPressed: {
    backgroundColor: '#F1F5F9',
    transform: [{ scale: 0.99 }],
  },
  remindOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  remindOptionTextWrap: {
    flex: 1,
  },
  remindOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  remindOptionSub: {
    fontSize: 10.5,
    color: '#64748B',
  },
  remindModalCancelBtn: {
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  remindModalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
});
