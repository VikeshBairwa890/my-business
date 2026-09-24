import React from 'react';
import { View, ViewStyle, StyleSheet, StyleProp } from 'react-native';
import { Colors } from '../../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
}

export function Card({ children, style, highlight = false }: CardProps) {
  return (
    <View style={[styles.card, highlight && styles.highlightCard, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  highlightCard: {
    borderColor: Colors.accentLight,
    borderWidth: 1.5,
  },
});
