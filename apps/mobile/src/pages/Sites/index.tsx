import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { MetricCard } from '../../components/common/MetricCard';
import { SearchBar } from '../../components/common/SearchBar';
import { EmptyState } from '../../components/common/EmptyState';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { money, siteSummary } from '../../finance';
import { parseSiteNotesAndDocs } from '../../components/sites/SiteFormModal';
import { downloadSiteDocument, viewSiteDocument } from '../../report';
import { useLanguage } from '../../i18n';
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { getDocFromIndexedDB, fetchDocFromServer } from '../../storage/docStorage';

interface SitesPageProps {
  data: Snapshot;
  selectedSiteId: string | null;
  fromNotifications?: boolean;
  onBackFromDetail?: () => void;
  onSelectSite: (siteId: string | null) => void;
  onOpenNewSite: () => void;
  onEditSite: (site: Row) => void;
  onOpenEntry: (kind: string, siteId?: string) => void;
  onOpenAttendance: (siteId?: string) => void;
  onShareReport: (siteId: string) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

function getSiteStatusTheme(status: string) {
  switch (status) {
    case 'ONGOING':
      return {
        color: '#16A34A',
        accent: '#22C55E',
        bg: '#F0FDF4',
        badgeBg: '#DCFCE7',
      };
    case 'COMPLETED':
      return {
        color: '#2563EB',
        accent: '#3B82F6',
        bg: '#EFF6FF',
        badgeBg: '#DBEAFE',
      };
    case 'PAUSED':
      return {
        color: '#D97706',
        accent: '#F59E0B',
        bg: '#FFFBEB',
        badgeBg: '#FEF3C7',
      };
    case 'UPCOMING':
    default:
      return {
        color: '#2563EB',
        accent: '#3B82F6',
        bg: '#EFF6FF',
        badgeBg: '#DBEAFE',
      };
  }
}

function formatHumanDate(d?: string | null): string {
  if (!d) return '—';
  try {
    const parts = String(d).slice(0, 10).split('-');
    if (parts.length === 3) {
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const day = parseInt(parts[2], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      if (!isNaN(day) && monthIdx >= 0 && monthIdx < 12) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    return String(d);
  } catch {
    return String(d);
  }
}

export function SitesPage({
  data,
  selectedSiteId,
  fromNotifications = false,
  onBackFromDetail,
  onSelectSite,
  onOpenNewSite,
  onEditSite,
  onOpenEntry,
  onOpenAttendance,
  onShareReport,
  onOpenProfile,
  onBack,
  refreshing,
  onRefresh,
}: SitesPageProps) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [termsExpanded, setTermsExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Bill & Parchi photo viewer state
  const [viewingDoc, setViewingDoc] = useState<{
    url: string;
    title: string;
    date: string;
    amount: number | string;
    party: string;
  } | null>(null);

  const handleOpenDoc = async (docId: string, entry: Row) => {
    try {
      const local = await getDocFromIndexedDB(docId);
      if (local && local.dataUrl) {
        setViewingDoc({
          url: local.dataUrl,
          title: entry.description || 'Bill Photo',
          date: String(entry.date).slice(0, 10),
          amount: entry.amount,
          party: entry.party || '',
        });
        return;
      }
      const remote = await fetchDocFromServer(docId);
      if (remote && remote.blobUrl) {
        setViewingDoc({
          url: remote.blobUrl,
          title: entry.description || 'Bill Photo',
          date: String(entry.date).slice(0, 10),
          amount: entry.amount,
          party: entry.party || '',
        });
      }
    } catch (err) {
      console.warn('Could not open doc:', err);
    }
  };

  const site = selectedSiteId
    ? data.sites.find((s) => s.id === selectedSiteId)
    : null;

  // Render Single Site Details View
  if (site) {
    const f = siteSummary(site, data.attendance, data.entries);
    const { userNotes, documents, gstin, state, stateCode, businessName } =
      parseSiteNotesAndDocs(site.notes || '');
    const noteLines = userNotes
      ? userNotes.split('\n').filter((l) => l.trim().length > 0)
      : [];
    const isLongNotes = noteLines.length > 4 || userNotes.length > 250;
    const siteEntries = data.entries
      .filter((e) => e.site_id === site.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const statusTheme = getSiteStatusTheme(site.status);
    const statusBadgeLabel =
      site.status === 'ONGOING'
        ? t('active', 'Active')
        : site.status === 'COMPLETED'
          ? t('completed', 'Completed')
          : site.status === 'PAUSED'
            ? t('paused', 'Paused')
            : t('upcoming', 'Upcoming');

    return (
      <View style={styles.pageWrapper}>
        <TopNavBar
          title={t('siteDetails', 'Site Details')}
          icon="business"
          userInitials={data.user.name}
          organizationName={data.organization.name}
          onOpenProfile={onOpenProfile}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onBack={fromNotifications && onBackFromDetail ? onBackFromDetail : () => onSelectSite(null)}
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
            {/* Executive Site Overview Card (Option 2: Executive Matrix Style) */}
            <View style={styles.siteHeaderCard}>
              {/* Header Top Row: Title on Left, Status Badge + Edit on Right */}
              <View style={styles.headerTopRow}>
                <View style={styles.headerTitleCol}>
                  <Text style={styles.headerSiteName} numberOfLines={1}>
                    {site.name}
                  </Text>

                  {/* Clean Subtitle: Location & Optional Business */}
                  {(site.address || businessName) ? (
                    <View style={styles.headerSubtitleRow}>
                      <AppIcon name="location-outline" size={13} color="#64748B" />
                      <Text style={styles.headerLocationText} numberOfLines={1}>
                        {site.address}{state ? `, ${state}` : ''}
                        {businessName ? ` • ${businessName}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.headerRightActions}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusTheme.badgeBg,
                        borderColor: statusTheme.badgeBg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusTheme.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusTheme.color },
                      ]}
                    >
                      {statusBadgeLabel}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => onEditSite(site)}
                    style={({ pressed }) => [
                      styles.editSiteBtn,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                    ]}
                    accessibilityLabel="Edit site details"
                  >
                    <AppIcon name="create-outline" size={14} color="#334155" />
                  </Pressable>
                </View>
              </View>

              {/* Clean hairline separator */}
              <View style={styles.headerDivider} />

              {/* Row-by-Row Specs Ledger */}
              <View style={styles.specsLedgerList}>
                {/* Row 1: Client */}
                <View style={styles.specsLedgerRow}>
                  <View style={styles.specsLedgerLabelCol}>
                    <AppIcon name="person-outline" size={14} color="#334155" />
                    <Text style={styles.specsLedgerLabelText}>Client</Text>
                  </View>
                  <Text style={styles.specsLedgerValueText} numberOfLines={1}>
                    {site.owner_name || '—'}
                  </Text>
                </View>

                {/* Row 2: Phone */}
                <View style={styles.specsLedgerRow}>
                  <View style={styles.specsLedgerLabelCol}>
                    <AppIcon name="call-outline" size={14} color="#334155" />
                    <Text style={styles.specsLedgerLabelText}>Phone</Text>
                  </View>
                  {site.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${site.phone}`)}
                      style={({ pressed }) => [
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityLabel={`Call ${site.phone}`}
                    >
                      <Text style={styles.specsLedgerPhoneText}>
                        {site.phone}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.specsLedgerValueText}>—</Text>
                  )}
                </View>

                {/* Row 3: Contract */}
                <View style={styles.specsLedgerRow}>
                  <View style={styles.specsLedgerLabelCol}>
                    <AppIcon name="document-text-outline" size={14} color="#334155" />
                    <Text style={styles.specsLedgerLabelText}>Contract</Text>
                  </View>
                  <Text style={styles.specsLedgerValueText} numberOfLines={1}>
                    {site.work_type === 'LABOUR'
                      ? 'Labour Only'
                      : 'Labour + Material'}
                    {' · '}
                    {site.pricing === 'FIXED'
                      ? 'Fixed Lumpsum'
                      : site.pricing === 'UNIT'
                        ? 'Unit Rate'
                        : 'Daily'}
                  </Text>
                </View>

                {/* Row 4: Timeline */}
                <View style={[styles.specsLedgerRow, !gstin && styles.specsLedgerRowLast]}>
                  <View style={styles.specsLedgerLabelCol}>
                    <AppIcon name="calendar-outline" size={14} color="#334155" />
                    <Text style={styles.specsLedgerLabelText}>Started</Text>
                  </View>
                  <Text style={styles.specsLedgerValueText} numberOfLines={1}>
                    {formatHumanDate(site.start_date)}
                    {site.end_date ? ` → ${formatHumanDate(site.end_date)}` : ''}
                  </Text>
                </View>

                {/* Row 5: GSTIN (if present) */}
                {gstin ? (
                  <View style={[styles.specsLedgerRow, styles.specsLedgerRowLast]}>
                    <View style={styles.specsLedgerLabelCol}>
                      <AppIcon name="shield-checkmark-outline" size={14} color="#16A34A" />
                      <Text style={styles.specsLedgerLabelText}>GSTIN</Text>
                    </View>
                    <Text style={styles.specsLedgerGstText} numberOfLines={1}>
                      {gstin}{stateCode ? ` (${stateCode})` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Contract Terms & Notes Section */}
              {userNotes ? (
                <View style={styles.termsBox}>
                  <View style={styles.termsHeaderRow}>
                    <View style={styles.termsTitleGroup}>
                      <AppIcon name="document-text-outline" size={14} color="#2563EB" />
                      <Text style={styles.termsTitleText}>{t('contractTermsNotes', 'Contract Terms & Notes')}</Text>
                    </View>
                    {isLongNotes && (
                      <Pressable
                        onPress={() => setTermsExpanded((v) => !v)}
                        style={({ pressed }) => [
                          styles.termsToggleBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                        hitSlop={8}
                        accessibilityLabel={termsExpanded ? 'Show less terms' : 'Show all terms'}
                      >
                        <Text style={styles.termsToggleBtnText}>
                          {termsExpanded
                            ? t('showLess', 'Show Less')
                            : `${t('showAll', 'Show All')} (${noteLines.length})`}
                        </Text>
                        <AppIcon
                          name={termsExpanded ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color="#1D4ED8"
                        />
                      </Pressable>
                    )}
                  </View>

                  <Text
                    style={styles.termsBodyText}
                    numberOfLines={isLongNotes && !termsExpanded ? 3 : undefined}
                  >
                    {userNotes}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Financial Stat Cards - Simple 1-Row Compact Cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricsRow}
            >
              {/* Card 1: Agreed Contract */}
              <View style={[styles.miniMetricCard, styles.miniMetricContract]}>
                <View style={styles.miniMetricTop}>
                  <AppIcon name="business-outline" size={13} color="#2563EB" />
                  <Text style={styles.miniMetricLabel} numberOfLines={1}>
                    {lang === 'hi' ? 'कुल ठेका' : 'Contract'}
                  </Text>
                </View>
                <Text style={styles.miniMetricValue} numberOfLines={1}>
                  {money(f.contract)}
                </Text>
              </View>

              {/* Card 2: Received */}
              <View style={[styles.miniMetricCard, styles.miniMetricReceived]}>
                <View style={styles.miniMetricTop}>
                  <AppIcon name="cash-outline" size={13} color="#16A34A" />
                  <Text style={[styles.miniMetricLabel, { color: '#15803D' }]} numberOfLines={1}>
                    {lang === 'hi' ? 'प्राप्त हुआ' : 'Received'}
                  </Text>
                </View>
                <Text style={[styles.miniMetricValue, { color: '#16A34A' }]} numberOfLines={1}>
                  {money(f.received)}
                </Text>
              </View>

              {/* Card 3: Client Balance */}
              <View style={[styles.miniMetricCard, f.ownerBalance > 0 ? styles.miniMetricPending : styles.miniMetricSettled]}>
                <View style={styles.miniMetricTop}>
                  <AppIcon
                    name="wallet-outline"
                    size={13}
                    color={f.ownerBalance > 0 ? '#D97706' : '#16A34A'}
                  />
                  <Text
                    style={[
                      styles.miniMetricLabel,
                      { color: f.ownerBalance > 0 ? '#92400E' : '#15803D' },
                    ]}
                    numberOfLines={1}
                  >
                    {f.ownerBalance < 0
                      ? (lang === 'hi' ? 'ज्यादा मिला' : 'Overpaid')
                      : (lang === 'hi' ? 'लेना बाकी' : 'Balance Due')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.miniMetricValue,
                    { color: f.ownerBalance > 0 ? '#B45309' : '#15803D' },
                  ]}
                  numberOfLines={1}
                >
                  {money(Math.abs(f.ownerBalance))}
                </Text>
              </View>

              {/* Card 4: Margin */}
              <View style={[styles.miniMetricCard, f.profit >= 0 ? styles.miniMetricProfit : styles.miniMetricLoss]}>
                <View style={styles.miniMetricTop}>
                  <AppIcon
                    name={f.profit >= 0 ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={f.profit >= 0 ? '#16A34A' : '#DC2626'}
                  />
                  <Text
                    style={[
                      styles.miniMetricLabel,
                      { color: f.profit >= 0 ? '#15803D' : '#991B1B' },
                    ]}
                    numberOfLines={1}
                  >
                    {f.final
                      ? (lang === 'hi' ? 'अंतिम बचत' : 'Final Margin')
                      : (lang === 'hi' ? 'अनुमानित बचत' : 'Est. Margin')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.miniMetricValue,
                    { color: f.profit >= 0 ? '#16A34A' : '#DC2626' },
                  ]}
                  numberOfLines={1}
                >
                  {money(f.profit)}
                </Text>
              </View>
            </ScrollView>

            {/* Agreements & Documents Section */}
            <Card style={styles.documentsCard}>
              <View style={styles.docHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppIcon name="document-text" size={17} color="#7C3AED" />
                  <Text style={styles.cardHeaderTitle}>
                    Agreements & Documents ({documents.length})
                  </Text>
                </View>
              </View>

              {documents.length > 0 ? (
                <View style={styles.docItemsGrid}>
                  {documents.map((d) => (
                    <View key={d.id} style={styles.docItemCard}>
                      <View style={styles.docItemIconBox}>
                        <AppIcon
                          name={
                            d.category === 'AGREEMENT'
                              ? 'document-text'
                              : d.category === 'DRAWING'
                                ? 'map'
                                : d.category === 'QUOTATION'
                                  ? 'receipt'
                                  : 'image'
                          }
                          size={18}
                          color={
                            d.category === 'AGREEMENT'
                              ? '#16A34A'
                              : d.category === 'DRAWING'
                                ? '#2563EB'
                                : d.category === 'QUOTATION'
                                  ? '#D97706'
                                  : '#9333EA'
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.docItemName} numberOfLines={1}>
                            {d.name}
                          </Text>
                          <Badge label={d.category} tone="gray" />
                        </View>
                        <Text style={styles.docItemMeta}>
                          {d.size ? `${d.size} • ` : ''}Date: {d.date}
                          {d.refNo ? ` • Ref: ${d.refNo}` : ''}
                        </Text>
                        {d.terms ? (
                          <Text style={styles.docItemTerms} numberOfLines={2}>
                            Terms: {d.terms}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => viewSiteDocument(d, {
                          name: site.name,
                          owner_name: site.owner_name,
                          phone: site.phone,
                          address: site.address,
                          gstin,
                          state,
                          stateCode,
                          businessName,
                          work_type: site.work_type,
                          pricing: site.pricing,
                        })}
                        style={({ pressed }) => [
                          styles.docItemActionViewBtn,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] },
                        ]}
                        accessibilityLabel={`View ${d.name}`}
                      >
                        <AppIcon name="eye-outline" size={16} color="#1D4ED8" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDocText}>
                  {lang === 'hi' ? 'अभी कोई दस्तावेज संलग्न नहीं है।' : 'No documents attached yet.'}
                </Text>
              )}
            </Card>

            {/* Cost & Cash Breakdown */}
            <Card style={styles.breakdownCard}>
              <View style={styles.breakdownHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppIcon name="calculator-outline" size={17} color="#2563EB" />
                  <Text style={styles.cardHeaderTitle}>
                    Cost & Cash Breakdown
                  </Text>
                </View>
              </View>

              {/* 1. Costs Incurred */}
              <View style={[styles.breakdownSection, { borderTopWidth: 0, marginTop: 0, paddingTop: 0 }]}>
                <Text style={styles.breakdownSectionTitle}>
                  1. Costs Incurred
                </Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Labour Earned</Text>
                  <Text style={styles.breakdownValue}>{money(f.labour)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Material Cost</Text>
                  <Text style={styles.breakdownValue}>{money(f.material)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Other Expenses</Text>
                  <Text style={styles.breakdownValue}>{money(f.expenses)}</Text>
                </View>
                <View style={[styles.breakdownItem, styles.breakdownItemTotal]}>
                  <Text style={styles.breakdownLabelTotal}>Total Cost Incurred</Text>
                  <Text style={styles.breakdownValueTotal}>{money(f.cost)}</Text>
                </View>
                {f.remaining > 0 ? (
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Estimated Remaining Cost</Text>
                    <Text style={styles.breakdownValue}>{money(f.remaining)}</Text>
                  </View>
                ) : null}
              </View>

              {/* 2. Outstanding Dues */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownSectionTitle}>
                  2. Outstanding Dues
                </Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Labour Dues Pending</Text>
                  <Text style={[styles.breakdownValue, f.labourBalance > 0 && { color: '#D97706' }]}>
                    {money(f.labourBalance)}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Supplier Dues Pending</Text>
                  <Text style={[styles.breakdownValue, f.supplierBalance > 0 && { color: '#D97706' }]}>
                    {money(f.supplierBalance)}
                  </Text>
                </View>
                <View style={[styles.breakdownItem, styles.breakdownItemHighlight]}>
                  <Text style={styles.breakdownLabelHighlight}>Total Dues Pending</Text>
                  <Text style={styles.breakdownValueHighlight}>
                    {money(f.labourBalance + f.supplierBalance)}
                  </Text>
                </View>
              </View>

              {/* 3. Cash Movement */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownSectionTitle}>
                  3. Cash Movement
                </Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Client Received</Text>
                  <Text style={[styles.breakdownValue, { color: '#16A34A' }]}>{money(f.received)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Labour Wages Paid</Text>
                  <Text style={styles.breakdownValue}>{money(f.wagesPaid)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Supplier Bills Paid</Text>
                  <Text style={styles.breakdownValue}>{money(f.suppliersPaid)}</Text>
                </View>
                <View style={[styles.breakdownItem, styles.breakdownItemCash]}>
                  <Text style={styles.breakdownLabelCash}>Net Cash In Hand</Text>
                  <Text style={[styles.breakdownValueCash, { color: f.cash >= 0 ? '#16A34A' : '#DC2626' }]}>
                    {money(f.cash)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Site Action Buttons */}
            {isDesktop ? (
              <View style={styles.actionsWrapDesktop}>
                <Button
                  title={t('receivePayment', 'Receive Payment')}
                  onPress={() => onOpenEntry('RECEIPT', site.id)}
                  icon="arrow-down"
                />
                <Button
                  title={t('navAttendance', 'Attendance')}
                  variant="secondary"
                  onPress={() => onOpenAttendance(site.id)}
                  icon="calendar"
                />
                <Button
                  title={t('materialBill', 'Material Bill')}
                  variant="secondary"
                  onPress={() => onOpenEntry('MATERIAL', site.id)}
                  icon="cube"
                />
                <Button
                  title={t('extraWork', 'Extra Work')}
                  variant="secondary"
                  onPress={() => onOpenEntry('EXTRA', site.id)}
                  icon="add-circle"
                />
                <Button
                  title={t('shareStatement', 'Share Statement')}
                  variant="secondary"
                  onPress={() => onShareReport(site.id)}
                  icon="share-social"
                />
              </View>
            ) : (
              <View style={styles.actionsWrapMobile}>
                {/* Row 1: Primary Receive Payment (Full Width) */}
                <Button
                  title={t('receivePayment', 'Receive Payment')}
                  onPress={() => onOpenEntry('RECEIPT', site.id)}
                  icon="arrow-down"
                  style={styles.fullWidthActionBtn}
                />

                {/* Row 2: Attendance & Material Bill (50% each) */}
                <View style={styles.actionGridRow}>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('navAttendance', 'Attendance')}
                      variant="secondary"
                      onPress={() => onOpenAttendance(site.id)}
                      icon="calendar"
                      style={styles.gridActionBtn}
                    />
                  </View>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('materialBill', 'Material Bill')}
                      variant="secondary"
                      onPress={() => onOpenEntry('MATERIAL', site.id)}
                      icon="cube"
                      style={styles.gridActionBtn}
                    />
                  </View>
                </View>

                {/* Row 3: Extra Work & Share Statement (50% each) */}
                <View style={styles.actionGridRow}>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('extraWork', 'Extra Work')}
                      variant="secondary"
                      onPress={() => onOpenEntry('EXTRA', site.id)}
                      icon="add-circle"
                      style={styles.gridActionBtn}
                    />
                  </View>
                  <View style={styles.actionGridCol}>
                    <Button
                      title={t('shareStatement', 'Share Statement')}
                      variant="secondary"
                      onPress={() => onShareReport(site.id)}
                      icon="share-social"
                      style={styles.gridActionBtn}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Site Ledger Entries */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('siteLedger', 'Site Ledger')}</Text>
              <Text style={styles.sectionSubtitle}>{t('allTransactionsForSite', 'All transactions for this site')}</Text>
            </View>

            <View style={styles.ledgerList}>
              {siteEntries.map((e) => {
                const isReceipt = e.kind === 'RECEIPT';
                return (
                  <Card key={e.id} style={styles.entryRow}>
                    <View style={styles.entryLeft}>
                      <View
                        style={[
                          styles.entryIcon,
                          {
                            backgroundColor: isReceipt
                              ? Colors.successLight
                              : Colors.surfaceSubtle,
                          },
                        ]}
                      >
                        <AppIcon
                          name={
                            isReceipt
                              ? 'arrow-down'
                              : e.kind === 'MATERIAL'
                                ? 'cube'
                                : 'arrow-up'
                          }
                          size={18}
                          color={isReceipt ? Colors.success : Colors.textPrimary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryDesc}>{e.description}</Text>
                        <Text style={styles.entryMeta}>
                          {String(e.date).slice(0, 10)} • {e.kind}
                          {e.party ? ` • ${e.party}` : ''}
                        </Text>
                        {e.reference ? (() => {
                          const docMatch = String(e.reference).match(/\[doc:([^\]]+)\]/);
                          const cleanRef = String(e.reference).replace(/\[doc:[^\]]+\]/g, '').trim();
                          const docId = docMatch ? docMatch[1] : null;

                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              {cleanRef ? (
                                <Text style={[styles.entryMeta, { color: '#64748B' }]}>
                                  Ref: {cleanRef}
                                </Text>
                              ) : null}
                              {docId ? (
                                <Pressable
                                  onPress={() => handleOpenDoc(docId, e)}
                                  style={({ pressed }) => [
                                    {
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 3,
                                      backgroundColor: '#EFF6FF',
                                      paddingHorizontal: 7,
                                      paddingVertical: 2,
                                      borderRadius: 5,
                                      borderWidth: 1,
                                      borderColor: '#BFDBFE',
                                    },
                                    pressed && { opacity: 0.8 },
                                  ]}
                                >
                                  <AppIcon name="image" size={11} color="#2563EB" />
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#1D4ED8' }}>
                                    {lang === 'hi' ? '📸 पर्ची फोटो' : '📸 Bill Photo'}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          );
                        })() : null}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.entryAmount,
                        { color: isReceipt ? Colors.success : Colors.textPrimary },
                      ]}
                    >
                      {isReceipt ? '+' : '-'} {money(e.amount)}
                    </Text>
                  </Card>
                );
              })}
              {!siteEntries.length && (
                <Text style={styles.emptyNotice}>
                  {lang === 'hi' ? 'इस साइट के लिए अभी कोई लेन-देन दर्ज नहीं है।' : 'No expenses or receipts recorded for this site yet.'}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bill & Parchi Full Image Viewer Modal */}
        {viewingDoc && (
          <BillImageViewerModal
            visible={!!viewingDoc}
            imageUrl={viewingDoc.url}
            title={viewingDoc.title}
            date={viewingDoc.date}
            amount={viewingDoc.amount}
            party={viewingDoc.party}
            onClose={() => setViewingDoc(null)}
          />
        )}
      </View>
    );
  }

  // Render All Sites List View
  const query = search.trim().toLowerCase();
  const filteredSites = data.sites.filter((s) => {
    const matchesQuery = (s.name + ' ' + s.owner_name).toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const totalSitesCount = data.sites.length;
  const ongoingSitesCount = data.sites.filter((s) => s.status === 'ONGOING').length;
  const totalContractVal = data.sites.reduce(
    (acc, s) => acc + (Number(s.contract_amount) || 0),
    0
  );
  const totalPendingVal = data.sites.reduce((acc, s) => {
    const f = siteSummary(s, data.attendance, data.entries);
    return acc + (f.ownerBalance > 0 ? f.ownerBalance : 0);
  }, 0);

  const statusCounts: Record<string, number> = {
    ALL: data.sites.length,
    ONGOING: data.sites.filter((s) => s.status === 'ONGOING').length,
    UPCOMING: data.sites.filter((s) => s.status === 'UPCOMING').length,
    PAUSED: data.sites.filter((s) => s.status === 'PAUSED').length,
    COMPLETED: data.sites.filter((s) => s.status === 'COMPLETED').length,
  };

  const getStatusChipLabel = (status: string) => {
    switch (status) {
      case 'ONGOING': return t('active', 'Active');
      case 'UPCOMING': return t('upcoming', 'Upcoming');
      case 'PAUSED': return t('paused', 'Paused');
      case 'COMPLETED': return t('completed', 'Completed');
      default: return t('all', 'All');
    }
  };

  return (
    <View style={styles.pageWrapper}>
      <TopNavBar
        title={t('sitesTitle', 'Work Sites')}
        userInitials={data.user.name}
        organizationName={data.organization.name}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onBack={onBack}
        actions={
          <Pressable
            onPress={onOpenNewSite}
            style={({ pressed }) => [
              styles.navNewSiteBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityLabel="Create new work site"
          >
            <Text style={styles.navNewSiteBtnText}>{t('newSite', 'New Site')}</Text>
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

          {/* Quick Stats Overview: 2 Sleek KPI Cards */}
          <View style={styles.statsSummaryGrid}>
            <View style={[styles.statKpiCard, styles.statKpiTotal]}>
              <View style={styles.statKpiTop}>
                <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <AppIcon name="business" size={15} color="#2563EB" />
                </View>
                <Text style={styles.statKpiLabel}>
                  {lang === 'hi' ? 'कुल साइट्स' : 'Total Sites'}
                </Text>
              </View>
              <Text style={styles.statKpiValue}>
                {ongoingSitesCount} {lang === 'hi' ? 'चालू' : 'Active'}
              </Text>
              <Text style={styles.statKpiFoot}>
                {totalSitesCount} {lang === 'hi' ? 'कुल दर्ज साइट्स' : 'Total registered'}
              </Text>
            </View>

            <View style={[styles.statKpiCard, totalPendingVal > 0 ? styles.statKpiPending : styles.statKpiActive]}>
              <View style={styles.statKpiTop}>
                <View
                  style={[
                    styles.statIconBadge,
                    { backgroundColor: totalPendingVal > 0 ? '#FEF3C7' : '#DCFCE7' },
                  ]}
                >
                  <AppIcon
                    name="wallet"
                    size={15}
                    color={totalPendingVal > 0 ? '#D97706' : '#16A34A'}
                  />
                </View>
                <Text
                  style={[
                    styles.statKpiLabel,
                    totalPendingVal > 0 && { color: '#92400E' },
                  ]}
                >
                  {lang === 'hi' ? 'लेना बाकी' : 'Pending Due'}
                </Text>
              </View>
              <Text
                style={[
                  styles.statKpiValue,
                  { color: totalPendingVal > 0 ? '#B45309' : '#15803D' },
                ]}
                numberOfLines={1}
              >
                {money(totalPendingVal)}
              </Text>
              <Text style={styles.statKpiFoot} numberOfLines={1}>
                {lang === 'hi' ? 'कुल ठेका:' : 'Contract:'} {money(totalContractVal)}
              </Text>
            </View>
          </View>

          {/* Search */}
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchSitePlaceholder', 'Search site or client name…')}
          />

          {/* Status Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {['ALL', 'ONGOING', 'UPCOMING', 'PAUSED', 'COMPLETED'].map((status) => {
              const isSelected = statusFilter === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => setStatusFilter(status)}
                  style={[
                    styles.chip,
                    isSelected && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                  >
                    {getStatusChipLabel(status)} ({statusCounts[status] || 0})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Sites List in Clean, Informative Cards */}
          {filteredSites.length ? (
            <View style={styles.sitesGrid}>
              {filteredSites.map((siteItem) => {
                const f = siteSummary(siteItem, data.attendance, data.entries);
                const statusTheme = getSiteStatusTheme(siteItem.status);

                return (
                  <Pressable
                    key={siteItem.id}
                    onPress={() => onSelectSite(siteItem.id)}
                    style={({ pressed }) => [
                      styles.siteCard,
                      pressed && styles.siteCardPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open site ${siteItem.name}`}
                  >
                    {/* Top Row: Icon + Name & Client/Location + Status Pill */}
                    <View style={styles.siteCardHeader}>
                      <View
                        style={[
                          styles.siteIconBox,
                          { backgroundColor: statusTheme.bg },
                        ]}
                      >
                        <AppIcon
                          name={
                            siteItem.work_type === 'LABOUR'
                              ? 'hammer'
                              : 'business'
                          }
                          size={19}
                          color={statusTheme.color}
                        />
                      </View>

                      <View style={styles.siteInfoCol}>
                        <View style={styles.siteTitleRow}>
                          <Text style={styles.siteNameText} numberOfLines={1}>
                            {siteItem.name}
                          </Text>
                          <View
                            style={[
                              styles.siteStatusPill,
                              { backgroundColor: statusTheme.badgeBg },
                            ]}
                          >
                            <View
                              style={[
                                styles.siteStatusDot,
                                { backgroundColor: statusTheme.color },
                              ]}
                            />
                            <Text
                              style={[
                                styles.siteStatusPillText,
                                { color: statusTheme.color },
                              ]}
                            >
                              {getStatusChipLabel(siteItem.status)}
                            </Text>
                          </View>
                        </View>

                        {/* Owner & Location Subtitle */}
                        {(siteItem.owner_name || siteItem.location) ? (
                          <View style={styles.siteMetaRow}>
                            {siteItem.owner_name ? (
                              <View style={styles.metaItem}>
                                <AppIcon name="person" size={11} color="#64748B" />
                                <Text style={styles.metaItemText} numberOfLines={1}>
                                  {siteItem.owner_name}
                                </Text>
                              </View>
                            ) : null}
                            {siteItem.owner_name && siteItem.location ? (
                              <Text style={styles.metaDot}>•</Text>
                            ) : null}
                            {siteItem.location ? (
                              <View style={styles.metaItem}>
                                <AppIcon name="location" size={11} color="#64748B" />
                                <Text style={styles.metaItemText} numberOfLines={1}>
                                  {siteItem.location}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Financial Summary Box */}
                    <View style={styles.finBox}>
                      {/* Total Contract / Theka */}
                      <View style={styles.finCol}>
                        <Text style={styles.finLabel}>
                          {lang === 'hi' ? 'कुल ठेका' : 'Contract'}
                        </Text>
                        <Text style={styles.finValContract} numberOfLines={1}>
                          {money(f.contract)}
                        </Text>
                      </View>

                      <View style={styles.finDivider} />

                      {/* Received / Mila */}
                      <View style={styles.finCol}>
                        <Text style={styles.finLabel}>
                          {lang === 'hi' ? 'प्राप्त हुआ' : 'Received'}
                        </Text>
                        <Text style={styles.finValReceived} numberOfLines={1}>
                          {money(f.received)}
                        </Text>
                      </View>

                      <View style={styles.finDivider} />

                      {/* Pending Due / Baki */}
                      <View style={styles.finCol}>
                        <Text style={styles.finLabel}>
                          {lang === 'hi' ? 'लेना बाकी' : 'Balance Due'}
                        </Text>
                        <Text
                          style={[
                            styles.finValDue,
                            f.ownerBalance > 0
                              ? { color: '#D97706' }
                              : f.ownerBalance < 0
                                ? { color: '#2563EB' }
                                : { color: '#16A34A' },
                          ]}
                          numberOfLines={1}
                        >
                          {f.ownerBalance > 0
                            ? money(f.ownerBalance)
                            : f.ownerBalance < 0
                              ? `${money(-f.ownerBalance)} Adv`
                              : (lang === 'hi' ? '₹0 चुकता' : '₹0 Settled')}
                        </Text>
                      </View>
                    </View>

                    {/* Footer Row: View Details Link */}
                    <View style={styles.siteCardFooter}>
                      <Text style={styles.siteFooterText}>
                        {lang === 'hi' ? 'हिसाब व एंट्री देखने के लिए टैप करें' : 'Tap to view ledger & entries'}
                      </Text>
                      <AppIcon name="chevron-forward" size={14} color="#94A3B8" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title={t('noSitesFound', 'No sites found matching your filter.')}
              description={t('noFilterMatchDesc', 'No records match your search. Try a different query or clear filters.')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navNewSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  navNewSiteBtnText: {
    fontSize: 12.5,
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  nayaThekaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  nayaThekaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statKpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statKpiTotal: {
    backgroundColor: '#FFFFFF',
  },
  statKpiActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statKpiContract: {
    backgroundColor: '#FFFFFF',
  },
  statKpiPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statKpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statKpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  statKpiValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  statKpiFoot: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sitesGrid: {
    gap: 12,
  },

  /* Redesigned Clean Site Card */
  siteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 13,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' } as any,
      default: { elevation: 2 },
    }),
  },
  siteCardPressed: {
    backgroundColor: '#F8FAFC',
    opacity: 0.95,
  },
  siteCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  siteIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteInfoCol: {
    flex: 1,
    gap: 3,
  },
  siteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  siteNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.2,
  },
  siteStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  siteStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  siteStatusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  siteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaItemText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  metaDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  finBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  finCol: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  finLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  finValContract: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  finValReceived: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },
  finValDue: {
    fontSize: 13,
    fontWeight: '800',
  },
  finDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  siteCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 1,
  },
  siteFooterText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  // Details view styles
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  siteHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitleCol: {
    flex: 1,
    gap: 4,
  },
  headerSiteName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLocationText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
    flexShrink: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeOngoing: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeCompleted: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusBadgePaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOngoing: {
    backgroundColor: '#16A34A',
  },
  statusDotCompleted: {
    backgroundColor: '#2563EB',
  },
  statusDotPaused: {
    backgroundColor: '#D97706',
  },
  statusTextOngoing: {
    color: '#15803D',
  },
  statusTextCompleted: {
    color: '#1D4ED8',
  },
  statusTextPaused: {
    color: '#B45309',
  },
  editSiteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editSiteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  specsLedgerList: {
    paddingTop: 4,
  },
  specsLedgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 16,
  },
  specsLedgerRowLast: {
    borderBottomWidth: 0,
  },
  specsLedgerLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    width: 95,
    flexShrink: 0,
  },
  specsLedgerLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  specsLedgerValueText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'left',
    flex: 1,
  },
  specsLedgerPhoneText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'left',
  },
  specsLedgerGstText: {
    fontSize: 12.5,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontWeight: '700',
    color: '#14532D',
    textAlign: 'left',
    flex: 1,
  },
  termsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  termsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  termsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  termsTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  termsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  termsToggleBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  termsBodyText: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  navEditIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexGrow: 1,
  },
  miniMetricCard: {
    flex: 1,
    minWidth: 105,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 2,
  },
  miniMetricContract: {
    backgroundColor: '#FFFFFF',
  },
  miniMetricReceived: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  miniMetricPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  miniMetricSettled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  miniMetricProfit: {
    backgroundColor: '#FFFFFF',
  },
  miniMetricLoss: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  miniMetricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flex: 1,
  },
  miniMetricValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  breakdownCard: {
    padding: 16,
    marginBottom: 16,
  },
  breakdownHeaderRow: {
    marginBottom: 6,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  breakdownSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  breakdownSectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  breakdownGrid: {
    gap: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  breakdownLabel: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  breakdownItemTotal: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  breakdownLabelTotal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownValueTotal: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  breakdownItemHighlight: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  breakdownLabelHighlight: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  breakdownValueHighlight: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#B45309',
  },
  breakdownItemCash: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  breakdownLabelCash: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownValueCash: {
    fontSize: 14,
    fontWeight: '900',
  },
  actionsWrapDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  actionsWrapMobile: {
    gap: 8,
    marginBottom: 20,
  },
  fullWidthActionBtn: {
    width: '100%',
  },
  actionGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionGridCol: {
    flex: 1,
  },
  gridActionBtn: {
    width: '100%',
    paddingHorizontal: 8,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  ledgerList: {
    gap: 8,
  },
  entryRow: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  entryMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyNotice: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    marginVertical: 12,
  },
  documentsCard: {
    padding: 16,
    marginBottom: 16,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  docItemsGrid: {
    gap: 8,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  docItemMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  docItemTerms: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  noDocText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  docItemActionViewBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 6,
  },
});

export { NewSitePage } from './NewSitePage';
export { EditSitePage } from './EditSitePage';

