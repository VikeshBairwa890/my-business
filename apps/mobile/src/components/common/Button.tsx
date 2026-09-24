import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSuccess = variant === 'success';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';

  const containerBg = isPrimary
    ? Colors.primary
    : isSuccess
    ? Colors.success
    : isDanger
    ? Colors.danger
    : isSecondary
    ? Colors.surfaceSubtle
    : 'transparent';

  const textColor = isPrimary || isSuccess || isDanger
    ? '#FFFFFF'
    : isSecondary
    ? Colors.textPrimary
    : Colors.primary;

  const borderColor = isSecondary ? Colors.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        { backgroundColor: containerBg, borderColor },
        isSecondary && styles.secondaryBorder,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <AppIcon
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={textColor}
            />
          ) : null}
          <Text style={[styles.text, styles[`${size}Text`], { color: textColor }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  lg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  smText: {
    fontSize: 12,
  },
  mdText: {
    fontSize: 14,
  },
  lgText: {
    fontSize: 16,
  },
  secondaryBorder: {
    borderWidth: 1.2,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
