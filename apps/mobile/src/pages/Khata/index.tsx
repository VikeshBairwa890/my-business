import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { money } from '../../../../../shared/finance';
import { TopNavBar, formatNameInitials } from '../../components/common/TopNavBar';
import { AppIcon } from '../../components/icons/AppIcon';
import { Colors } from '../../theme/colors';
import { showToast } from '../../context/ToastContext';
import { Row, Snapshot } from '../../types';
import {
  computePartySummary,
  computeKhataTotals,
  openWhatsAppReminder,
  openSmsReminder,
  isDebitEntry,
  KhataCategory,
  PartySummary,
} from './khataUtils';
import { KhataDetailPage } from './KhataDetailPage';
import { KhataPartyFormPage } from './KhataPartyFormPage';
import { KhataEntryFormPage } from './KhataEntryFormPage';

type FilterKey = 'ALL' | 'TO_GET' | 'TO_GIVE' | 'FRIEND' | 'LABOUR' | 'SETTLED';

type SubMode =
  | { view: 'list' }
  | { view: 'detail'; partyId: string }
  | { view: 'addParty' }
  | { view: 'editParty'; partyId: string }
  | { view: 'addEntry'; partyId: string; isDebit: boolean }
  | { view: 'editEntry'; partyId: string; entry: Row };

export interface KhataPageProps {
  data: Snapshot;
  selectedPartyId?: string | null;
  onSelectParty?: (partyId: string | null) => void;
  onBack: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onKhataCommand: (
    action:
      | 'khata.partyCreate'
      | 'khata.partyUpdate'
      | 'khata.partyDelete'
      | 'khata.entryCreate'
      | 'khata.entryUpdate'
      | 'khata.entryDelete',
    payload: Record<string, any>,
    entityId?: string
  ) => string;
}

export function KhataPage({
  data,
  selectedPartyId,
  onSelectParty,
  onBack,
  refreshing = false,
  onRefresh,
  onKhataCommand,
}: KhataPageProps) {
  const parties = data.khataParties ?? [];
  const entries = data.khataEntries ?? [];
  const workers = data.workers ?? [];
  const senderName = data.organization?.name || data.user?.name || 'ThekaBook';
  const senderPhone = data.organization?.phone || data.user?.phone || '';

  const [mode, setMode] = useState<SubMode>(
    selectedPartyId ? { view: 'detail', partyId: selectedPartyId } : { view: 'list' }
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [remindTarget, setRemindTarget] = useState<PartySummary | null>(null);

  useEffect(() => {
    if (selectedPartyId) {
      setMode((cur) =>
        cur.view === 'detail' && cur.partyId === selectedPartyId
          ? cur
          : { view: 'detail', partyId: selectedPartyId }
      );
    } else if (mode.view === 'detail') {
      setMode({ view: 'list' });
    }
  }, [selectedPartyId]);

  const summaries = useMemo(() => {
    return parties.map((p) => computePartySummary(p, entries));
  }, [parties, entries]);

  const totals = useMemo(() => computeKhataTotals(summaries), [summaries]);

  const counts = useMemo(() => {
    let toGet = 0;
    let toGive = 0;
    let friend = 0;
    let labour = 0;
    let settled = 0;

    for (const s of summaries) {
      if (s.balance > 0) toGet++;
      else if (s.balance < 0) toGive++;
      else settled++;

      const cat = String(s.party.category || '').toUpperCase();
      if (cat === 'FRIEND') friend++;
      if (cat === 'LABOUR') labour++;
    }
    return { all: summaries.length, toGet, toGive, friend, labour, settled };
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = summaries.filter((s) => {
      if (filter === 'TO_GET' && s.balance <= 0) return false;
      if (filter === 'TO_GIVE' && s.balance >= 0) return false;
      if (filter === 'SETTLED' && s.balance !== 0) return false;
      if (filter === 'LABOUR' && String(s.party.category).toUpperCase() !== 'LABOUR') return false;
      if (filter === 'FRIEND' && String(s.party.category).toUpperCase() !== 'FRIEND') return false;
      if (q) {
        const nameMatch = String(s.party.name || '').toLowerCase().includes(q);
        const phoneMatch = String(s.party.phone || '').toLowerCase().includes(q);
        const catMatch = String(s.party.category || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || catMatch;
      }
      return true;
    });

    return list.sort((a, b) => b.lastActivityTs - a.lastActivityTs);
  }, [summaries, search, filter]);

  const openPartyDetail = (partyId: string) => {
    setMode({ view: 'detail', partyId });
    onSelectParty?.(partyId);
  };

  const backToList = () => {
    setMode({ view: 'list' });
    onSelectParty?.(null);
  };

  // --- Sub-Page: Add Person ---
  if (mode.view === 'addParty') {
    return (
      <KhataPartyFormPage
        workers={workers}
        existingParties={parties}
        onBack={backToList}
        onSave={(vals) => {
          const newPartyId = onKhataCommand('khata.partyCreate', vals);
          openPartyDetail(newPartyId);
        }}
      />
    );
  }

  // --- Sub-Page: Edit Person ---
  if (mode.view === 'editParty') {
    const party = parties.find((p) => p.id === mode.partyId);
    if (!party) {
      backToList();
      return null;
    }
    const partyEntryCount = entries.filter(
      (e) => (e.party_id || e.partyId) === party.id
    ).length;
    return (
      <KhataPartyFormPage
        party={party}
        entryCount={partyEntryCount}
        workers={workers}
        existingParties={parties}
        onBack={() => openPartyDetail(party.id)}
        onSave={(vals: {
          name: string;
          phone: string;
          category: KhataCategory;
          worker_id?: string | null;
          reminder_date?: string | null;
          notes: string;
          photo?: string;
        }) => {
          onKhataCommand('khata.partyUpdate', vals, party.id);
          openPartyDetail(party.id);
        }}
        onDelete={(partyId) => {
          onKhataCommand('khata.partyDelete', {}, partyId);
          backToList();
        }}
      />
    );
  }

  // --- Sub-Page: Add Entry (GAVE / GOT) ---
  if (mode.view === 'addEntry') {
    const party = parties.find((p) => p.id === mode.partyId);
    if (!party) {
      backToList();
      return null;
    }
    return (
      <KhataEntryFormPage
        party={party}
        initialIsDebit={mode.isDebit}
        onBack={() => openPartyDetail(party.id)}
        onSave={(vals) => {
          onKhataCommand('khata.entryCreate', vals);
          openPartyDetail(party.id);
        }}
      />
    );
  }

  // --- Sub-Page: Edit / Delete Entry ---
  if (mode.view === 'editEntry') {
    const party = parties.find((p) => p.id === mode.partyId);
    if (!party) {
      backToList();
      return null;
    }
    return (
      <KhataEntryFormPage
        party={party}
        initialIsDebit={isDebitEntry(mode.entry)}
        entry={mode.entry}
        onBack={() => openPartyDetail(party.id)}
        onSave={(vals) => {
          onKhataCommand('khata.entryUpdate', vals, mode.entry.id);
          openPartyDetail(party.id);
        }}
        onDelete={(entryId) => {
          onKhataCommand('khata.entryDelete', { party_id: party.id }, entryId);
          openPartyDetail(party.id);
        }}
      />
    );
  }

  // --- Sub-Page: Party Ledger Detail ---
  if (mode.view === 'detail') {
    const summary = summaries.find((s) => s.party.id === mode.partyId);
    if (!summary) {
      backToList();
      return null;
    }
    return (
      <KhataDetailPage
        summary={summary}
        allEntries={entries}
        senderName={senderName}
        senderPhone={senderPhone}
        onBack={backToList}
        onEditParty={() => setMode({ view: 'editParty', partyId: summary.party.id })}
        onAddEntry={(isDebit) =>
          setMode({ view: 'addEntry', partyId: summary.party.id, isDebit })
        }
        onEditEntry={(entry) =>
          setMode({ view: 'editEntry', partyId: summary.party.id, entry })
        }
        onUpdateReminderDate={(partyId, reminderDate) => {
          onKhataCommand('khata.partyUpdate', { reminder_date: reminderDate }, partyId);
        }}
      />
    );
  }

  const filterChips: { key: FilterKey; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'TO_GET', label: 'To Receive', count: counts.toGet },
    { key: 'TO_GIVE', label: 'To Pay', count: counts.toGive },
    { key: 'FRIEND', label: 'Friends', count: counts.friend },
    { key: 'LABOUR', label: 'Workers', count: counts.labour },
    { key: 'SETTLED', label: 'Settled', count: counts.settled },
  ];

  // --- Main View: Clean Balanced Fintech Khata Book Dashboard ---
  return (
    <View style={styles.pageRoot}>
      <TopNavBar
        title="Khata Book"
        subtitle="Personal & Party Ledger"
        onBack={onBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          ) : undefined
        }
      >
        {/* 1. FIXED-SIZE DUAL SUMMARY CARDS (You will give | You will get) - Non-clickable View Only */}
        <View style={styles.summaryRow}>
          <View style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <View style={[styles.statIconDot, { backgroundColor: '#ECFDF5' }]}>
                <AppIcon name="arrow-up" size={12} color="#059669" />
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                You will give
              </Text>
            </View>
            <Text
              style={[styles.statAmount, { color: '#059669' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {money(totals.totalToGive)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <View style={[styles.statIconDot, { backgroundColor: '#FEF2F2' }]}>
                <AppIcon name="arrow-down" size={12} color="#DC2626" />
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                You will get
              </Text>
            </View>
            <Text
              style={[styles.statAmount, { color: '#DC2626' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {money(totals.totalToGet)}
            </Text>
          </View>
        </View>

        {/* 2. SEARCH BAR */}
        <View style={styles.searchWrap}>
          <AppIcon name="search-outline" size={17} color={Colors.textSubtle} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or mobile number..."
            placeholderTextColor="#94A3B8"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <AppIcon name="close-circle" size={17} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        {/* 3. UNIFIED PASSBOOK LIST CARD OR EMPTY STATE */}
        {filteredSummaries.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <AppIcon name="book-outline" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {parties.length === 0 ? 'Start Your Khata Book' : 'No matching person found'}
            </Text>
            {parties.length === 0 ? (
              <>
                <Text style={styles.emptyDesc}>
                  Record personal credit and debit entries for friends, workers, or any party and send WhatsApp or SMS reminders.
                </Text>
                <Pressable
                  onPress={() => setMode({ view: 'addParty' })}
                  style={({ pressed }) => [styles.emptyCtaBtn, pressed && { opacity: 0.85 }]}
                >
                  <AppIcon name="person-add-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.emptyCtaText}>Add First Person</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.listCard}>
            {/* Subtle List Top Header */}
            <View style={styles.listTopHeader}>
              <Text style={styles.listTopTitle}>
                {filter === 'ALL'
                  ? `Accounts (${filteredSummaries.length})`
                  : `${filterChips.find((c) => c.key === filter)?.label} (${filteredSummaries.length})`}
              </Text>
              <Text style={styles.listTopSub}>Tap to view ledger</Text>
            </View>

            {filteredSummaries.map((s, idx) => {
              const isToGet = s.balance > 0;
              const isToGive = s.balance < 0;
              const amtColor = isToGet ? '#DC2626' : isToGive ? '#059669' : Colors.textMuted;
              const isLast = idx === filteredSummaries.length - 1;

              return (
                <Pressable
                  key={s.party.id}
                  onPress={() => openPartyDetail(s.party.id)}
                  style={({ pressed }) => [
                    styles.rowItem,
                    !isLast && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  {/* Calm Uniform Avatar */}
                  <View style={styles.avatar}>
                    {s.party.photo ? (
                      <Image source={{ uri: s.party.photo }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {formatNameInitials(s.party.name, 'K')}
                      </Text>
                    )}
                  </View>

                  {/* Middle Info */}
                  <View style={styles.rowMiddle}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {s.party.name}
                    </Text>
                  </View>

                  {/* Right Balance + Remind Button (ONLY when balance > 0) */}
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowAmount, { color: amtColor }]}>
                      {money(Math.abs(s.balance))}
                    </Text>
                    {isToGet ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setRemindTarget(s);
                        }}
                        style={({ pressed }) => [
                          styles.remindPillBtn,
                          pressed && { opacity: 0.75 },
                        ]}
                        hitSlop={6}
                        accessibilityLabel={`Remind ${s.party.name}`}
                      >
                        <AppIcon name="notifications-outline" size={12} color={Colors.primary} />
                        <Text style={styles.remindPillText}>Remind</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* CLEAN ROYAL BLUE FLOATING ADD PERSON PILL */}
      <Pressable
        onPress={() => setMode({ view: 'addParty' })}
        style={({ pressed }) => [styles.fabAddPill, pressed && styles.fabAddPillPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add Person"
      >
        <AppIcon name="person-add-outline" size={17} color="#FFFFFF" />
        <Text style={styles.fabAddPillText}>Add Person</Text>
      </Pressable>

      {/* REMIND OPTIONS POPUP (WhatsApp or SMS — only for receivable balance > 0) */}
      {remindTarget && remindTarget.balance > 0 ? (
        <View style={styles.popupBackdrop}>
          <Pressable style={styles.popupDismiss} onPress={() => setRemindTarget(null)} />
          <View style={styles.popupCard}>
            <View style={styles.popupHandle} />

            {/* Header with Close Button */}
            <View style={styles.popupHeaderRow}>
              <Text style={styles.popupTitle}>Send Payment Reminder</Text>
              <Pressable
                onPress={() => setRemindTarget(null)}
                style={({ pressed }) => [styles.popupCloseIcon, pressed && { opacity: 0.7 }]}
                hitSlop={8}
                accessibilityLabel="Close"
              >
                <AppIcon name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Compact Person & Pending Amount Summary Strip */}
            <View style={styles.popupPersonBox}>
              <View style={styles.popupAvatar}>
                {remindTarget.party.photo ? (
                  <Image source={{ uri: remindTarget.party.photo }} style={styles.popupAvatarImg} />
                ) : (
                  <Text style={styles.popupAvatarText}>
                    {formatNameInitials(remindTarget.party.name, 'K')}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupPersonName} numberOfLines={1}>
                  {remindTarget.party.name}
                </Text>
                <Text style={styles.popupPersonPhone} numberOfLines={1}>
                  {remindTarget.party.phone ? `+91 ${remindTarget.party.phone}` : 'No mobile number'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.popupPendingAmt}>{money(remindTarget.balance)}</Text>
                <Text style={styles.popupPendingLabel}>Pending</Text>
              </View>
            </View>

            {/* Clean 50/50 Side-by-Side Channel Tiles */}
            <View style={styles.popupGrid}>
              <Pressable
                onPress={() => {
                  const target = remindTarget;
                  setRemindTarget(null);
                  openWhatsAppReminder(
                    target.party,
                    target.balance,
                    senderName,
                    target.lastEntryDate,
                    (m) => showToast(m, 'w')
                  );
                }}
                style={({ pressed }) => [
                  styles.popupTile,
                  styles.popupTileWhatsapp,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.popupTileIconCircle, { backgroundColor: '#16A34A' }]}>
                  <AppIcon name="logo-whatsapp" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.popupTileTitle}>WhatsApp</Text>
                <Text style={styles.popupTileSub}>Send reminder</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const target = remindTarget;
                  setRemindTarget(null);
                  openSmsReminder(
                    target.party,
                    target.balance,
                    senderName,
                    target.lastEntryDate,
                    (m) => showToast(m, 'w')
                  );
                }}
                style={({ pressed }) => [
                  styles.popupTile,
                  styles.popupTileSms,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.popupTileIconCircle, { backgroundColor: '#2563EB' }]}>
                  <AppIcon name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.popupTileTitle}>SMS</Text>
                <Text style={styles.popupTileSub}>Text message</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 92,
    gap: 12,
  },

  /* 1. FIXED-SIZE DUAL SUMMARY CARDS */
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    height: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statIconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  statAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  /* 2. SEARCH BAR */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },

  /* 3. FILTER CHIPS */
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipCount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSubtle,
  },
  filterChipCountActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },

  /* 4. UNIFIED PASSBOOK LIST CARD */
  listCard: {
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
  listTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listTopTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listTopSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSubtle,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowPressed: {
    backgroundColor: '#F8FAFC',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  rowMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  remindPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  remindPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },

  /* REMIND OPTIONS POPUP */
  popupBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  popupDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popupCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 22,
    ...Platform.select({
      web: { boxShadow: '0 -8px 30px rgba(15, 23, 42, 0.16)' } as any,
      default: { elevation: 16 },
    }),
  },
  popupHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  popupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  popupCloseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupPersonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 14,
  },
  popupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  popupAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  popupAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  popupPersonName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  popupPersonPhone: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 2,
  },
  popupPendingAmt: {
    fontSize: 17,
    fontWeight: '800',
    color: '#DC2626',
  },
  popupPendingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSubtle,
    marginTop: 1,
  },
  popupGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  popupTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  popupTileWhatsapp: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  popupTileSms: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  popupTileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  popupTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  popupTileSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  /* EMPTY STATE */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyCtaBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyResetBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  /* FLOATING ADD PERSON PILL */
  fabAddPill: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 24,
    ...Platform.select({
      web: { boxShadow: '0 6px 18px rgba(37, 99, 235, 0.30)' } as any,
      default: { elevation: 6 },
    }),
  },
  fabAddPillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fabAddPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
