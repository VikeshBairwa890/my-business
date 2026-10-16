import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { AppIcon } from '../icons/AppIcon';

export interface TopNavBarProps {
  /** Main page title */
  title: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Alias for subtitle */
  description?: string;
  /** Back navigation callback */
  onBack?: () => void;
  /** Position of back button ('left' by default, or 'right') */
  backPosition?: 'left' | 'right';
  /** Optional right-side actions or buttons */
  actions?: React.ReactNode;
  /** Container style overrides */
  style?: any;
  /** Title text style overrides */
  titleStyle?: any;
  /** Subtitle text style overrides */
  subtitleStyle?: any;

  // Legacy props kept optional so other existing page calls don't break
  icon?: string;
  userInitials?: string;
  organizationName?: string;
  onOpenProfile?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  badge?: any;
  backText?: string;
}

export function formatNameInitials(name?: string | null, fallback = ''): string {
  if (!name || !name.trim()) return fallback;
  const clean = name.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return (parts[0][0] || fallback).toUpperCase();
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase() || fallback;
}

export function TopNavBar({
  title,
  subtitle,
  description,
  onBack,
  backPosition = 'left',
  actions,
  style,
  titleStyle,
  subtitleStyle,
}: TopNavBarProps) {
  const descriptionText = description || subtitle;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.back();
    }
  };

  if (backPosition === 'right') {
    return (
      <View style={[styles.container, style]}>
        {/* Title and Description on left */}
        <View style={styles.textWrap}>
          <Text style={[styles.titleText, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
          {descriptionText ? (
            <Text style={[styles.subText, subtitleStyle]} numberOfLines={1}>
              {descriptionText}
            </Text>
          ) : null}
        </View>

        {/* Back Button on right */}
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <AppIcon name="arrow-back" size={20} color="#0F172A" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Back button on the left */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <AppIcon name="arrow-back" size={20} color="#0F172A" />
      </Pressable>

      {/* Title beside back button and description underneath */}
      <View style={styles.textWrap}>
        <Text style={[styles.titleText, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {descriptionText ? (
          <Text style={[styles.subText, subtitleStyle]} numberOfLines={1}>
            {descriptionText}
          </Text>
        ) : null}
      </View>

      {/* Right actions or spacer */}
      {actions ? (
        <View style={styles.actionsWrap}>{actions}</View>
      ) : (
        <View style={styles.rightSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 60,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  btnPressed: {
    opacity: 0.7,
    backgroundColor: '#F1F5F9',
    transform: [{ scale: 0.95 }],
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  rightSpacer: {
    width: 8,
  },
});
