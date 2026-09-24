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
}

export function BottomNav({ tabs, activeTab, onTabPress }: BottomNavProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <AppIcon
                  name={tab.icon}
                  size={isActive ? 22 : 20}
                  color={isActive ? Colors.primary : Colors.textMuted}
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
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrapper: {
    width: 42,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 2,
    position: 'relative',
  },
  activeIconWrapper: {
    backgroundColor: Colors.primarySurface,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  activeLabel: {
    fontWeight: '800',
    color: Colors.primary,
  },
  inactiveLabel: {
    fontWeight: '500',
    color: Colors.textMuted,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: Colors.warning,
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
});
