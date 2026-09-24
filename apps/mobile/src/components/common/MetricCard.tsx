import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface MetricCardProps {
  label: string;
  value: string;
  foot?: string;
  icon?: string;
  accent?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function MetricCard({
  label,
  value,
  foot,
  icon,
  accent = false,
  tone = 'default',
}: MetricCardProps) {
  const valueColor =
    tone === 'success'
      ? Colors.success
      : tone === 'warning'
      ? Colors.warning
      : tone === 'danger'
      ? Colors.danger
      : accent
      ? Colors.primary
      : Colors.textPrimary;

  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        {icon ? (
          <View style={styles.iconBox}>
            <AppIcon name={icon} size={16} color={Colors.primaryLight} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      {foot ? (
        <Text style={styles.foot} numberOfLines={1}>
          {foot}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flex: 1,
    minWidth: 140,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  accentCard: {
    borderColor: Colors.accentLight,
    backgroundColor: Colors.primarySurface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    flex: 1,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  foot: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
