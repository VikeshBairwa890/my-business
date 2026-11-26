import React, { useState, useMemo, useEffect } from 'react';
import {
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
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { TopNavBar } from '../common/TopNavBar';
import { FormSpec, Snapshot } from '../../types';
import { CalendarPickerModal } from '../common/CalendarPickerModal';
import { today } from '../../forms';
import { showToast } from '../../context/ToastContext';

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
  const initialOtHours = useMemo(() => {
    const mins = Number(spec.initial.overtime_minutes || 0);
    return mins > 0 ? String(Math.round(mins / 60)) : '';
  }, [spec.initial.overtime_minutes]);
  const [otHours, setOtHours] = useState<string>(initialOtHours);
  const [notes, setNotes] = useState<string>(spec.initial.notes || '');

  const handleOtHoursChange = (text: string) => {
    // Only whole integer hours allowed: no dots (.), no decimals, only digits 0-9
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      setOtHours('');
      return;
    }
    const val = parseInt(digitsOnly, 10);
    if (val > 16) {
      showToast('Maximum 16 hours overtime allowed', 'w');
      setOtHours('16');
      return;
    }
    setOtHours(String(val));
  };

  // Modals & validation state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedSite = useMemo(
    () => data.sites.find((s) => s.id === siteId) || data.sites[0],
    [data.sites, siteId]
  );
  const selectedWorker = useMemo(
    () => data.workers.find((w) => w.id === workerId) || data.workers[0],
    [data.workers, workerId]
  );

  // Check if attendance already exists for this worker on this date
  const existingAttendance = useMemo(() => {
    if (!workerId || !date) return null;
    const targetDate = String(date).slice(0, 10);
    return (
      (data.attendance || []).find(
        (a) =>
          a.worker_id === workerId &&
          String(a.date).slice(0, 10) === targetDate
      ) || null
    );
  }, [data.attendance, workerId, date]);

  // When workerId or date changes, pre-fill form with existing attendance values
  useEffect(() => {
    if (existingAttendance) {
      const u = Number(existingAttendance.units);
      setUnits(u === 1 ? '1' : u === 0.5 ? '0.5' : '0');
      const otMins = Number(existingAttendance.overtime_minutes || 0);
      setOtHours(otMins > 0 ? String(Math.round(otMins / 60)) : '');
      if (existingAttendance.notes) {
        setNotes(existingAttendance.notes);
      }
    }
  }, [existingAttendance]);

  const existingStatusInfo = useMemo(() => {
    if (!existingAttendance) return null;
    const u = Number(existingAttendance.units);
    const label =
      u === 1
        ? 'उपस्थित (Present)'
        : u === 0.5
          ? 'हाफ डे (Half Day)'
          : 'अनुपस्थित (Absent)';
    const siteObj = data.sites.find((s) => s.id === existingAttendance.site_id);
    const siteName = siteObj?.name || 'Site';
    const otMins = Number(existingAttendance.overtime_minutes || 0);
    const otText = otMins > 0 ? ` • +${Math.round(otMins / 60)}h OT` : '';
    const isSameSite = existingAttendance.site_id === siteId;
    return {
      units: u,
      label,
      siteName,
      otText,
      isSameSite,
      date: String(existingAttendance.date).slice(0, 10),
    };
  }, [existingAttendance, data.sites, siteId]);

  const formattedDate = useMemo(() => {
    if (!date) return 'Select Date';
    try {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }, [date]);

  const handleSave = () => {
    setLocalError('');
    if (!siteId) {
      showToast('Please select a work site', 'e');
      return;
    }
    if (!workerId) {
      showToast('Please select a worker', 'e');
      return;
    }
    if (!date) {
      showToast('Please pick a date', 'e');
      return;
    }
    if (String(date).slice(0, 10) > today()) {
      showToast('Attendance cannot be marked for future dates', 'e');
      return;
    }
    if (isCorrection && !notes.trim()) {
      showToast('Please enter a reason for updating attendance', 'e');
      return;
    }

    const parsedOtHours = parseInt(otHours, 10) || 0;
    const parsedOtMinutes = parsedOtHours * 60;

    // Check if worker already has identical attendance saved on this site for this date
    if (existingAttendance && existingAttendance.site_id === siteId) {
      const existingUnits = Number(existingAttendance.units);
      const existingOtMins = Number(existingAttendance.overtime_minutes || 0);
      const currentUnits = units === '1' ? 1 : units === '0.5' ? 0.5 : 0;
      const currentNotes = notes.trim();
      const existingNotes = (existingAttendance.notes || '').trim();

      if (
        existingUnits === currentUnits &&
        existingOtMins === parsedOtMinutes &&
        existingNotes === currentNotes &&
        !isCorrection
      ) {
        showToast('⚠️ Attendance is already marked for this worker today', 'w');
        return;
      }
    }

    // Check if worker is marked on a different site and total exceeds 1.5
    if (existingAttendance && existingAttendance.site_id !== siteId) {
      const existingUnits = Number(existingAttendance.units);
      const currentUnits = units === '1' ? 1 : units === '0.5' ? 0.5 : 0;
      if (existingUnits + currentUnits > 1.5) {
        const otherSiteName = data.sites.find((s) => s.id === existingAttendance.site_id)?.name || 'another site';
        showToast(`⚠️ This worker is already marked on ${otherSiteName} today`, 'w');
        return;
      }
    }

    onSave({
      site_id: siteId,
      worker_id: workerId,
      date,
      units,
      overtime_minutes: String(parsedOtMinutes),
      notes: notes.trim(),
    });
  };

  const displayError = localError || error;

  return (
    <View style={styles.pageRoot}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 1. STANDARD PAGE TOP NAVBAR */}
        <TopNavBar
          title={isCorrection || existingAttendance ? 'Update Attendance' : 'Mark Attendance'}
          onBack={() => !busy && onClose()}
        />

        {/* Error Banner */}
        {displayError ? (
          <View style={styles.errorBanner}>
            <AppIcon name="alert-circle" size={15} color={Colors.danger} />
            <Text style={styles.errorBannerText}>{displayError}</Text>
          </View>
        ) : null}

        {/* 2. CLEAN, SPACIOUS FORM BODY */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollBody, isDesktop && styles.scrollBodyDesktop]}
          showsVerticalScrollIndicator={false}
        >
          {/* Worker Info Card */}
          <View style={styles.workerCard}>
            <View style={styles.workerAvatar}>
              <Text style={styles.workerAvatarText}>
                {(selectedWorker?.name || 'W').slice(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.workerName} numberOfLines={1}>
                {selectedWorker?.name || 'Select Worker'}
              </Text>
              {selectedWorker?.skill ? (
                <Text style={styles.workerSkill} numberOfLines={1}>
                  {selectedWorker.skill}
                </Text>
              ) : null}
            </View>

            {!isWorkerLocked ? (
              <View style={styles.switchWrap}>
                <View style={styles.switchBtn}>
                  <Text style={styles.switchBtnText}>Change</Text>
                  <AppIcon name="chevron-down" size={13} color="#2563EB" />
                </View>
                <Picker
                  mode="dropdown"
                  selectedValue={workerId}
                  onValueChange={(val: any) => setWorkerId(String(val))}
                  style={styles.hiddenPicker}
                  dropdownIconColor="transparent"
                >
                  {data.workers.filter((w) => w.active).map((w) => (
                    <Picker.Item
                      key={w.id}
                      label={w.skill ? `${w.name} (${w.skill})` : w.name}
                      value={w.id}
                    />
                  ))}
                </Picker>
              </View>
            ) : null}
          </View>

          {/* Site & Date Row */}
          <View style={styles.row2Col}>
            <View style={[styles.selectCard, { flex: 1.1 }]}>
              <AppIcon name="business-outline" size={16} color="#2563EB" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldMiniLabel}>Work Site</Text>
                <Text style={styles.fieldMainVal} numberOfLines={1}>
                  {selectedSite?.name || 'Select Site'}
                </Text>
              </View>
              <AppIcon name="chevron-down" size={14} color="#94A3B8" />
              <Picker
                mode="dropdown"
                selectedValue={siteId}
                onValueChange={(val: any) => setSiteId(String(val))}
                style={styles.hiddenPicker}
                dropdownIconColor="transparent"
              >
                {data.sites.map((s) => (
                  <Picker.Item key={s.id} label={s.name} value={s.id} />
                ))}
              </Picker>
            </View>

            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              style={({ pressed }) => [
                styles.selectCard,
                { flex: 0.9 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <AppIcon name="calendar-outline" size={16} color="#2563EB" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fieldMiniLabel}>Date</Text>
                <Text style={styles.fieldMainVal} numberOfLines={1}>
                  {formattedDate}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Attendance Status — Clean 3 Options */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Status</Text>

            <View style={styles.statusRow}>
              <Pressable
                onPress={() => setUnits('1')}
                style={({ pressed }) => [
                  styles.statusBox,
                  units === '1' && styles.statusBoxPresent,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={units === '1' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={units === '1' ? '#16A34A' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.statusName,
                    units === '1' && styles.statusNamePresent,
                  ]}
                >
                  Present
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setUnits('0.5')}
                style={({ pressed }) => [
                  styles.statusBox,
                  units === '0.5' && styles.statusBoxHalf,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={units === '0.5' ? 'time' : 'ellipse-outline'}
                  size={16}
                  color={units === '0.5' ? '#D97706' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.statusName,
                    units === '0.5' && styles.statusNameHalf,
                  ]}
                >
                  Half Day
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setUnits('0')}
                style={({ pressed }) => [
                  styles.statusBox,
                  units === '0' && styles.statusBoxAbsent,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={units === '0' ? 'close-circle' : 'ellipse-outline'}
                  size={16}
                  color={units === '0' ? '#DC2626' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.statusName,
                    units === '0' && styles.statusNameAbsent,
                  ]}
                >
                  Absent
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Overtime (Hours) Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="time-outline" size={16} color="#D97706" />
                <Text style={styles.cardTitle}>Overtime (Hours)</Text>
              </View>
            </View>

            <View style={styles.otInputRow}>
              <TextInput
                value={otHours}
                onChangeText={handleOtHoursChange}
                placeholder="0"
                keyboardType="number-pad"
                placeholderTextColor="#94A3B8"
                style={styles.otInput}
              />
              <Text style={styles.otUnitText}>Hours</Text>
            </View>
          </View>

          {/* Reason / Note Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isCorrection ? 'Correction Reason *' : 'Note (Optional)'}
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={
                isCorrection
                  ? 'Why are you updating this attendance?'
                  : 'Add any note if needed...'
              }
              placeholderTextColor="#94A3B8"
              style={styles.notesInput}
            />
          </View>
        </ScrollView>

        {/* 3. CLEAN STICKY FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerBtns}>
            <Pressable
              onPress={() => !busy && onClose()}
              disabled={busy}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={busy}
              style={({ pressed }) => [
                styles.saveBtn,
                busy && { opacity: 0.6 },
                pressed && !busy && { opacity: 0.9 },
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isCorrection || existingAttendance
                    ? 'Update Attendance'
                    : 'Save Attendance'}
                </Text>
              )}
            </Pressable>
          </View>
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
                showToast('Attendance cannot be marked for future dates', 'e');
                return;
              }
              setDate(newDate);
            }
          }}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalOverlayDesktop: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
  },
  modalCardDesktop: {
    maxWidth: 460,
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
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
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none' as any } : {}),
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none' as any } : {}),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  scrollBody: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  scrollBodyDesktop: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 18,
  },

  /* Worker Strip */
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  workerSkill: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  ratePill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  ratePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  switchWrap: {
    position: 'relative',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Site & Date Row */
  row2Col: {
    flexDirection: 'row',
    gap: 10,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  fieldMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  fieldMainVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },

  /* Clean White Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  /* Attendance Status */
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBox: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 5,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  statusBoxPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  statusBoxHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  statusBoxAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  statusName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  statusNamePresent: {
    color: '#15803D',
  },
  statusNameHalf: {
    color: '#B45309',
  },
  statusNameAbsent: {
    color: '#B91C1C',
  },
  statusAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Overtime */
  addOtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  addOtBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  removeOtBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  customTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  customTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  otStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  stepBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  stepBtnPlus: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  otCenter: {
    flex: 1,
    alignItems: 'center',
  },
  otDurationVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  otDurationValActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  otEarnedVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginTop: 1,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  quickChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Notes */
  notesInput: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },

  /* Sticky Footer */
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    gap: 10,
  },
  footerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
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
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
  },
  otInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
  },
  otUnitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  hiddenPicker: {
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
  alreadyMarkedBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 4,
  },
  alreadyMarkedBannerOtherSite: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  alreadyMarkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alreadyMarkedTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#92400E',
  },
  alreadyMarkedTitleOtherSite: {
    color: '#B91C1C',
  },
  alreadyMarkedDesc: {
    fontSize: 12.5,
    color: '#B45309',
    lineHeight: 18,
    marginTop: 2,
  },
  alreadyMarkedDescOtherSite: {
    color: '#991B1B',
  },
});
