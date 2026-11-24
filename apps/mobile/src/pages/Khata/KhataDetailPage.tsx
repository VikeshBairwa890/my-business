import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
  Image,
} from 'react-native';
import { money } from '../../../../../shared/finance';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { AppIcon } from '../../components/icons/AppIcon';
import { Colors } from '../../theme/colors';
import { showToast } from '../../context/ToastContext';
import { today } from '../../forms';
import { useLanguage } from '../../i18n';
import {
  getDocFromIndexedDB,
  fetchDocFromServer,
  triggerBrowserDownload,
  viewPdfDocument,
} from '../../storage/docStorage';
import { Row } from '../../types';
import {
  PartySummary,
  buildPartyTimeline,
  formatShortDate,
  getEntryDateStr,
  ymdToDmy,
  dmyToYmd,
  isDebitEntry,
} from './khataUtils';
import { generateKhataLedgerPdf } from './khataReport';

interface KhataDetailPageProps {
  summary: PartySummary;
  allEntries: Row[];
  senderName: string;
  senderPhone?: string;
  onBack: () => void;
  onEditParty: () => void;
  onAddEntry: (isDebit: boolean) => void;
  onEditEntry: (entry: Row) => void;
  onUpdateReminderDate: (partyId: string, reminderDate: string | null) => void;
}

export function KhataDetailPage({
  summary,
  allEntries,
  senderName,
  senderPhone,
  onBack,
  onEditParty,
  onAddEntry,
  onEditEntry,
  onUpdateReminderDate,
}: KhataDetailPageProps) {
  const { t, lang } = useLanguage();
  const { party, balance, totalGave, totalGot, reminderDate } = summary;
  const [viewingProof, setViewingProof] = useState<{
    url: string;
    title: string;
    date?: string;
  } | null>(null);

  const handleOpenProof = async (entry: Row) => {
    const docId = String(entry.proof_url || entry.proofUrl || '');
    const fileName = String(entry.proof_name || entry.proofName || '');
    if (!docId) return;

    let resolvedUrl = docId;

    if (!docId.startsWith('data:') && !docId.startsWith('http')) {
      showToast('Opening proof attachment...', 'i');
      const local = await getDocFromIndexedDB(docId);
      if (local?.dataUrl) {
        resolvedUrl = local.dataUrl;
      } else {
        const remote = await fetchDocFromServer(docId);
        if (remote?.blobUrl) {
          resolvedUrl = remote.blobUrl;
        } else {
          showToast('Could not load proof attachment', 'e');
          return;
        }
      }
    }

    setViewingProof({
      url: resolvedUrl,
      title: fileName || 'Payment Proof',
      date: formatShortDate(entry.date),
    });
  };

  const timeline = useMemo(
    () => buildPartyTimeline(party.id, allEntries),
    [party.id, allEntries]
  );
  const isToGet = balance > 0;
  const [exportingPdf, setExportingPdf] = useState(false);

  // Simple From / To Date Range Filter (empty => All entries)
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [calendarTarget, setCalendarTarget] = useState<'from' | 'to' | 'due' | null>(null);

  const activeRange = useMemo(() => {
    const f = dmyToYmd(customFrom) || '';
    const t = dmyToYmd(customTo) || '';
    const lbl =
      f && t
        ? `${ymdToDmy(f)} - ${ymdToDmy(t)}`
        : f
          ? `From ${ymdToDmy(f)}`
          : t
            ? `Up to ${ymdToDmy(t)}`
            : 'All Time';
    return { from: f, to: t, label: lbl };
  }, [customFrom, customTo]);

  const filteredTimeline = useMemo(() => {
    if (!activeRange.from && !activeRange.to) return timeline;
    return timeline.filter(({ entry }) => {
      const d = getEntryDateStr(entry);
      if (activeRange.from && d < activeRange.from) return false;
      if (activeRange.to && d > activeRange.to) return false;
      return true;
    });
  }, [timeline, activeRange]);

  const handleGeneratePdf = async () => {
    if (filteredTimeline.length === 0) {
      showToast('No entries in selected period for PDF report', 'w');
      return;
    }
    try {
      setExportingPdf(true);
      await generateKhataLedgerPdf(summary, allEntries, senderName, {
        fromDate: activeRange.from,
        toDate: activeRange.to,
        periodLabel: activeRange.label,
        orgPhone: senderPhone,
      });
      showToast(
        Platform.OS === 'web'
          ? 'Report ready to download / save as PDF'
          : 'PDF statement ready to share',
        's'
      );
    } catch {
      showToast('Could not generate PDF report', 'e');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleSetDue = (ymd: string | null) => {
    if (ymd) {
      const todayStr = today();
      if (ymd < todayStr) {
        showToast(
          lang === 'hi'
            ? 'रिमाइंडर Due Date आज या पिछली तारीख से पहले की नहीं हो सकती!'
            : 'Due Date cannot be earlier than today!',
          'e'
        );
        return;
      }
    }
    onUpdateReminderDate(party.id, ymd);
    if (ymd) {
      showToast(
        lang === 'hi'
          ? `रिमाइंडर तारीख ${formatShortDate(ymd)} सेट हो गई`
          : `Due Date set to ${formatShortDate(ymd)}`,
        's'
      );
    } else {
      showToast(
        lang === 'hi' ? 'रिमाइंडर तारीख हटा दी गई' : 'Due date cleared',
        'i'
      );
    }
  };

  return (
    <View style={styles.pageRoot}>
      <TopNavBar
        title={party.name}
        onBack={onBack}
        actions={
          <Pressable
            onPress={onEditParty}
            style={({ pressed }) => [styles.headerEditIconBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Edit Person"
            hitSlop={6}
          >
            <AppIcon name="create-outline" size={19} color={Colors.primary} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. CLEAN 2-CARD SUMMARY ROW (Total Given | Total Received) */}
        <View style={styles.summaryTwoRow}>
          <View style={styles.miniCard}>
            <View style={styles.cardLabelRow}>
              <View style={[styles.cardIconDot, { backgroundColor: '#FEF2F2' }]}>
                <AppIcon name="arrow-up" size={12} color="#DC2626" />
              </View>
              <Text style={styles.miniCardLabel} numberOfLines={1}>
                Total Given
              </Text>
            </View>
            <Text
              style={[styles.miniCardValue, { color: '#DC2626' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {money(totalGave)}
            </Text>
          </View>

          <View style={styles.miniCard}>
            <View style={styles.cardLabelRow}>
              <View style={[styles.cardIconDot, { backgroundColor: '#ECFDF5' }]}>
                <AppIcon name="arrow-down" size={12} color="#059669" />
              </View>
              <Text style={styles.miniCardLabel} numberOfLines={1}>
                Total Received
              </Text>
            </View>
            <Text
              style={[styles.miniCardValue, { color: '#059669' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {money(totalGot)}
            </Text>
          </View>
        </View>

        {/* 2. SIMPLE FROM / TO DATE RANGE (Directly below Amount Cards) */}
        {timeline.length > 0 ? (
          <View style={styles.customRangeRow}>
            <View style={styles.customDateCol}>
              <Text style={styles.customDateLabel}>From</Text>
              <Pressable
                onPress={() => setCalendarTarget('from')}
                style={({ pressed }) => [
                  styles.customDateInputWrap,
                  pressed && { opacity: 0.85, borderColor: Colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.customDateText,
                    !customFrom && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {customFrom || 'Select Date'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {customFrom ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setCustomFrom('');
                      }}
                      hitSlop={6}
                    >
                      <AppIcon name="close-circle" size={15} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                  <AppIcon name="calendar-outline" size={16} color={Colors.primary} />
                </View>
              </Pressable>
            </View>

            <View style={styles.customDateCol}>
              <Text style={styles.customDateLabel}>To</Text>
              <Pressable
                onPress={() => setCalendarTarget('to')}
                style={({ pressed }) => [
                  styles.customDateInputWrap,
                  pressed && { opacity: 0.85, borderColor: Colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.customDateText,
                    !customTo && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {customTo || 'Select Date'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {customTo ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setCustomTo('');
                      }}
                      hitSlop={6}
                    >
                      <AppIcon name="close-circle" size={15} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                  <AppIcon name="calendar-outline" size={16} color={Colors.primary} />
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* 3. MATCHING 2-BUTTON ACTION ROW (Due Date | Download PDF) */}
        {(isToGet || timeline.length > 0) ? (
          <View style={styles.dualActionRow}>
            {isToGet ? (
              <Pressable
                onPress={() => setCalendarTarget('due')}
                style={({ pressed }) => [
                  styles.dualActionBtn,
                  reminderDate && styles.dualActionBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityLabel="Set Due Date"
              >
                <View style={[styles.dualActionIconDot, { backgroundColor: '#FFFBEB' }]}>
                  <AppIcon name="calendar-outline" size={16} color="#D97706" />
                </View>
                <Text style={styles.dualActionText} numberOfLines={1}>
                  {reminderDate ? `Due: ${formatShortDate(reminderDate)}` : 'Due Date'}
                </Text>
              </Pressable>
            ) : null}

            {timeline.length > 0 ? (
              <Pressable
                onPress={handleGeneratePdf}
                disabled={exportingPdf}
                style={({ pressed }) => [
                  styles.dualActionBtn,
                  (pressed || exportingPdf) && { opacity: 0.8 },
                ]}
                accessibilityLabel="Download PDF Statement"
              >
                <View style={[styles.dualActionIconDot, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="download-outline" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.dualActionText} numberOfLines={1}>
                  {exportingPdf ? 'Generating...' : 'Download PDF'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* 4. UNIFIED CLEAN LEDGER CARD */}
        {filteredTimeline.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <AppIcon name="book-outline" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {timeline.length === 0 ? 'No transactions yet' : 'No entries in this period'}
            </Text>
          </View>
        ) : (
          <View style={styles.ledgerCard}>
            {/* Table Column Header */}
            <View style={styles.ledgerHeader}>
              <Text style={[styles.ledgerHeaderCol, { flex: 1.5 }]}>
                ENTRIES ({filteredTimeline.length})
              </Text>
              <Text style={[styles.ledgerHeaderCol, styles.colRight, { color: '#DC2626' }]}>
                YOU GAVE
              </Text>
              <Text style={[styles.ledgerHeaderCol, styles.colRight, { color: '#059669' }]}>
                YOU GOT
              </Text>
            </View>

            {/* Entry Rows */}
            {filteredTimeline.map(({ entry }, idx) => {
              const isGave = isDebitEntry(entry);
              const isLast = idx === filteredTimeline.length - 1;
              const proofUrl = String(entry.proof_url || entry.proofUrl || '');
              const proofName = String(entry.proof_name || entry.proofName || '');
              const proofMime = String(entry.proof_mime || entry.proofMime || '');
              const isPdfProof =
                proofMime.toLowerCase().includes('pdf') ||
                proofName.toLowerCase().endsWith('.pdf');

              return (
                <Pressable
                  key={entry.id}
                  onPress={() => onEditEntry(entry)}
                  style={({ pressed }) => [
                    styles.entryRow,
                    !isLast && styles.entryRowDivider,
                    pressed && { backgroundColor: '#F8FAFC' },
                  ]}
                >
                  {/* Left: Date, Mode, Note & Optional Proof Pill */}
                  <View style={{ flex: 1.5, paddingRight: 8, justifyContent: 'center' }}>
                    <View style={styles.entryDateRow}>
                      <Text style={styles.entryDateText}>{formatShortDate(entry.date)}</Text>
                      {entry.mode && entry.mode !== 'CASH' ? (
                        <View style={styles.modeBadge}>
                          <Text style={styles.modeBadgeText}>
                            {entry.mode === 'BANK_TRANSFER' ? 'BANK' : entry.mode}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {entry.note ? (
                      <Text style={styles.entryNote} numberOfLines={2}>
                        {entry.note}
                      </Text>
                    ) : null}
                    {proofUrl ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleOpenProof(entry);
                        }}
                        style={({ pressed }) => [styles.proofTagBtn, pressed && { opacity: 0.7 }]}
                        hitSlop={6}
                      >
                        <AppIcon
                          name={isPdfProof ? 'document-text-outline' : 'image-outline'}
                          size={11}
                          color={isPdfProof ? '#DC2626' : Colors.primary}
                        />
                        <Text
                          style={[
                            styles.proofTagText,
                            isPdfProof && { color: '#DC2626' },
                          ]}
                        >
                          {isPdfProof ? 'PDF Proof' : 'View Photo'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Middle: YOU GAVE (Red) */}
                  <View style={styles.amountCol}>
                    {isGave ? (
                      <Text style={styles.gaveAmtText}>{money(entry.amount)}</Text>
                    ) : (
                      <Text style={styles.dashText}>—</Text>
                    )}
                  </View>

                  {/* Right: YOU GOT (Green) */}
                  <View style={styles.amountCol}>
                    {!isGave ? (
                      <Text style={styles.gotAmtText}>{money(entry.amount)}</Text>
                    ) : (
                      <Text style={styles.dashText}>—</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {party.notes ? (
          <View style={styles.notesFooterCard}>
            <AppIcon name="document-text-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.notesFooterText}>{party.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky 50/50 Bottom Action Footer: YOU GAVE | YOU GOT */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => onAddEntry(true)}
          style={({ pressed }) => [styles.gaveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.bottomBtnMain}>YOU GAVE ₹</Text>
        </Pressable>

        <Pressable
          onPress={() => onAddEntry(false)}
          style={({ pressed }) => [styles.gotBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.bottomBtnMain}>YOU GOT ₹</Text>
        </Pressable>
      </View>

      {/* Photo Proof Viewer Modal */}
      <BillImageViewerModal
        visible={Boolean(viewingProof)}
        imageUrl={viewingProof?.url || ''}
        title={viewingProof?.title || 'Payment Proof'}
        date={viewingProof?.date}
        party={party.name}
        onClose={() => setViewingProof(null)}
      />

      {/* Custom Date Range Calendar Modal */}
      <CalendarPickerModal
        visible={calendarTarget !== null}
        title={
          calendarTarget === 'from'
            ? 'Select Start Date'
            : calendarTarget === 'to'
              ? 'Select End Date'
              : 'Select Due Date'
        }
        allowClear={calendarTarget === 'due'}
        minDate={calendarTarget === 'due' ? today() : undefined}
        minDateMessage={
          lang === 'hi'
            ? 'रिमाइंडर Due Date आज या पिछली तारीख से पहले की नहीं हो सकती!'
            : 'Due Date cannot be earlier than today!'
        }
        selectedDate={
          calendarTarget === 'from'
            ? dmyToYmd(customFrom) || today()
            : calendarTarget === 'to'
              ? dmyToYmd(customTo) || today()
              : reminderDate || today()
        }
        onSelect={(picked) => {
          const dmy = ymdToDmy(picked);
          if (calendarTarget === 'from') setCustomFrom(dmy);
          else if (calendarTarget === 'to') setCustomTo(dmy);
          else if (calendarTarget === 'due') {
            handleSetDue(picked || null);
          }
          setCalendarTarget(null);
        }}
        onClose={() => setCalendarTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    resizeMode: 'cover',
  },
  headerEditIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  reportIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reportPeriodSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 1,
  },
  reportDownloadIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 7,
  },
  rangePill: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  rangePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  rangePillTextActive: {
    color: '#FFFFFF',
  },
  customRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customDateCol: {
    flex: 1,
    gap: 4,
  },
  customDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    paddingLeft: 2,
  },
  customDateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 10,
    height: 42,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  customDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  customDateInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
    gap: 12,
  },

  /* 1. CLEAN 2-CARD SUMMARY ROW */
  summaryTwoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniCard: {
    flex: 1,
    height: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardIconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  miniCardValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  dueBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryDark,
  },

  /* 2. MATCHING 2-BUTTON ACTION ROW (Due Date | Download PDF) */
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dualActionBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 6px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  dualActionBtnActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  dualActionIconDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  /* Due Date Picker */
  duePickerCard: {
    backgroundColor: '#FFFDF7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  duePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  duePickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  duePickerTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  dueCloseBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  dueQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dueQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dueCustomRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  dueCustomInput: {
    flex: 1,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  dueCustomPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  dueCustomText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dueApplyBtn: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueApplyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* 3. UNIFIED LEDGER CARD */
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ledgerHeaderCol: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  colRight: {
    textAlign: 'right',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  entryRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  entryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  entryNote: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 3,
  },
  proofTagBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  proofTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  amountCol: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  gaveAmtText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  gotAmtText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  dashText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
  },

  /* Empty & Notes */
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  notesFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesFooterText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  /* Bottom 50/50 Action Footer */
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  gaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnMain: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
