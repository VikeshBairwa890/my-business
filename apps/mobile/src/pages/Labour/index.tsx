import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Linking,
  useWindowDimensions,
  BackHandler,
  Image,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { money, workerSummary } from '../../finance';
import { WorkerDetailPage } from './WorkerDetailPage';
import { WorkerIdCardModal } from '../../components/workers/WorkerIdCardModal';
import { useLanguage } from '../../i18n';

export interface LabourPageProps {
  data: Snapshot;
  selectedWorkerId?: string | null;
  fromNotifications?: boolean;
  onBackFromDetail?: () => void;
  onSelectWorker?: (workerId: string | null) => void;
  onOpenWorkerModal: (worker?: Row) => void;
  onOpenPaymentModal: (workerId: string) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

const AVATAR_PALETTES = [
  { bg: '#EFF6FF', text: '#1E40AF' }, // Blue
  { bg: '#ECFDF5', text: '#065F46' }, // Emerald
  { bg: '#F5F3FF', text: '#5B21B6' }, // Purple
  { bg: '#FFFBEB', text: '#92400E' }, // Amber
  { bg: '#FFF1F2', text: '#9F1239' }, // Rose
  { bg: '#F0FDF4', text: '#166534' }, // Green
  { bg: '#F8FAFC', text: '#334155' }, // Slate
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'W';
}

function getSkillIcon(skill: string = ''): string {
  const s = skill.toLowerCase();
  if (s.includes('mason') || s.includes('mistri') || s.includes('raj')) return 'construct';
  if (s.includes('paint')) return 'color-palette';
  if (s.includes('carpent') || s.includes('wood')) return 'cut';
  if (s.includes('electr') || s.includes('bijli')) return 'flash';
  if (s.includes('plumb') || s.includes('pipe')) return 'water';
  if (s.includes('weld') || s.includes('loha') || s.includes('steel')) return 'hammer';
  if (s.includes('supervis') || s.includes('thekadar')) return 'briefcase';
  if (s.includes('help') || s.includes('mazdoor') || s.includes('labour')) return 'people';
  return 'person';
}

export function LabourPage({
  data,
  selectedWorkerId: controlledWorkerId,
  fromNotifications = false,
  onBackFromDetail,
  onSelectWorker,
  onOpenWorkerModal,
  onOpenPaymentModal,
  onOpenProfile,
  onBack,
  refreshing,
  onRefresh,
}: LabourPageProps) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [internalWorkerId, setInternalWorkerId] = useState<string | null>(null);
  const [idCardWorker, setIdCardWorker] = useState<Row | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const activeWorkerId = controlledWorkerId !== undefined ? controlledWorkerId : internalWorkerId;
  const selectedWorker = useMemo(() => {
    if (!activeWorkerId) return null;
    return data.workers.find((w) => w.id === activeWorkerId) || null;
  }, [data.workers, activeWorkerId]);

  const handleSelectWorker = (wId: string | null) => {
    if (onSelectWorker) {
      onSelectWorker(wId);
    } else {
      setInternalWorkerId(wId);
    }
  };

  // Handle Android back button when viewing worker detail
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!selectedWorker) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleSelectWorker(null);
      return true;
    });
    return () => backSub.remove();
  }, [selectedWorker]);

  // Financial aggregates & worker summaries
  const {
    totalEarned,
    totalPendingWages,
    totalAdvances,
    pendingCount,
    advanceCount,
    activeCount,
    totalWorkers,
    workerSummariesMap,
    workerAttendanceMap,
  } = useMemo(() => {
    let earnedSum = 0;
    let pendingSum = 0;
    let advanceSum = 0;
    let pendingC = 0;
    let advanceC = 0;
    let activeC = 0;

    const sMap = new Map<string, any>();
    const aMap = new Map<string, { days: number; otMinutes: number }>();

    // Precompute attendance by worker
    for (const a of data.attendance) {
      const cur = aMap.get(a.worker_id) || { days: 0, otMinutes: 0 };
      cur.days += Number(a.units || 0);
      cur.otMinutes += Number(a.overtime_minutes || 0);
      aMap.set(a.worker_id, cur);
    }

    for (const w of data.workers) {
      if (w.active) activeC++;

      const s = workerSummary(w, data.attendance, data.entries);
      sMap.set(w.id, s);

      earnedSum += s.earned;
      if (s.balance > 0) {
        pendingSum += s.balance;
        pendingC++;
      } else if (s.balance < 0) {
        advanceSum += -s.balance;
        advanceC++;
      }
    }

    return {
      totalEarned: earnedSum,
      totalPendingWages: pendingSum,
      totalAdvances: advanceSum,
      pendingCount: pendingC,
      advanceCount: advanceC,
      activeCount: activeC,
      totalWorkers: data.workers.length,
      workerSummariesMap: sMap,
      workerAttendanceMap: aMap,
    };
  }, [data.workers, data.attendance, data.entries]);

  // Filtered & sorted workers list
  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.workers
      .filter((w) => {
        if (!q) return true;
        const matchName = w.name?.toLowerCase().includes(q);
        const matchSkill = w.skill?.toLowerCase().includes(q);
        const matchPhone = w.phone?.toLowerCase().includes(q);
        return matchName || matchSkill || matchPhone;
      })
      .sort((a, b) => {
        // Active first, then highest pending balance
        if (a.active !== b.active) return a.active ? -1 : 1;
        const sumA = workerSummariesMap.get(a.id) || { balance: 0 };
        const sumB = workerSummariesMap.get(b.id) || { balance: 0 };
        return sumB.balance - sumA.balance;
      });
  }, [data.workers, search, workerSummariesMap]);

  // If a worker is selected, render full detail page instead of list
  if (selectedWorker) {
    return (
      <WorkerDetailPage
        worker={selectedWorker}
        data={data}
        onBack={fromNotifications && onBackFromDetail ? onBackFromDetail : () => handleSelectWorker(null)}
        onOpenPaymentModal={(wId) => {
          handleSelectWorker(null);
          onOpenPaymentModal(wId);
        }}
        onOpenWorkerModal={(w) => {
          handleSelectWorker(null);
          onOpenWorkerModal(w);
        }}
      />
    );
  }

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title={t('labourTitle', 'Labour & Team')}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
        actions={
          <Pressable
            onPress={() => onOpenWorkerModal()}
            style={({ pressed }) => [
              styles.navActionBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            accessibilityLabel="Add new worker"
          >
            <Text style={styles.navActionBtnText}>{t('addWorker', 'Add Worker')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.container}>
          {/* Compact Fixed-Size 4 Metric Cards (Overflow-Proof) */}
          {(() => {
            const metricItems = [
              {
                key: 'earned',
                label: t('totalWagesEarned', 'Total Earned'),
                value: money(totalEarned),
                foot: t('acrossAllTime', 'All time'),
                icon: 'cash-outline',
                iconColor: '#1E40AF',
                valueColor: '#0F172A',
              },
              {
                key: 'pending',
                label: t('pendingWages', 'Pending Wages'),
                value: money(totalPendingWages),
                foot: `${pendingCount} ${lang === 'hi' ? 'बाकी' : 'to pay'}`,
                icon: 'time-outline',
                iconColor: '#D97706',
                valueColor: totalPendingWages > 0 ? '#B45309' : '#0F172A',
              },
              {
                key: 'advance',
                label: t('workerAdvances', 'Advances'),
                value: money(totalAdvances),
                foot: `${advanceCount} ${lang === 'hi' ? 'मजदूर' : 'workers'}`,
                icon: 'arrow-forward-outline',
                iconColor: '#2563EB',
                valueColor: totalAdvances > 0 ? '#1D4ED8' : '#0F172A',
              },
              {
                key: 'active',
                label: t('activeWorkforce', 'Active Team'),
                value: `${activeCount} / ${totalWorkers}`,
                foot: `${Math.round((activeCount / (totalWorkers || 1)) * 100)}% ${lang === 'hi' ? 'सक्रिय' : 'active'}`,
                icon: 'people-outline',
                iconColor: '#16A34A',
                valueColor: '#15803D',
              },
            ];

            const renderMiniCard = (item: (typeof metricItems)[number]) => (
              <View key={item.key} style={styles.miniCard}>
                <View style={styles.miniCardHeader}>
                  <Text style={styles.miniCardLabel} numberOfLines={1} ellipsizeMode="tail">
                    {item.label}
                  </Text>
                  <AppIcon name={item.icon} size={13} color={item.iconColor} />
                </View>
                <Text
                  style={[styles.miniCardValue, { color: item.valueColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  ellipsizeMode="tail"
                >
                  {item.value}
                </Text>
                <Text style={styles.miniCardFoot} numberOfLines={1} ellipsizeMode="tail">
                  {item.foot}
                </Text>
              </View>
            );

            return isDesktop ? (
              <View style={[styles.miniGridRow, { marginBottom: 12 }]}>
                {metricItems.map(renderMiniCard)}
              </View>
            ) : (
              <View style={styles.miniGridWrap}>
                <View style={styles.miniGridRow}>
                  {renderMiniCard(metricItems[0])}
                  {renderMiniCard(metricItems[1])}
                </View>
                <View style={styles.miniGridRow}>
                  {renderMiniCard(metricItems[2])}
                  {renderMiniCard(metricItems[3])}
                </View>
              </View>
            );
          })()}

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={t('searchWorkerPlaceholder', 'Search worker by name, skill (mason, helper) or phone…')}
            />
          </View>

          {/* Workers List */}
          <View style={styles.list}>
            {filteredWorkers.map((w) => {
              const avatarTheme = getAvatarStyle(w.name);

              return (
                <View
                  key={w.id}
                  style={styles.workerRowItem}
                >
                  {/* Left Side: Avatar Image + Name */}
                  <View style={styles.workerRowLeft}>
                    <View
                      style={[
                        styles.avatarBox,
                        { backgroundColor: w.photo ? '#FFFFFF' : avatarTheme.bg },
                      ]}
                    >
                      {w.photo ? (
                        <Image source={{ uri: w.photo }} style={styles.avatarImg} />
                      ) : (
                        <Text style={[styles.avatarText, { color: avatarTheme.text }]}>
                          {getInitials(w.name)}
                        </Text>
                      )}
                      {w.active ? (
                        <View style={styles.statusDotRing} />
                      ) : (
                        <View style={styles.statusCrossRing}>
                          <AppIcon name="close" size={9} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    <View style={styles.workerInfoCol}>
                      <View style={styles.nameRow}>
                        <Text style={styles.workerNameText} numberOfLines={1}>
                          {w.name}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Side: ID Pass & View Buttons */}
                  <View style={styles.workerRowRight}>
                    <Pressable
                      onPress={() => setIdCardWorker(w)}
                      style={({ pressed }) => [
                        styles.idCardActionBtn,
                        pressed && styles.viewActionBtnPressed,
                      ]}
                      accessibilityLabel={`ID card for ${w.name}`}
                    >
                      <AppIcon name="id-card" size={13} color="#475569" />
                      <Text style={styles.idCardActionBtnText}>{lang === 'hi' ? 'कार्ड' : 'Card'}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleSelectWorker(w.id)}
                      style={({ pressed }) => [
                        styles.viewActionBtn,
                        pressed && styles.viewActionBtnPressed,
                      ]}
                      accessibilityLabel={`View details for ${w.name}`}
                    >
                      <AppIcon name="eye-outline" size={15} color="#2563EB" />
                      <Text style={styles.viewActionBtnText}>{t('view', 'View')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {filteredWorkers.length === 0 ? (
              <EmptyState
                title={search ? t('noMatchingWorkers', 'No Matching Workers') : t('noWorkersAddedYet', 'No Workers Added Yet')}
                description={
                  search
                    ? (lang === 'hi' ? 'आपकी खोज के अनुसार कोई मजदूर नहीं मिला।' : 'No workers found matching your search term.')
                    : (lang === 'hi' ? 'दैनिक हाजिरी और मजदूरी का हिसाब रखने के लिए मिस्त्री, हेल्पर और कारीगर जोड़ें।' : 'Add masons, helpers, and carpenters to track daily attendance and wages.')
                }
                actionTitle={search ? t('clearSearch', 'Clear Search') : t('addFirstWorker', '+ Add First Worker')}
                onAction={search ? () => setSearch('') : () => onOpenWorkerModal()}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      <WorkerIdCardModal
        visible={!!idCardWorker}
        worker={idCardWorker}
        data={data}
        onClose={() => setIdCardWorker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  navActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 110,
  },
  container: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  miniGridWrap: {
    gap: 8,
    marginBottom: 12,
  },
  miniGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  miniCard: {
    flex: 1,
    minWidth: 0,
    height: 68,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  miniCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  miniCardLabel: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  miniCardValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  miniCardFoot: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  searchSection: {
    marginBottom: 14,
  },
  list: {
    gap: 8,
  },
  workerRowItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 10,
  },
  workerRowItemPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  workerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusDotRing: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  statusCrossRing: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  workerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  designationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    gap: 4,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexShrink: 1,
    maxWidth: '58%',
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  rateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  dueBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  dueBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#92400E',
  },
  advBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  advBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  workerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconBtnCall: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#F8FAFC',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  idCardActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 9,
    resizeMode: 'cover',
    backgroundColor: '#FFFFFF',
  },
  viewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  viewActionBtnPressed: {
    backgroundColor: '#DBEAFE',
    transform: [{ scale: 0.96 }],
  },
  viewActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
});

export { WorkerDetailPage } from './WorkerDetailPage';
export { EditWorkerPage } from './EditWorkerPage';
