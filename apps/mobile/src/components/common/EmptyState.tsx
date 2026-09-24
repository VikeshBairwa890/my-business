import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon = 'layers-outline',
  actionTitle,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <AppIcon name={icon} size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          icon="add"
          style={styles.btn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  btn: {
    marginTop: 16,
  },
});
