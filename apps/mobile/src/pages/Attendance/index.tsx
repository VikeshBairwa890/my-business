import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { TopNavBar } from '../../components/common/TopNavBar';
import { Snapshot, Row } from '../../types';
import { DailyHaziriPage, DailyHaziriPageProps } from './DailyHaziriPage';
import { MonthlyAttendancePage, MonthlyAttendancePageProps } from './MonthlyAttendancePage';
import { BulkAttendancePage, BulkAttendancePageProps } from './BulkAttendancePage';

export { DailyHaziriPage } from './DailyHaziriPage';
export type { DailyHaziriPageProps } from './DailyHaziriPage';
export { DailyHaziriPage as DailyAttendancePage } from './DailyHaziriPage';

export { MonthlyAttendancePage } from './MonthlyAttendancePage';
export type { MonthlyAttendancePageProps } from './MonthlyAttendancePage';
export { MonthlyAttendancePage as MonthlyRegisterPage } from './MonthlyAttendancePage';

export { BulkAttendancePage } from './BulkAttendancePage';
export type { BulkAttendancePageProps } from './BulkAttendancePage';

export interface AttendancePageProps {
  data: Snapshot;
  onOpenAttendanceModal: (siteId?: string, workerId?: string, existing?: Row) => void;
  onOpenProfile?: () => void;
  onBack?: () => void;
  defaultView?: 'MENU' | 'DAILY' | 'MONTHLY' | 'BULK';
  refreshing: boolean;
  onRefresh: () => void;
}

export function AttendancePage({
  data,
  onOpenAttendanceModal,
  onOpenProfile,
  onBack,
  defaultView = 'MENU',
  refreshing,
  onRefresh,
}: AttendancePageProps) {
  const [subpage, setSubpage] = useState<'MENU' | 'DAILY' | 'MONTHLY' | 'BULK'>(defaultView);

  // If user selected Monthly Attendance page
  if (subpage === 'MONTHLY') {
    return (
      <MonthlyAttendancePage
        data={data}
        onOpenAttendanceModal={onOpenAttendanceModal}
        onOpenProfile={onOpenProfile}
        onBack={() => setSubpage('MENU')}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // If user selected Daily Attendance page
  if (subpage === 'DAILY') {
    return (
      <DailyHaziriPage
        data={data}
        onOpenAttendanceModal={onOpenAttendanceModal}
        onOpenProfile={onOpenProfile}
        onBack={() => setSubpage('MENU')}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // If user selected Bulk Attendance page
  if (subpage === 'BULK') {
    return (
      <BulkAttendancePage
        data={data}
        onBack={() => setSubpage('MENU')}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  // =========================================================================
  // ATTENDANCE SELECTION SCREEN (Exact 3 Cards from Screenshot - Sleek & Compact)
  // =========================================================================
  const menuOptions = [
    {
      id: 'bulk',
      title: 'Bulk Attendance',
      icon: 'people',
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
      onPress: () => setSubpage('BULK'),
    },
    {
      id: 'daily',
      title: 'Daily Attendance',
      icon: 'time',
      iconColor: '#D97706',
      iconBg: '#FEF3C7',
      onPress: () => setSubpage('DAILY'),
    },
    {
      id: 'monthly',
      title: 'Monthly Attendance',
      icon: 'calendar',
      iconColor: '#C2410C',
      iconBg: '#FFEDD5',
      onPress: () => setSubpage('MONTHLY'),
    },
  ];

  return (
    <View style={styles.pageWrapper}>
      {/* Top Header */}
      <TopNavBar
        title="Attendance"
        subtitle="Worker attendance & registers"
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
          {menuOptions.map((item) => (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuCard,
                pressed && styles.menuCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={styles.cardLeftContent}>
                <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                  <AppIcon
                    name={item.icon as any}
                    size={18}
                    color={item.iconColor}
                  />
                </View>
                <Text style={styles.cardTitleText}>{item.title}</Text>
              </View>

              <AppIcon name="chevron-forward" size={16} color="#94A3B8" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  container: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        elevation: 1,
      },
    }),
  },
  menuCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
    backgroundColor: '#F8FAFC',
  },
  cardLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
});
