import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

interface BadgeProps {
  label: string;
  tone?: 'green' | 'orange' | 'red' | 'blue' | 'gray';
}

export function Badge({ label, tone = 'blue' }: BadgeProps) {
  const isGreen = tone === 'green';
  const isOrange = tone === 'orange';
  const isRed = tone === 'red';
  const isBlue = tone === 'blue';

  const bg = isGreen
    ? Colors.successLight
    : isOrange
    ? Colors.warningLight
    : isRed
    ? Colors.dangerLight
    : isBlue
    ? Colors.accentLight
    : Colors.surfaceSubtle;

  const text = isGreen
    ? Colors.successDark
    : isOrange
    ? Colors.warningText
    : isRed
    ? Colors.danger
    : isBlue
    ? Colors.accentDark
    : Colors.textMuted;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
