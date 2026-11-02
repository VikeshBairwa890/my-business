import React from 'react';
import { Pressable, Text, StyleSheet, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface FloatingVoiceButtonProps {
  onPress: () => void;
  label?: string;
  compact?: boolean;
}

export function FloatingVoiceButton({
  onPress,
  label = 'बोलकर लिखें',
  compact = false,
}: FloatingVoiceButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.floatingBtn,
        compact ? styles.compactBtn : styles.expandedBtn,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Voice Assistant"
    >
      <View style={styles.iconCircle}>
        <Ionicons name="mic" size={compact ? 22 : 18} color="#FFFFFF" />
      </View>
      {!compact && <Text style={styles.btnLabel}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingBtn: {
    position: 'absolute',
    bottom: 84, // Just above BottomNav
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A', // Dark Navy Fintech tone
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    zIndex: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
        cursor: 'pointer',
      } as any,
      default: {
        elevation: 10,
      },
    }),
  },
  expandedBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  compactBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
});

