import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { Snapshot, Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';
import { showToast } from '../../context/ToastContext';

export interface DailyHaziriPageProps {
  data: Snapshot;
  onOpenAttendanceModal: (siteId?: string, workerId?: string, existing?: Row) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

// Helpers for date manipulation
const shiftDate = (dateStr: string, days: number): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  } catch {
    return dateStr;
  }
};

const formatDateDisplay = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export function DailyHaziriPage({
  data,
  onOpenAttendanceModal,
  onOpenProfile,
  onBack,
  refreshing,
  onRefresh,
}: DailyHaziriPageProps) {
  const { lang } = useLanguage();
  const currentDate = today();
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [statusFilter, setStatusFilter] = useState<'ALL' | '1' | '0.5' | '0' | 'UNMARKED'>('ALL');
  const [search, setSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const query = search.trim().toLowerCase();

  // Active workers list
  const activeWorkers = useMemo(
    () => (data.workers || []).filter((w) => w.active),
    [data.workers]
  );

  // Attendance records for the selected date
  const selectedDateRecords = useMemo(() => {
    return (data.attendance || []).filter(
      (a) => String(a.date).slice(0, 10) === selectedDate
    );
  }, [data.attendance, selectedDate]);

  // Statistics for selected date
  const stats = useMemo(() => {
    const presentRecords = selectedDateRecords.filter((a) => Number(a.units) === 1);
    const halfDayRecords = selectedDateRecords.filter((a) => Number(a.units) === 0.5);
    const absentRecords = selectedDateRecords.filter((a) => Number(a.units) === 0);
    const totalWage = selectedDateRecords.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const markedWorkerIds = new Set(selectedDateRecords.map((a) => a.worker_id));
    const pendingCount = activeWorkers.filter((w) => !markedWorkerIds.has(w.id)).length;

    return {
      present: presentRecords.length,
      halfDay: halfDayRecords.length,
      absent: absentRecords.length,
      totalWage,
      pendingCount,
      totalActive: activeWorkers.length,
      markedCount: selectedDateRecords.length,
    };
  }, [selectedDateRecords, activeWorkers]);

  // Unified Workers List (with attendance details attached)
  const workerList = useMemo(() => {
    const list = activeWorkers.map((w) => {
      const record = selectedDateRecords.find((a) => a.worker_id === w.id);
      const isMarked = Boolean(record);
      const units = record ? Number(record.units) : null;
      const statusType: 'PRESENT' | 'HALF' | 'ABSENT' | 'UNMARKED' = !isMarked
        ? 'UNMARKED'
        : units === 1
          ? 'PRESENT'
          : units === 0.5
            ? 'HALF'
            : 'ABSENT';
      return {
        worker: w,
        record,
        isMarked,
        units,
        statusType,
      };
    });

    let filtered = list;

    // Filter by status tab
    if (statusFilter === '1') {
      filtered = filtered.filter((i) => i.statusType === 'PRESENT');
    } else if (statusFilter === '0.5') {
      filtered = filtered.filter((i) => i.statusType === 'HALF');
    } else if (statusFilter === '0') {
      filtered = filtered.filter((i) => i.statusType === 'ABSENT');
    } else if (statusFilter === 'UNMARKED') {
      filtered = filtered.filter((i) => i.statusType === 'UNMARKED');
    }

    // Filter by search query
    if (query) {
      filtered = filtered.filter((i) => {
        const name = (i.worker.name || '').toLowerCase();
        const skill = (i.worker.skill || '').toLowerCase();
        const site = i.record
          ? data.sites.find((s) => s.id === i.record?.site_id)?.name.toLowerCase() || ''
          : '';
        return name.includes(query) || skill.includes(query) || site.includes(query);
      });
    }

    return filtered;
  }, [activeWorkers, selectedDateRecords, statusFilter, query, data.sites]);

  const handlePrevDay = () => setSelectedDate((d) => shiftDate(d, -1));
  const handleNextDay = () => {
    if (selectedDate < currentDate) {
      setSelectedDate((d) => shiftDate(d, 1));
    }
  };

  return (
    <View style={styles.pageWrapper}>
      {/* Top Navigation Bar */}
      <TopNavBar
        title={lang === 'hi' ? 'दैनिक हाजिरी' : 'Daily Attendance'}
        subtitle={lang === 'hi' ? 'दैनिक मजदूरी व उपस्थिति' : 'Worker attendance & wage records'}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
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
          {/* 1. COMPACT DATE NAVIGATION BAR (< Date >) */}
          <View style={styles.dateBar}>
            <Pressable
              onPress={handlePrevDay}
              style={({ pressed }) => [styles.dateArrowBtn, pressed && styles.dateBtnPressed]}
              hitSlop={8}
              accessibilityLabel="Previous Day"
            >
              <AppIcon name="chevron-back" size={17} color="#2563EB" />
            </Pressable>

            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              style={({ pressed }) => [styles.dateCenterBtn, pressed && styles.dateBtnPressed]}
              accessibilityLabel="Select date from calendar"
            >
              <AppIcon name="calendar" size={15} color="#2563EB" />
              <Text style={styles.dateCenterText}>{formatDateDisplay(selectedDate)}</Text>
            </Pressable>

            <Pressable
              onPress={handleNextDay}
              disabled={selectedDate >= currentDate}
              style={({ pressed }) => [
                styles.dateArrowBtn,
                selectedDate >= currentDate && styles.dateArrowBtnDisabled,
                pressed && selectedDate < currentDate && styles.dateBtnPressed,
              ]}
              hitSlop={8}
              accessibilityLabel="Next Day"
            >
              <AppIcon
                name="chevron-forward"
                size={17}
                color={selectedDate >= currentDate ? '#CBD5E1' : '#2563EB'}
              />
            </Pressable>
          </View>

          {/* 2. INTERACTIVE STATUS FILTER CHIPS (Single Clean Row) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusChipsRow}
          >
            <Pressable
              onPress={() => setStatusFilter('ALL')}
              style={[
                styles.statusChip,
                statusFilter === 'ALL' && styles.statusChipActiveAll,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  statusFilter === 'ALL' && styles.statusChipTextActive,
                ]}
              >
                {lang === 'hi' ? 'सभी' : 'All'} ({activeWorkers.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('1')}
              style={[
                styles.statusChip,
                styles.statusChipPresent,
                statusFilter === '1' && styles.statusChipActivePresent,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: '#166534' },
                  statusFilter === '1' && styles.statusChipTextActive,
                ]}
              >
                🟢 {lang === 'hi' ? 'उपस्थित' : 'Present'} ({stats.present})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('0.5')}
              style={[
                styles.statusChip,
                styles.statusChipHalf,
                statusFilter === '0.5' && styles.statusChipActiveHalf,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: '#92400E' },
                  statusFilter === '0.5' && styles.statusChipTextActive,
                ]}
              >
                🟡 {lang === 'hi' ? 'हाफ डे' : 'Half'} ({stats.halfDay})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('0')}
              style={[
                styles.statusChip,
                styles.statusChipAbsent,
                statusFilter === '0' && styles.statusChipActiveAbsent,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: '#991B1B' },
                  statusFilter === '0' && styles.statusChipTextActive,
                ]}
              >
                🔴 {lang === 'hi' ? 'अनुपस्थित' : 'Absent'} ({stats.absent})
              </Text>
            </Pressable>

            {stats.pendingCount > 0 && (
              <Pressable
                onPress={() => setStatusFilter('UNMARKED')}
                style={[
                  styles.statusChip,
                  styles.statusChipPending,
                  statusFilter === 'UNMARKED' && styles.statusChipActivePending,
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    { color: '#475569' },
                    statusFilter === 'UNMARKED' && styles.statusChipTextActive,
                  ]}
                >
                  ⚪ {lang === 'hi' ? 'बाकी' : 'Pending'} ({stats.pendingCount})
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {/* 3. COMPACT SEARCH BAR */}
          <View style={styles.searchBar}>
            <AppIcon name="search" size={15} color="#94A3B8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={lang === 'hi' ? 'मजदूर का नाम या काम खोजें...' : 'Search worker name or skill...'}
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <AppIcon name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          {/* 4. UNIFIED WORKER ATTENDANCE LIST (Sleek Compact Cards) */}
          <View style={styles.workerList}>
            {workerList.length === 0 ? (
              <View style={styles.emptyBox}>
                <AppIcon name="people-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>
                  {query
                    ? (lang === 'hi' ? 'कोई मजदूर नहीं मिला' : 'No matching worker found')
                    : (lang === 'hi' ? 'कोई हाजिरी रिकॉर्ड नहीं' : 'No attendance records')}
                </Text>
              </View>
            ) : (
              workerList.map((item) => {
                const worker = item.worker;
                const rec = item.record;
                const otMins = rec ? Number(rec.overtime_minutes) || 0 : 0;
                const workerInitials = (worker.name || 'W').slice(0, 2).toUpperCase();

                return (
                  <Pressable
                    key={worker.id}
                    onPress={() => {
                      if (selectedDate > currentDate) {
                        showToast(
                          lang === 'hi'
                            ? 'भविष्य की तारीख में हाजिरी नहीं भर सकते'
                            : 'Attendance cannot be marked for future dates',
                          'w'
                        );
                        return;
                      }
                      onOpenAttendanceModal(
                        rec?.site_id,
                        worker.id,
                        rec || ({ date: selectedDate, worker_id: worker.id } as any)
                      );
                    }}
                    style={({ pressed }) => [
                      styles.workerCard,
                      pressed && styles.workerCardPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${worker.name} haziri`}
                  >
                    {/* Left: Avatar + Details */}
                    <View style={styles.workerLeftCol}>
                      <View
                        style={[
                          styles.avatarBox,
                          item.statusType === 'PRESENT' && styles.avatarPresent,
                          item.statusType === 'HALF' && styles.avatarHalf,
                          item.statusType === 'ABSENT' && styles.avatarAbsent,
                          item.statusType === 'UNMARKED' && styles.avatarUnmarked,
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            item.statusType === 'PRESENT' && { color: '#15803D' },
                            item.statusType === 'HALF' && { color: '#B45309' },
                            item.statusType === 'ABSENT' && { color: '#B91C1C' },
                            item.statusType === 'UNMARKED' && { color: '#64748B' },
                          ]}
                        >
                          {workerInitials}
                        </Text>
                      </View>

                      <View style={styles.workerDetails}>
                        <Text style={styles.workerName} numberOfLines={1}>
                          {worker.name}
                        </Text>
                        {(worker.skill || otMins > 0) ? (
                          <View style={styles.workerSubRow}>
                            {worker.skill ? (
                              <Text style={styles.workerSkillText} numberOfLines={1}>
                                {worker.skill}
                              </Text>
                            ) : null}
                            {otMins > 0 ? (
                              <>
                                {worker.skill ? <Text style={styles.metaDot}>•</Text> : null}
                                <Text style={styles.metaOt}>OT: {otMins}m</Text>
                              </>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Right: Status Badge or + Mark Button */}
                    <View style={styles.workerRightCol}>
                      {item.isMarked ? (
                        <View
                          style={[
                            styles.statusBadge,
                            item.statusType === 'PRESENT' && styles.badgePresent,
                            item.statusType === 'HALF' && styles.badgeHalf,
                            item.statusType === 'ABSENT' && styles.badgeAbsent,
                          ]}
                        >
                          <AppIcon
                            name={
                              item.statusType === 'PRESENT'
                                ? 'checkmark-circle'
                                : item.statusType === 'HALF'
                                  ? 'time'
                                  : 'close-circle'
                            }
                            size={13}
                            color={
                              item.statusType === 'PRESENT'
                                ? '#16A34A'
                                : item.statusType === 'HALF'
                                  ? '#D97706'
                                  : '#DC2626'
                            }
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              item.statusType === 'PRESENT' && { color: '#15803D' },
                              item.statusType === 'HALF' && { color: '#B45309' },
                              item.statusType === 'ABSENT' && { color: '#B91C1C' },
                            ]}
                          >
                            {item.statusType === 'PRESENT'
                              ? (lang === 'hi' ? 'उपस्थित' : 'Present')
                              : item.statusType === 'HALF'
                                ? (lang === 'hi' ? 'हाफ डे' : 'Half Day')
                                : (lang === 'hi' ? 'अनुपस्थित' : 'Absent')}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.markBtn}>
                          <AppIcon name="add" size={13} color="#2563EB" />
                          <Text style={styles.markBtnText}>
                            {lang === 'hi' ? 'हाजिरी' : 'Mark'}
                          </Text>
                        </View>
                      )}

                      <AppIcon name="chevron-forward" size={15} color="#CBD5E1" />
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Calendar Picker Modal */}
      {isCalendarOpen && (
        <CalendarPickerModal
          visible={isCalendarOpen}
          title={lang === 'hi' ? 'हाजिरी तारीख चुनें' : 'Select Register Date'}
          selectedDate={selectedDate}
          maxDate={currentDate}
          onSelect={(newDate) => {
            if (newDate) setSelectedDate(newDate);
            setIsCalendarOpen(false);
          }}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  container: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },

  // 1. Date Navigation Bar (< Date >)
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    height: 44,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        elevation: 1,
      },
    }),
  },
  dateArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  dateArrowBtnDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.5,
  },
  dateCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateCenterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  dateBtnPressed: {
    opacity: 0.7,
  },

  // 2. Status Chips Horizontal Scroll
  statusChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusChipHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusChipAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusChipPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusChipActiveAll: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusChipActivePresent: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  statusChipActiveHalf: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  statusChipActiveAbsent: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  statusChipActivePending: {
    backgroundColor: '#475569',
    borderColor: '#475569',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },

  // 3. Compact Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
    height: '100%',
  },

  // 4. Total Wages Strip
  wageSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  wageSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wageSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  wageSummaryAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  wageSummaryCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },

  // 5. Worker List
  workerList: {
    gap: 6,
    marginTop: 2,
  },
  workerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
      } as any,
      default: {
        elevation: 1,
      },
    }),
  },
  workerCardPressed: {
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  workerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPresent: {
    backgroundColor: '#DCFCE7',
  },
  avatarHalf: {
    backgroundColor: '#FEF3C7',
  },
  avatarAbsent: {
    backgroundColor: '#FEE2E2',
  },
  avatarUnmarked: {
    backgroundColor: '#F1F5F9',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  workerDetails: {
    flex: 1,
    minWidth: 0,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  workerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  workerSkillText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaRate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  metaSite: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '600',
  },
  metaOt: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
  },

  // Right Side
  workerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePresent: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeHalf: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeAbsent: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
