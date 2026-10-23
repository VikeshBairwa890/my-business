import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType =
  | 's'
  | 'e'
  | 'w'
  | 'i'
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

export type NormalizedToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: NormalizedToastType;
  duration?: number;
}

export interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

// Singleton reference for global (non-hook) usage anywhere in the codebase
let globalToastRef: ((msg: string, type?: ToastType, duration?: number) => void) | null = null;

/**
 * Global function to show toast from anywhere (inside or outside React components)
 * Usage:
 *   showToast("Site created successfully", "s");
 *   showToast("Network failed", "e");
 *   showToast("Please fill all fields", "w");
 */
export function showToast(message: string, type?: ToastType, duration?: number) {
  if (globalToastRef) {
    globalToastRef(message, type, duration);
  } else {
    console.log(`[Toast ${type || 'info'}]: ${message}`);
  }
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast,
      hideToast: () => {},
    };
  }
  return context;
}

function normalizeType(type?: ToastType, message?: string): NormalizedToastType {
  if (type === 'e' || type === 'error') return 'error';
  if (type === 's' || type === 'success') return 'success';
  if (type === 'w' || type === 'warning') return 'warning';
  if (type === 'i' || type === 'info') return 'info';

  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('fail') || lower.includes('गलत') || lower.includes('खराबी')) {
      return 'error';
    }
    if (
      lower.includes('please') ||
      lower.includes('warning') ||
      lower.includes('कृपया') ||
      lower.includes('add')
    ) {
      return 'warning';
    }
  }

  return 'success';
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const hideTimerRef = useRef<any>(null);

  const hideToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 15,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [fadeAnim, slideAnim]);

  const triggerToast = useCallback(
    (message: string, rawType?: ToastType, duration = 3200) => {
      if (!message || typeof message !== 'string') return;

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      const type = normalizeType(rawType, message);
      const newToast: ToastItem = {
        id: Date.now().toString(),
        message,
        type,
        duration,
      };

      setToast(newToast);

      fadeAnim.setValue(0);
      slideAnim.setValue(20);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      hideTimerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [fadeAnim, slideAnim, hideToast]
  );

  useEffect(() => {
    globalToastRef = triggerToast;
    return () => {
      globalToastRef = null;
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [triggerToast]);

  return (
    <ToastContext.Provider value={{ showToast: triggerToast, hideToast }}>
      {children}
      {toast && (
        <View style={styles.floatingOverlay} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.toastCard,
              toast.type === 'error' && styles.toastCardError,
              toast.type === 'warning' && styles.toastCardWarning,
              toast.type === 'info' && styles.toastCardInfo,
              toast.type === 'success' && styles.toastCardSuccess,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.contentRow}>
              {/* Status Icon */}
              <View
                style={[
                  styles.iconWrap,
                  toast.type === 'error' && styles.iconWrapError,
                  toast.type === 'warning' && styles.iconWrapWarning,
                  toast.type === 'info' && styles.iconWrapInfo,
                  toast.type === 'success' && styles.iconWrapSuccess,
                ]}
              >
                <Ionicons
                  name={
                    toast.type === 'error'
                      ? 'alert-circle'
                      : toast.type === 'warning'
                        ? 'warning'
                        : toast.type === 'info'
                          ? 'information-circle'
                          : 'checkmark-circle'
                  }
                  size={19}
                  color={
                    toast.type === 'error'
                      ? '#EF4444'
                      : toast.type === 'warning'
                        ? '#F59E0B'
                        : toast.type === 'info'
                          ? '#38BDF8'
                          : '#10B981'
                  }
                />
              </View>

              {/* Toast Message */}
              <Text style={styles.toastText} numberOfLines={2}>
                {toast.message}
              </Text>

              {/* Tap to dismiss cross */}
              <Pressable
                onPress={hideToast}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={16} color="#94A3B8" />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  floatingOverlay: {
    position: 'absolute',
    bottom: 84, // Positioned safely above the bottom navigation bar
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
  },
  toastCard: {
    maxWidth: 540,
    width: '90%',
    backgroundColor: '#0F172A', // Modern deep slate (BHIM / fintech trusted style)
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    ...Platform.select({
      web: {
        boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.45), 0 4px 10px -2px rgba(15, 23, 42, 0.25)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  toastCardSuccess: {
    borderColor: '#059669',
    backgroundColor: '#09211C',
  },
  toastCardError: {
    borderColor: '#DC2626',
    backgroundColor: '#260B0E',
  },
  toastCardWarning: {
    borderColor: '#D97706',
    backgroundColor: '#241705',
  },
  toastCardInfo: {
    borderColor: '#0284C7',
    backgroundColor: '#081F30',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconWrapSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  iconWrapError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  iconWrapWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  iconWrapInfo: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
    borderRadius: 12,
  },
});
