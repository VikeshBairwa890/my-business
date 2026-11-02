import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl, setCustomApiUrl } from '../../api';

export interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (newUrl: string) => void;
}

const DEFAULT_WIFI_URL = 'http://192.168.29.51:4000';
const DEFAULT_TUNNEL_URL = 'https://my-business-hy2b.vercel.app';

export function ServerConfigModal({ visible, onClose, onSaved }: ServerConfigModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const currentUrl = getApiBaseUrl();
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!visible) return null;

  const handleTestAndSave = async (overrideUrl?: string) => {
    const target = (overrideUrl || urlInput || '').trim().replace(/\/$/, '');
    if (!target) {
      setStatusMsg({ text: 'Kripya sahi URL enter karein', ok: false });
      return;
    }

    setTesting(true);
    setStatusMsg(null);

    try {
      // Test health ping
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${target}/snapshot`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      }).catch((err) => {
        // 401 or auth error is still proof that host is reachable!
        if (err.name === 'AbortError') throw new Error('Connection timeout (Server ne jawab nahi diya)');
        throw err;
      });

      clearTimeout(timeoutId);

      // Server is reachable (either returns snapshot, 401 Unauthorized, or 404)
      await setCustomApiUrl(target);
      setStatusMsg({ text: '✅ Server se safaltapoorvak connect ho gaya!', ok: true });
      setTimeout(() => {
        onSaved?.(target);
        onClose();
      }, 700);
    } catch (err: any) {
      // Even if 401, server is alive!
      if (err.message && (err.message.includes('401') || err.message.includes('sign in'))) {
        await setCustomApiUrl(target);
        setStatusMsg({ text: '✅ Server online hai!', ok: true });
        setTimeout(() => {
          onSaved?.(target);
          onClose();
        }, 700);
        return;
      }

      setStatusMsg({
        text: `❌ Connect nahi ho saka: ${err.message || 'Host unreachable'}`,
        ok: false,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    await setCustomApiUrl(null);
    const resetUrl = getApiBaseUrl();
    setUrlInput(resetUrl);
    setStatusMsg({ text: 'Default URL restore ho gaya', ok: true });
    setTimeout(() => {
      onSaved?.(resetUrl);
      onClose();
    }, 600);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.dialogCard, isDesktop && styles.desktopDialog]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="server-outline" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dialogTitle}>Server Settings (सर्वर सेटिंग)</Text>
              <Text style={styles.dialogSub}>Backend API Connection Configuration</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* Current URL indicator */}
          <View style={styles.currentBox}>
            <Text style={styles.currentLabel}>CURRENT ACTIVE URL:</Text>
            <Text style={styles.currentText} numberOfLines={1}>
              {currentUrl}
            </Text>
          </View>

          {/* Input */}
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>SERVER API URL (HTTPS / HTTP):</Text>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://your-tunnel.trycloudflare.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
            />
          </View>

          {/* Quick Presets */}
          <Text style={styles.presetHeading}>QUICK CONNECT PRESETS:</Text>
          <View style={styles.presetRow}>
            <Pressable
              onPress={() => {
                setUrlInput(DEFAULT_WIFI_URL);
                handleTestAndSave(DEFAULT_WIFI_URL);
              }}
              style={styles.presetChip}
            >
              <Ionicons name="wifi" size={14} color="#059669" />
              <Text style={styles.presetChipText}>Local Wi-Fi (192.168.29.51)</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setUrlInput(DEFAULT_TUNNEL_URL);
                handleTestAndSave(DEFAULT_TUNNEL_URL);
              }}
              style={styles.presetChip}
            >
              <Ionicons name="cloud" size={14} color="#2563EB" />
              <Text style={styles.presetChipText}>Active Cloudflare Tunnel</Text>
            </Pressable>
          </View>

          {/* Status Message */}
          {statusMsg && (
            <View
              style={[
                styles.statusBox,
                statusMsg.ok ? styles.statusBoxSuccess : styles.statusBoxError,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  statusMsg.ok ? styles.statusTextSuccess : styles.statusTextError,
                ]}
              >
                {statusMsg.text}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleReset}
              style={styles.resetBtn}
              accessibilityRole="button"
            >
              <Text style={styles.resetBtnText}>Reset Default</Text>
            </Pressable>

            <Pressable
              onPress={() => handleTestAndSave()}
              disabled={testing}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.88 },
                testing && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
            >
              {testing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save & Connect</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999999,
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    ...Platform.select({
      web: { boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)' },
      default: { elevation: 16 },
    }),
  },
  desktopDialog: {
    maxWidth: 520,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dialogSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  currentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  currentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
  },
  currentText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F172A',
    fontWeight: '600',
  },
  inputWrap: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  presetHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  statusBox: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  statusBoxSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBoxError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextSuccess: {
    color: '#166534',
  },
  statusTextError: {
    color: '#991B1B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' },
      default: { elevation: 3 },
    }),
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

