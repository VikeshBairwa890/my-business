import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

export interface TabItem {
  key: string;
  label: string;
  icon: string;
  badge?: number | string;
}

interface BottomNavProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (key: string) => void;
  onCenterPress?: () => void;
}

export function BottomNav({ tabs, activeTab, onTabPress, onCenterPress }: BottomNavProps) {
  const renderTab = (tab: TabItem) => {
    const isActive = activeTab === tab.key;
    const activeIconName = tab.icon.endsWith('-outline')
      ? tab.icon.replace('-outline', '')
      : tab.icon;
    const iconName = isActive ? activeIconName : tab.icon;

    return (
      <Pressable
        key={tab.key}
        onPress={() => onTabPress(tab.key)}
        style={styles.tabItem}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={tab.label}
      >
        <View style={styles.iconWrapper}>
          <AppIcon
            name={iconName}
            size={22}
            color={isActive ? '#0F172A' : '#64748B'}
          />
          {tab.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tab.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.label,
            isActive ? styles.activeLabel : styles.inactiveLabel,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  const hasCenterFab = Boolean(onCenterPress && tabs.length === 4);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {hasCenterFab ? (
          <>
            {renderTab(tabs[0])}
            {renderTab(tabs[1])}

            {/* Center Floating Plus Button */}
            <View style={styles.centerFabContainer}>
              <Pressable
                onPress={onCenterPress}
                style={({ pressed }) => [
                  styles.centerFab,
                  pressed && styles.fabPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Quick Action"
              >
                <AppIcon name="add" size={32} color="#1E293B" />
              </Pressable>
            </View>

            {renderTab(tabs[2])}
            {renderTab(tabs[3])}
          </>
        ) : (
          tabs.map((tab) => renderTab(tab))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 6,
    ...Platform.select({
      web: { boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 10,
      },
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrapper: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  label: {
    fontSize: 11,
  },
  activeLabel: {
    fontWeight: '800',
    color: '#0F172A',
  },
  inactiveLabel: {
    fontWeight: '600',
    color: '#64748B',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  centerFabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  centerFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F59E0B', // Golden amber like screenshot
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(245, 158, 11, 0.45)' },
      default: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: '#D97706',
  },
});
