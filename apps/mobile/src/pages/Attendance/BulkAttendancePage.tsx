import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Snapshot, Row } from '../../types';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../context/ToastContext';
import { request, commandKey } from '../../api';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';

export interface BulkAttendancePageProps {
  data: Snapshot;
  initialSiteId?: string;
  siteId?: string;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

type AttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT';

// Format date to match screenshot format: e.g. "Thu, 23 Oct 2025"
const formatScreenshotDate = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export function BulkAttendancePage({
  data,
  initialSiteId,
  siteId,
  onBack,
  onRefresh,
  refreshing = false,
}: BulkAttendancePageProps) {
  const { t } = useLanguage();
  const { token } = useAuth();

  const effectiveSiteId = siteId || initialSiteId;

  // Selected Site
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    if (effectiveSiteId && data.sites.some((s) => s.id === effectiveSiteId)) {
      return effectiveSiteId;
    }
    return data.sites[0]?.id || '';
  });

  // Selected Date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(today());

  // Active Filter Tab: 'ALL' | 'PRESENT' | 'ABSENT' | 'HALF_DAY'
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'HALF_DAY'>('ALL');

  // Modals state
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Overtime / Notes modal state for specific worker
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [overtimeMinutes, setOvertimeMinutes] = useState<Record<string, number>>({});
  const [workerNotes, setWorkerNotes] = useState<Record<string, string>>({});

  // Active workers list
  const activeWorkers = useMemo(() => {
    return (data.workers || []).filter((w) => w.active);
  }, [data.workers]);

  // Selected site object
  const currentSite = useMemo(() => {
    return data.sites.find((s) => s.id === selectedSiteId) || data.sites[0];
  }, [data.sites, selectedSiteId]);

  // Map of worker attendance status: workerId -> 'PRESENT' | 'HALF_DAY' | 'ABSENT'
  const [workerStatus, setWorkerStatus] = useState<Record<string, AttendanceStatus>>({});
  const [initialStatusSnapshot, setInitialStatusSnapshot] = useState<Record<string, AttendanceStatus>>({});

  // Set of selected worker IDs (for the checkbox on the left)
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(() => {
    return new Set(activeWorkers.map((w) => w.id));
  });

  // Load existing records whenever selectedSiteId or selectedDate changes
  useEffect(() => {
    const statusMap: Record<string, AttendanceStatus> = {};
    const otMap: Record<string, number> = {};
    const notesMap: Record<string, string> = {};

    activeWorkers.forEach((w) => {
      // Find matching attendance record for this site, worker, and date
      const record = (data.attendance || []).find(
        (a) =>
          a.site_id === selectedSiteId &&
          a.worker_id === w.id &&
          String(a.date).slice(0, 10) === selectedDate
      );

      if (record) {
        if (Number(record.units) === 1) {
          statusMap[w.id] = 'PRESENT';
        } else if (Number(record.units) === 0.5) {
          statusMap[w.id] = 'HALF_DAY';
        } else {
          statusMap[w.id] = 'ABSENT';
        }
        otMap[w.id] = Number(record.overtime_minutes || 0);
        notesMap[w.id] = record.notes || '';
      } else {
        // Default to PRESENT for easy 1-click marking
        statusMap[w.id] = 'PRESENT';
        otMap[w.id] = 0;
        notesMap[w.id] = '';
      }
    });

    setWorkerStatus(statusMap);
    setInitialStatusSnapshot({ ...statusMap });
    setOvertimeMinutes(otMap);
    setWorkerNotes(notesMap);

    // Default select all active workers
    setSelectedWorkerIds(new Set(activeWorkers.map((w) => w.id)));
  }, [selectedSiteId, selectedDate, data.attendance, activeWorkers]);

  // Count metrics for the filter tabs
  const allCount = activeWorkers.length;
  const presentCount = useMemo(() => {
    return activeWorkers.filter((w) => (workerStatus[w.id] || 'PRESENT') === 'PRESENT').length;
  }, [activeWorkers, workerStatus]);

  const absentCount = useMemo(() => {
    return activeWorkers.filter((w) => workerStatus[w.id] === 'ABSENT').length;
  }, [activeWorkers, workerStatus]);

  const halfDayCount = useMemo(() => {
    return activeWorkers.filter((w) => workerStatus[w.id] === 'HALF_DAY').length;
  }, [activeWorkers, workerStatus]);

  // Workers displayed based on active tab
  const displayedWorkers = useMemo(() => {
    return activeWorkers.filter((w) => {
      const st = workerStatus[w.id] || 'PRESENT';
      if (activeFilter === 'PRESENT') return st === 'PRESENT';
      if (activeFilter === 'HALF_DAY') return st === 'HALF_DAY';
      if (activeFilter === 'ABSENT') return st === 'ABSENT';
      return true; // 'ALL'
    });
  }, [activeWorkers, workerStatus, activeFilter]);

  // Toggle single worker checkbox
  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  // Toggle select all checkbox
  const isAllSelected = useMemo(() => {
    if (displayedWorkers.length === 0) return false;
    return displayedWorkers.every((w) => selectedWorkerIds.has(w.id));
  }, [displayedWorkers, selectedWorkerIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedWorkerIds((prev) => {
        const next = new Set(prev);
        displayedWorkers.forEach((w) => next.delete(w.id));
        return next;
      });
    } else {
      setSelectedWorkerIds((prev) => {
        const next = new Set(prev);
        displayedWorkers.forEach((w) => next.add(w.id));
        return next;
      });
    }
  };

  // Cycle worker status: PRESENT -> HALF_DAY -> ABSENT -> PRESENT
  const cycleWorkerStatus = (workerId: string) => {
    setWorkerStatus((prev) => {
      const current = prev[workerId] || 'PRESENT';
      let next: AttendanceStatus = 'PRESENT';
      if (current === 'PRESENT') {
        next = 'HALF_DAY';
      } else if (current === 'HALF_DAY') {
        next = 'ABSENT';
      } else {
        next = 'PRESENT';
      }
      return { ...prev, [workerId]: next };
    });
  };

  // Check if any status has changed compared to initial
  const hasChanges = useMemo(() => {
    return activeWorkers.some(
      (w) => (workerStatus[w.id] || 'PRESENT') !== (initialStatusSnapshot[w.id] || 'PRESENT')
    );
  }, [activeWorkers, workerStatus, initialStatusSnapshot]);

  // Save attendance to backend
  const handleSaveAttendance = async (forceAllPresent = false) => {
    if (!token) {
      showToast('Please login to save attendance', 'w');
      return;
    }
    if (!selectedSiteId) {
      showToast('Please select a work site', 'w');
      return;
    }

    const targets = forceAllPresent
      ? activeWorkers
      : activeWorkers.filter((w) => selectedWorkerIds.has(w.id));

    if (targets.length === 0) {
      showToast('Please select at least one worker to mark attendance', 'w');
      return;
    }

    if (selectedDate > today()) {
      showToast('Attendance cannot be marked for future dates', 'w');
      return;
    }

    setIsSaving(true);
    try {
      for (const worker of targets) {
        const status = forceAllPresent ? 'PRESENT' : workerStatus[worker.id] || 'PRESENT';
        const units = status === 'PRESENT' ? 1 : status === 'HALF_DAY' ? 0.5 : 0;
        const ot = overtimeMinutes[worker.id] || 0;
        const notes = workerNotes[worker.id] || '';

        const payload = {
          action: 'attendance.save',
          data: {
            site_id: selectedSiteId,
            worker_id: worker.id,
            date: selectedDate,
            units,
            overtime_minutes: ot,
            notes,
          },
          key: commandKey(),
        };

        await request('/commands', token, payload);
      }

      if (forceAllPresent) {
        const allPresentMap: Record<string, AttendanceStatus> = {};
        activeWorkers.forEach((w) => {
          allPresentMap[w.id] = 'PRESENT';
        });
        setWorkerStatus(allPresentMap);
        setInitialStatusSnapshot(allPresentMap);
      } else {
        setInitialStatusSnapshot({ ...workerStatus });
      }

      showToast(
        forceAllPresent
          ? `All ${targets.length} workers marked Present successfully!`
          : `Attendance saved for ${targets.length} workers successfully!`,
        's'
      );

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save attendance', 'e');
    } finally {
      setIsSaving(false);
    }
  };

  // Avatar presets matching app's clean aesthetics
  const getAvatarConfig = (w: Row, index: number) => {
    const roleLower = (w.skill || w.role || '').toLowerCase();
    const isMason = roleLower.includes('mason') || roleLower.includes('mistri') || index === 3;

    const palettes = [
      { bg: '#FFEDD5', shirt: '#EA580C' },
      { bg: '#E0F2FE', shirt: '#1E3A8A' },
      { bg: '#E0F7FA', shirt: '#0284C7' },
      { bg: '#FEF3C7', shirt: '#1E40AF' },
      { bg: '#F1F5F9', shirt: '#0F172A' },
    ];

    const conf = palettes[index % palettes.length];
    return { ...conf, isMason };
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* 1. APP-MATCHING CLEAN HEADER */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.7 }]}
          onPress={onBack}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Bulk Attendance</Text>
          <Text style={styles.headerSubtitle}>Mark attendance for all workers</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* 2. BODY CONTENT */}
      <View style={styles.sheetContainer}>
        {/* SITE SELECTOR DROPDOWN */}
        <Pressable
          style={({ pressed }) => [styles.selectorInputBox, pressed && { opacity: 0.85 }]}
          onPress={() => setIsSiteModalOpen(true)}
        >
          <Ionicons name="location-sharp" size={20} color="#2563EB" />
          <Text style={styles.selectorInputText} numberOfLines={1}>
            {currentSite?.name || 'Select Work Site'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#64748B" />
        </Pressable>

        {/* DATE SELECTOR */}
        <Pressable
          style={({ pressed }) => [styles.selectorInputBox, pressed && { opacity: 0.85 }]}
          onPress={() => setIsCalendarOpen(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#2563EB" />
          <Text style={styles.selectorInputText} numberOfLines={1}>
            {formatScreenshotDate(selectedDate)}
          </Text>
        </Pressable>

        {/* FILTER TABS ROW */}
        <View style={styles.filterTabsRow}>
          {/* All Tab */}
          <Pressable
            style={[
              styles.filterTabPill,
              activeFilter === 'ALL' ? styles.filterTabPillActive : styles.filterTabPillInactive,
            ]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text
              style={[
                styles.filterTabLabel,
                activeFilter === 'ALL' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
              ]}
            >
              All ({allCount})
            </Text>
          </Pressable>

          {/* Present Tab */}
          <Pressable
            style={[
              styles.filterTabPill,
              activeFilter === 'PRESENT' ? styles.filterTabPillActive : styles.filterTabPillInactive,
            ]}
            onPress={() => setActiveFilter('PRESENT')}
          >
            <Text
              style={[
                styles.filterTabLabel,
                activeFilter === 'PRESENT' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
              ]}
            >
              Present ({presentCount})
            </Text>
          </Pressable>

          {/* Absent Tab */}
          <Pressable
            style={[
              styles.filterTabPill,
              activeFilter === 'ABSENT' ? styles.filterTabPillActive : styles.filterTabPillInactive,
            ]}
            onPress={() => setActiveFilter('ABSENT')}
          >
            <Text
              style={[
                styles.filterTabLabel,
                activeFilter === 'ABSENT' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
              ]}
            >
              Absent ({absentCount})
            </Text>
          </Pressable>

          {/* Half Day Tab */}
          <Pressable
            style={[
              styles.filterTabPill,
              activeFilter === 'HALF_DAY' ? styles.filterTabPillActive : styles.filterTabPillInactive,
            ]}
            onPress={() => setActiveFilter('HALF_DAY')}
          >
            <Text
              style={[
                styles.filterTabLabel,
                activeFilter === 'HALF_DAY' ? styles.filterTabLabelActive : styles.filterTabLabelInactive,
              ]}
            >
              Half Day ({halfDayCount})
            </Text>
          </Pressable>
        </View>

        {/* SELECT ALL ROW */}
        <View style={styles.selectAllRow}>
          <Pressable
            style={styles.checkboxTouch}
            onPress={handleToggleSelectAll}
            hitSlop={8}
          >
            <View style={[styles.checkboxSquare, isAllSelected && styles.checkboxSquareChecked]}>
              {isAllSelected && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
            </View>
            <Text style={styles.selectAllText}>Select All</Text>
          </Pressable>
        </View>

        {/* WORKER LIST */}
        <ScrollView
          style={styles.workerListScroll}
          contentContainerStyle={styles.workerListContent}
          showsVerticalScrollIndicator={false}
        >
          {displayedWorkers.length === 0 ? (
            <View style={styles.emptyListContainer}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyListTitle}>No workers found</Text>
              <Text style={styles.emptyListSub}>
                {activeFilter !== 'ALL'
                  ? `No workers marked as ${activeFilter.toLowerCase()} for this date.`
                  : 'Add workers in Labour page to start recording haziri.'}
              </Text>
            </View>
          ) : (
            displayedWorkers.map((w, index) => {
              const isSelected = selectedWorkerIds.has(w.id);
              const status = workerStatus[w.id] || 'PRESENT';
              const avatar = getAvatarConfig(w, index);
              const ot = overtimeMinutes[w.id] || 0;

              return (
                <View key={w.id} style={styles.workerRow}>
                  {/* Left Checkbox */}
                  <Pressable
                    style={styles.rowCheckboxArea}
                    onPress={() => toggleWorkerSelection(w.id)}
                    hitSlop={8}
                  >
                    <View style={[styles.checkboxSquare, isSelected && styles.checkboxSquareChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                    </View>
                  </Pressable>

                  {/* Worker Avatar */}
                  <View style={[styles.workerAvatarCircle, { backgroundColor: avatar.bg }]}>
                    {w.photo && (w.photo.startsWith('http') || w.photo.startsWith('data:')) ? (
                      <Image source={{ uri: w.photo }} style={styles.workerAvatarImg} />
                    ) : avatar.isMason ? (
                      <View style={styles.avatarMasonStack}>
                        <View style={styles.helmetBadgeSmall}>
                          <Ionicons name="construct" size={11} color="#B45309" />
                        </View>
                        <Ionicons name="person" size={26} color={avatar.shirt} />
                      </View>
                    ) : (
                      <Ionicons name="person" size={28} color={avatar.shirt} />
                    )}
                  </View>

                  {/* Worker Name & Role */}
                  <Pressable
                    style={styles.workerInfoCol}
                    onPress={() => setEditingWorkerId(w.id)}
                  >
                    <Text style={styles.workerNameText} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <View style={styles.workerSubRow}>
                      <Text style={styles.workerRoleText}>
                        {w.skill || w.role || 'Helper'}
                      </Text>
                      {ot > 0 && (
                        <View style={styles.overtimeBadge}>
                          <Ionicons name="time" size={11} color="#D97706" />
                          <Text style={styles.overtimeBadgeText}>+{ot}m OT</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>

                  {/* Right Status Toggle Pill */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusPillBtn,
                      status === 'PRESENT' && styles.statusPillPresent,
                      status === 'HALF_DAY' && styles.statusPillHalfDay,
                      status === 'ABSENT' && styles.statusPillAbsent,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => cycleWorkerStatus(w.id)}
                    accessibilityLabel={`Change status for ${w.name}, currently ${status}`}
                  >
                    {status === 'PRESENT' && (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                        <Text style={styles.statusPillTextPresent}>Present</Text>
                      </>
                    )}
                    {status === 'HALF_DAY' && (
                      <>
                        <Ionicons name="time" size={18} color="#D97706" />
                        <Text style={styles.statusPillTextHalfDay}>Half Day</Text>
                      </>
                    )}
                    {status === 'ABSENT' && (
                      <>
                        <Ionicons name="close-circle" size={18} color="#DC2626" />
                        <Text style={styles.statusPillTextAbsent}>Absent</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* 3. BOTTOM STICKY ACTION BUTTON */}
        <View style={styles.bottomBarContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryCtaBtn,
              isSaving && styles.primaryCtaBtnDisabled,
              pressed && !isSaving && { opacity: 0.9 },
            ]}
            onPress={() => {
              if (hasChanges) {
                handleSaveAttendance(false);
              } else {
                handleSaveAttendance(true);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <Text style={styles.primaryCtaText}>
                {hasChanges ? 'Save Attendance' : 'Mark All Present'}
              </Text>
            )}
          </Pressable>

          {hasChanges && !isSaving && (
            <Pressable
              style={styles.subActionBtn}
              onPress={() => handleSaveAttendance(true)}
            >
              <Text style={styles.subActionText}>or Mark All Present</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* SITE SELECTION MODAL */}
      <Modal
        visible={isSiteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSiteModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsSiteModalOpen(false)}
        >
          <View style={styles.sitePickerCard}>
            <View style={styles.sitePickerHeader}>
              <Text style={styles.sitePickerTitle}>Select Work Site</Text>
              <Pressable
                onPress={() => setIsSiteModalOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {data.sites.map((site) => {
                const isCurrent = site.id === selectedSiteId;
                return (
                  <Pressable
                    key={site.id}
                    style={[
                      styles.siteOptionRow,
                      isCurrent && styles.siteOptionRowActive,
                    ]}
                    onPress={() => {
                      setSelectedSiteId(site.id);
                      setIsSiteModalOpen(false);
                    }}
                  >
                    <Ionicons
                      name="business"
                      size={20}
                      color={isCurrent ? '#2563EB' : '#64748B'}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.siteOptionName,
                          isCurrent && styles.siteOptionNameActive,
                        ]}
                      >
                        {site.name}
                      </Text>
                      {site.location ? (
                        <Text style={styles.siteOptionLocation}>
                          {site.location}
                        </Text>
                      ) : null}
                    </View>
                    {isCurrent && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#059669"
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* CALENDAR PICKER MODAL */}
      <CalendarPickerModal
        visible={isCalendarOpen}
        selectedDate={selectedDate}
        maxDate={today()}
        title="Select Attendance Date"
        onSelect={(dateStr) => {
          if (dateStr > today()) {
            showToast('Cannot select a future date', 'w');
            return;
          }
          setSelectedDate(dateStr);
          setIsCalendarOpen(false);
        }}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* OPTIONAL OVERTIME & NOTES MODAL */}
      {editingWorkerId && (
        <Modal
          visible={!!editingWorkerId}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingWorkerId(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setEditingWorkerId(null)}
          >
            <View style={styles.otModalCard}>
              <View style={styles.sitePickerHeader}>
                <View>
                  <Text style={styles.sitePickerTitle}>
                    {activeWorkers.find((w) => w.id === editingWorkerId)?.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Overtime & Notes
                  </Text>
                </View>
                <Pressable
                  onPress={() => setEditingWorkerId(null)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color="#64748B" />
                </Pressable>
              </View>

              <Text style={styles.otSectionLabel}>Overtime Hours</Text>
              <View style={styles.otQuickBtnRow}>
                {[0, 30, 60, 120, 180].map((mins) => {
                  const currentOt = overtimeMinutes[editingWorkerId] || 0;
                  const isSelected = currentOt === mins;
                  const label =
                    mins === 0 ? 'None' : mins < 60 ? `${mins}m` : `${mins / 60}h`;
                  return (
                    <Pressable
                      key={mins}
                      style={[
                        styles.otQuickBtn,
                        isSelected && styles.otQuickBtnActive,
                      ]}
                      onPress={() =>
                        setOvertimeMinutes((prev) => ({
                          ...prev,
                          [editingWorkerId]: mins,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.otQuickBtnText,
                          isSelected && styles.otQuickBtnTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.otDoneBtn}
                onPress={() => setEditingWorkerId(null)}
              >
                <Text style={styles.otDoneBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  selectorInputBox: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  selectorInputText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  filterTabPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabPillActive: {
    backgroundColor: '#0F2851',
  },
  filterTabPillInactive: {
    backgroundColor: '#F1F5F9',
  },
  filterTabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterTabLabelInactive: {
    color: '#64748B',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 4,
  },
  checkboxTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0F2851',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: '#0F2851',
    borderColor: '#0F2851',
  },
  selectAllText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  workerListScroll: {
    flex: 1,
  },
  workerListContent: {
    paddingBottom: 16,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowCheckboxArea: {
    paddingRight: 6,
  },
  workerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  workerAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarMasonStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  helmetBadgeSmall: {
    position: 'absolute',
    top: -2,
    backgroundColor: '#FDE047',
    borderRadius: 8,
    padding: 2,
    zIndex: 2,
  },
  workerInfoCol: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  workerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  workerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  workerRoleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  overtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overtimeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  statusPillBtn: {
    minWidth: 105,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 5,
  },
  statusPillPresent: {
    backgroundColor: '#EBFBF2',
    borderColor: '#86EFAC',
  },
  statusPillTextPresent: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 13,
  },
  statusPillHalfDay: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  statusPillTextHalfDay: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 13,
  },
  statusPillAbsent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusPillTextAbsent: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  bottomBarContainer: {
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryCtaBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#FBA919',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FBA919',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryCtaBtnDisabled: {
    opacity: 0.7,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subActionBtn: {
    marginTop: 6,
    alignItems: 'center',
  },
  subActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 10,
  },
  emptyListSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sitePickerCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  sitePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sitePickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  siteOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  siteOptionRowActive: {
    backgroundColor: '#F1F5F9',
  },
  siteOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  siteOptionNameActive: {
    color: '#0F2851',
    fontWeight: '700',
  },
  siteOptionLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  otModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  otSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  otQuickBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  otQuickBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otQuickBtnActive: {
    backgroundColor: '#0F2851',
  },
  otQuickBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  otQuickBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  otDoneBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F2851',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
