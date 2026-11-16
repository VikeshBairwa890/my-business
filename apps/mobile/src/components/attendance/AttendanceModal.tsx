import React, { useState, useMemo } from 'react';
import {
  Modal,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { FormSpec, Row, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { today } from '../../forms';

export interface AttendanceModalProps {
  spec: FormSpec;
  data: Snapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

export function AttendanceModal({
  spec,
  data,
  busy,
  error,
  onClose,
  onSave,
}: AttendanceModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const isCorrection = spec.title.toLowerCase().includes('correct');
  const isWorkerLocked = Boolean(
    spec.initial.locked_worker_id ||
    (spec.fields && spec.fields.find((f) => f.key === 'worker_id')?.options?.length === 1) ||
    spec.entity_id
  );

  // Form State
  const [siteId, setSiteId] = useState<string>(
    spec.initial.site_id || data.sites[0]?.id || ''
  );
  const [workerId, setWorkerId] = useState<string>(
    spec.initial.worker_id || data.workers.find((w) => w.active)?.id || ''
  );
  const [date, setDate] = useState<string>(spec.initial.date || today());
  const [units, setUnits] = useState<'1' | '0.5' | '0'>(
    (spec.initial.units as any) || '1'
  );
  const [overtimeMinutes, setOvertimeMinutes] = useState<string>(
    spec.initial.overtime_minutes ? String(spec.initial.overtime_minutes) : '0'
  );
  const [notes, setNotes] = useState<string>(spec.initial.notes || '');

  // UI state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Currently selected site & worker
  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === workerId) || data.workers[0],
    [data.workers, workerId]
  );

  // Wage calculation preview
  const wageCalc = useMemo(() => {
    if (!selectedWorker) return { base: 0, overtime: 0, total: 0, dailyRate: 0, otRate: 0 };
    const dailyRate = Number(selectedWorker.daily_rate) || 0;
    const otRate = Number(selectedWorker.overtime_rate) || 0;
    const unitMultiplier = Number(units);

    const base = dailyRate * unitMultiplier;
    const otMinutes = Math.max(0, Number(overtimeMinutes) || 0);
    const overtime = (otMinutes / 60) * otRate;
    const total = base + overtime;

    return { base, overtime, total, dailyRate, otRate };
  }, [selectedWorker, units, overtimeMinutes]);

  // Format date nicely
  const formattedDate = useMemo(() => {
    if (!date) return 'Select Date';
    try {
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return date;
    }
  }, [date]);

  const currentOtMins = Math.max(0, Number(overtimeMinutes) || 0);

  const handleSetOvertime = (mins: number) => {
    const val = Math.max(0, mins);
    setOvertimeMinutes(String(val));
  };

  const handleStepOvertime = (delta: number) => {
    const nextVal = Math.max(0, currentOtMins + delta);
    setOvertimeMinutes(String(nextVal));
  };

  const formatOtDuration = (mins: number) => {
    if (mins <= 0) return '0 min';
    const hrs = Math.floor(mins / 60);
    const remainder = mins % 60;
    if (hrs > 0 && remainder > 0) {
      return `${hrs} hr ${remainder} min`;
    } else if (hrs > 0) {
      return `${hrs} hr${hrs > 1 ? 's' : ''}`;
    }
    return `${remainder} min`;
  };

  const formatRupees = (amount: number | string | undefined | null) => {
    const num = Number(amount) || 0;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const handleSave = () => {
    setLocalError('');
    if (!siteId) {
      setLocalError('Please select a work site.');
      return;
    }
    if (!workerId) {
      setLocalError('Please select a worker.');
      return;
    }
    if (!date) {
      setLocalError('Please pick a date.');
      return;
    }
    const todayStr = today();
    if (String(date).slice(0, 10) > todayStr) {
      setLocalError('Attendance cannot be marked for future dates.');
      return;
    }
    if (isCorrection && !notes.trim()) {
      setLocalError('Please provide a reason or note for this correction.');
      return;
    }

    onSave({
      site_id: siteId,
      worker_id: workerId,
      date,
      units,
      overtime_minutes: units === '0' ? '0' : String(currentOtMins),
      notes: notes.trim(),
    });
  };

  const displayError = localError || error;

  return (
    <Modal
      visible
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={() => !busy && onClose()}
      presentationStyle={isDesktop ? 'overFullScreen' : 'fullScreen'}
      transparent={isDesktop}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <SafeAreaView
          style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}
          edges={['top', 'bottom']}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header: Clean & Distraction-free */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconBadge}>
                  <AppIcon
                    name={isCorrection ? 'create' : 'calendar'}
                    size={17}
                    color="#2563EB"
                  />
                </View>
                <View>
                  <Text style={styles.headerTitle}>
                    {isCorrection ? 'Update Attendance' : 'Mark Attendance'}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {selectedWorker ? selectedWorker.name : 'Daily attendance & overtime'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => !busy && onClose()}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityLabel="Close"
              >
                <AppIcon name="close" size={17} color="#64748B" />
              </Pressable>
            </View>

            {/* Error Banner */}
            {displayError ? (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-circle" size={15} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{displayError}</Text>
              </View>
            ) : null}

            {/* Scrollable Form Body */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollBody}
              showsVerticalScrollIndicator={false}
            >
              {/* 1. WORKER HERO CARD (Clean Context) */}
              <View style={styles.workerHeroCard}>
                <View style={styles.workerAvatar}>
                  <Text style={styles.workerAvatarText}>
                    {(selectedWorker?.name || 'W').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.workerHeroName} numberOfLines={1}>
                      {selectedWorker?.name || 'Select Worker'}
                    </Text>
                    {selectedWorker?.skill ? (
                      <View style={styles.skillBadge}>
                        <Text style={styles.skillBadgeText}>{selectedWorker.skill}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.workerHeroSub}>
                    Rate: <Text style={{ fontWeight: '700', color: '#15803D' }}>{formatRupees(selectedWorker?.daily_rate)}/day</Text>
                    {selectedWorker?.overtime_rate ? ` • OT: ${formatRupees(selectedWorker.overtime_rate)}/hr` : ''}
                  </Text>
                </View>

                {!isWorkerLocked && (
                  <View style={styles.switchWorkerContainer}>
                    <View style={styles.switchWorkerBtn}>
                      <Text style={styles.switchWorkerBtnText}>Change</Text>
                      <AppIcon name="chevron-down" size={12} color="#2563EB" />
                    </View>
                    <Picker
                      mode="dropdown"
                      selectedValue={workerId}
                      onValueChange={(val: any) => setWorkerId(String(val))}
                      style={styles.nativeHiddenPicker}
                      dropdownIconColor="transparent"
                    >
                      {data.workers.filter((w) => w.active).map((w) => (
                        <Picker.Item
                          key={w.id}
                          label={`👷 ${w.name}${w.skill ? ` (${w.skill})` : ''} - ${formatRupees(w.daily_rate)}/day`}
                          value={w.id}
                        />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>

              {/* 2. WORK SITE & DATE ROW (Side-by-side with full readable pills) */}
              <View style={styles.metaRow}>
                {/* Work Site Button */}
                <View style={[styles.metaPill, { flex: 1 }]}>
                  <AppIcon name="business" size={15} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metaPillLabel}>WORK SITE</Text>
                    <Text style={styles.metaPillValue} numberOfLines={1}>
                      {selectedSite?.name || 'Select Site'}
                    </Text>
                  </View>
                  <AppIcon name="chevron-down" size={13} color="#94A3B8" />
                  <Picker
                    mode="dropdown"
                    selectedValue={siteId}
                    onValueChange={(val: any) => setSiteId(String(val))}
                    style={styles.nativeHiddenPicker}
                    dropdownIconColor="transparent"
                  >
                    {data.sites.map((s) => (
                      <Picker.Item key={s.id} label={`🏢 ${s.name}`} value={s.id} />
                    ))}
                  </Picker>
                </View>

                {/* Date Button */}
                <Pressable
                  onPress={() => setIsCalendarOpen(true)}
                  style={({ pressed }) => [
                    styles.metaPill,
                    { flex: 1 },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <AppIcon name="calendar" size={15} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metaPillLabel}>DATE</Text>
                    <Text style={styles.metaPillValue} numberOfLines={1}>
                      {formattedDate}
                    </Text>
                  </View>
                  <AppIcon name="chevron-down" size={13} color="#94A3B8" />
                </Pressable>
              </View>

              {/* 3. ATTENDANCE STATUS (3 Well-Balanced Fintech Action Cards) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>ATTENDANCE STATUS</Text>
                  <Text style={styles.sectionHint}>Select one</Text>
                </View>

                <View style={styles.statusGridRow}>
                  {/* 1. Present */}
                  <Pressable
                    onPress={() => setUnits('1')}
                    style={({ pressed }) => [
                      styles.statusCard,
                      units === '1' ? styles.statusCardActivePresent : styles.statusCardInactive,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <View style={styles.statusCardHeader}>
                      <AppIcon
                        name={units === '1' ? 'checkmark-circle' : 'ellipse-outline'}
                        size={15}
                        color={units === '1' ? '#16A34A' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.statusCardName,
                          units === '1' && styles.statusCardNameActivePresent,
                        ]}
                      >
                        Present
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.statusCardWage,
                        units === '1' && styles.statusCardWageActivePresent,
                      ]}
                    >
                      {selectedWorker ? formatRupees(selectedWorker.daily_rate) : 'Full Day'}
                    </Text>
                    <Text style={styles.statusCardSub}>Full Day (1.0)</Text>
                  </Pressable>

                  {/* 2. Half Day */}
                  <Pressable
                    onPress={() => setUnits('0.5')}
                    style={({ pressed }) => [
                      styles.statusCard,
                      units === '0.5' ? styles.statusCardActiveHalf : styles.statusCardInactive,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <View style={styles.statusCardHeader}>
                      <AppIcon
                        name={units === '0.5' ? 'time' : 'ellipse-outline'}
                        size={15}
                        color={units === '0.5' ? '#D97706' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.statusCardName,
                          units === '0.5' && styles.statusCardNameActiveHalf,
                        ]}
                      >
                        Half Day
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.statusCardWage,
                        units === '0.5' && styles.statusCardWageActiveHalf,
                      ]}
                    >
                      {selectedWorker ? formatRupees(Math.round(Number(selectedWorker.daily_rate) * 0.5)) : 'Half Day'}
                    </Text>
                    <Text style={styles.statusCardSub}>Half Day (0.5)</Text>
                  </Pressable>

                  {/* 3. Absent */}
                  <Pressable
                    onPress={() => {
                      setUnits('0');
                      setOvertimeMinutes('0');
                    }}
                    style={({ pressed }) => [
                      styles.statusCard,
                      units === '0' ? styles.statusCardActiveAbsent : styles.statusCardInactive,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <View style={styles.statusCardHeader}>
                      <AppIcon
                        name={units === '0' ? 'close-circle' : 'ellipse-outline'}
                        size={15}
                        color={units === '0' ? '#DC2626' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.statusCardName,
                          units === '0' && styles.statusCardNameActiveAbsent,
                        ]}
                      >
                        Absent
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.statusCardWage,
                        units === '0' && styles.statusCardWageActiveAbsent,
                      ]}
                    >
                      ₹0
                    </Text>
                    <Text style={styles.statusCardSub}>No Wage (0)</Text>
                  </Pressable>
                </View>
              </View>

              {/* 4. OVERTIME (OT) SECTION (Clean Stepper & 4 Fixed Quick Pills) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.sectionTitle}>OVERTIME (OT)</Text>
                    {selectedWorker?.overtime_rate ? (
                      <View style={styles.rateChip}>
                        <Text style={styles.rateChipText}>₹{Number(selectedWorker.overtime_rate)}/hr</Text>
                      </View>
                    ) : null}
                  </View>
                  {currentOtMins > 0 && wageCalc.overtime > 0 ? (
                    <Text style={styles.otExtraEarned}>+ {formatRupees(wageCalc.overtime)}</Text>
                  ) : null}
                </View>

                {units === '0' ? (
                  <View style={styles.otDisabledRow}>
                    <AppIcon name="information-circle-outline" size={14} color="#94A3B8" />
                    <Text style={styles.otDisabledText}>Overtime is not applicable when Absent</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {/* Stepper Display */}
                    <View style={styles.otStepperContainer}>
                      <Pressable
                        onPress={() => handleStepOvertime(-30)}
                        disabled={currentOtMins === 0}
                        style={({ pressed }) => [
                          styles.stepperActionBtn,
                          currentOtMins === 0 && styles.stepperActionBtnDisabled,
                          pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                        ]}
                        hitSlop={8}
                        accessibilityLabel="Minus 30 minutes"
                      >
                        <AppIcon name="remove" size={17} color={currentOtMins === 0 ? '#CBD5E1' : '#1E293B'} />
                      </Pressable>

                      <View style={styles.stepperValueCol}>
                        <Text style={[styles.stepperDurationText, currentOtMins > 0 && styles.stepperDurationTextActive]}>
                          {currentOtMins > 0 ? formatOtDuration(currentOtMins) : 'No Overtime (0 min)'}
                        </Text>
                        <Text style={styles.stepperWageText}>
                          {currentOtMins > 0 && wageCalc.overtime > 0
                            ? `+ ${formatRupees(wageCalc.overtime)} overtime wage`
                            : 'Use + / − or tap quick options below'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleStepOvertime(30)}
                        style={({ pressed }) => [
                          styles.stepperActionBtn,
                          styles.stepperActionBtnPlus,
                          pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                        ]}
                        hitSlop={8}
                        accessibilityLabel="Plus 30 minutes"
                      >
                        <AppIcon name="add" size={17} color="#2563EB" />
                      </Pressable>
                    </View>

                    {/* 4 Clean Equal Quick Buttons (100% width, no scrolling!) */}
                    <View style={styles.otPresetRow}>
                      {[
                        { label: '0 min', mins: 0 },
                        { label: '1 hr', mins: 60 },
                        { label: '2 hrs', mins: 120 },
                        { label: '3 hrs', mins: 180 },
                      ].map((preset) => {
                        const isSelected = currentOtMins === preset.mins;
                        return (
                          <Pressable
                            key={preset.mins}
                            onPress={() => handleSetOvertime(preset.mins)}
                            style={[
                              styles.otPresetBtn,
                              isSelected && styles.otPresetBtnActive,
                            ]}
                          >
                            <Text style={[styles.otPresetBtnText, isSelected && styles.otPresetBtnTextActive]}>
                              {preset.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* 5. LIVE PAYABLE WAGE CARD (Fintech Total Summary) */}
              <View style={styles.wageSummaryBanner}>
                <View style={styles.wageSummaryLeft}>
                  <Text style={styles.wageSummaryLabel}>TOTAL PAYABLE TODAY</Text>
                  <Text style={styles.wageSummaryBreakdown}>
                    Base: {formatRupees(wageCalc.base)}
                    {currentOtMins > 0 ? ` + OT: ${formatRupees(wageCalc.overtime)}` : ''}
                  </Text>
                </View>
                <Text style={styles.wageSummaryTotal}>
                  {formatRupees(wageCalc.total)}
                </Text>
              </View>

              {/* 6. REMARKS / CORRECTION REASON */}
              <View style={styles.notesContainer}>
                <Text style={styles.sectionTitle}>
                  {isCorrection ? 'CORRECTION REASON *' : 'REMARKS / NOTE (OPTIONAL)'}
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={
                    isCorrection
                      ? 'State reason for this attendance update...'
                      : 'e.g. 2nd floor wall plastering, on time'
                  }
                  placeholderTextColor="#94A3B8"
                  style={styles.notesInputField}
                />
              </View>
            </ScrollView>

            {/* Bottom Action Footer */}
            <View style={styles.footerContainer}>
              <Pressable
                onPress={() => !busy && onClose()}
                disabled={busy}
                style={styles.cancelFooterBtn}
              >
                <Text style={styles.cancelFooterBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveFooterBtn,
                  busy && { opacity: 0.6 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="checkmark" size={17} color="#FFFFFF" />
                    <Text style={styles.saveFooterBtnText}>
                      {isCorrection ? 'Update Attendance' : 'Save Attendance'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* Calendar Picker Modal */}
          {isCalendarOpen && (
            <CalendarPickerModal
              visible={isCalendarOpen}
              title="Select Attendance Date"
              selectedDate={date}
              maxDate={today()}
              onSelect={(newDate) => {
                if (newDate) {
                  if (newDate > today()) {
                    setLocalError('Attendance cannot be marked for future dates.');
                    return;
                  }
                  setDate(newDate);
                }
              }}
              onClose={() => setIsCalendarOpen(false)}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  modalCardDesktop: {
    maxWidth: 480,
    width: '100%',
    maxHeight: '92%',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { outline: 'none' } : {}),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  errorBannerText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },

  /* 1. Worker Hero Card */
  workerHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  workerHeroName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  workerHeroSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  skillBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  switchWorkerContainer: {
    position: 'relative',
  },
  switchWorkerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  switchWorkerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* 2. Site & Date Row */
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 46,
    position: 'relative',
  },
  metaPillLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  metaPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },

  /* Common Section Card */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 10,
    color: '#94A3B8',
  },

  /* 3. Attendance Status Grid */
  statusGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  statusCardActivePresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  statusCardActiveHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  statusCardActiveAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  statusCardInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusCardName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusCardNameActivePresent: {
    color: '#15803D',
    fontWeight: '800',
  },
  statusCardNameActiveHalf: {
    color: '#B45309',
    fontWeight: '800',
  },
  statusCardNameActiveAbsent: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  statusCardWage: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginTop: 2,
  },
  statusCardWageActivePresent: {
    color: '#15803D',
  },
  statusCardWageActiveHalf: {
    color: '#B45309',
  },
  statusCardWageActiveAbsent: {
    color: '#B91C1C',
  },
  statusCardSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* 4. Overtime (OT) Controls */
  rateChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  rateChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
  },
  otExtraEarned: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  otDisabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otDisabledText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  otStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  stepperActionBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  stepperActionBtnPlus: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  stepperValueCol: {
    alignItems: 'center',
    flex: 1,
  },
  stepperDurationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  stepperDurationTextActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepperWageText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  otPresetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  otPresetBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  otPresetBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  otPresetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  otPresetBtnTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },

  /* 5. Live Payable Wage Banner */
  wageSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  wageSummaryLeft: {
    gap: 1,
  },
  wageSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  wageSummaryBreakdown: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  wageSummaryTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#15803D',
  },

  /* 6. Remarks Input */
  notesContainer: {
    gap: 4,
  },
  notesInputField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
    height: 38,
  },

  /* Footer Actions */
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelFooterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveFooterBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#2563EB',
  },
  saveFooterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nativeHiddenPicker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
});
