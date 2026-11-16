import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { AppIcon } from '../icons/AppIcon';
import { Row } from '../../types';
import { money } from '../../finance';
import { today } from '../../forms';

export interface ParsedAttendanceVoice {
  rawText: string;
  matchedWorker: Row | null;
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
  units: '1' | '0.5' | '0';
  date: string;
  siteId: string;
  confidence: number;
}

export interface VoiceAttendanceModalProps {
  visible: boolean;
  onClose: () => void;
  workers: Row[];
  sites: Row[];
  selectedDate: string;
  activeWorker?: Row | null;
  onSaveAttendance: (parsed: {
    worker: Row;
    workerId: string;
    siteId: string;
    date: string;
    units: string;
    status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
    notes?: string;
  }) => Promise<void>;
}

// Shift date helper
const shiftDate = (dateStr: string, days: number): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  } catch {
    return dateStr;
  }
};

const formatDateDisplay = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Transliterate Devanagari Hindi text to Latin phonetics so Hindi voice matches English names
function transliterateDevanagari(text: string): string {
  if (!text) return '';
  const devToLat: Record<string, string> = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    '्': '', 'ं': 'n', 'ँ': 'n', 'ः': 'h'
  };

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (devToLat[ch] !== undefined) {
      out += devToLat[ch];
    } else {
      out += ch;
    }
  }
  return out.toLowerCase();
}

/**
 * Parses Hindi, Hinglish or English attendance voice text
 */
export function parseAttendanceVoiceText(
  text: string,
  workers: Row[],
  sites: Row[],
  defaultDate: string,
  activeWorker: Row | null = null
): ParsedAttendanceVoice {
  const rawLower = text.toLowerCase().trim();
  const latinTransliterated = transliterateDevanagari(rawLower);
  const combined = `${rawLower} ${latinTransliterated}`;

  // 1. Determine Status & Units
  let status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' = 'PRESENT';
  let units: '1' | '0.5' | '0' = '1';

  if (
    combined.includes('half') ||
    combined.includes('haaf') ||
    combined.includes('aadha') ||
    combined.includes('aadhi') ||
    combined.includes('आधा') ||
    combined.includes('हाफ') ||
    combined.includes('0.5')
  ) {
    status = 'HALF_DAY';
    units = '0.5';
  } else if (
    combined.includes('absent') ||
    combined.includes('chhutti') ||
    combined.includes('chutti') ||
    combined.includes('nahi aaya') ||
    combined.includes('छुट्टी') ||
    combined.includes('अनुपस्थित') ||
    combined.includes('नहीं आया') ||
    combined.includes('0')
  ) {
    status = 'ABSENT';
    units = '0';
  } else {
    status = 'PRESENT';
    units = '1';
  }

  // 2. Determine Date
  let date = defaultDate || today();
  if (combined.includes('aaj') || combined.includes('today') || combined.includes('आज')) {
    date = today();
  } else if (combined.includes('kal') || combined.includes('yesterday') || combined.includes('कल')) {
    date = shiftDate(today(), -1);
  } else if (combined.includes('parso') || combined.includes('परसों')) {
    date = shiftDate(today(), -2);
  }

  // 3. Match Worker
  let matchedWorker: Row | null = null;
  let bestScore = 0;

  for (const w of workers) {
    const wFullName = (w.name || '').toLowerCase().trim();
    const wFirst = wFullName.split(/\s+/)[0];

    // Check against both original and transliterated
    if (combined.includes(wFullName) && wFullName.length > bestScore) {
      matchedWorker = w;
      bestScore = wFullName.length + 10;
    } else if (wFirst.length >= 3 && combined.includes(wFirst) && wFirst.length > bestScore) {
      matchedWorker = w;
      bestScore = wFirst.length;
    }
  }

  // If user said "inki", "iski", "unka" (इनकी / इनकी लगा दो)
  if (!matchedWorker && (combined.includes('inki') || combined.includes('iski') || combined.includes('इनकी') || combined.includes('इसकी'))) {
    matchedWorker = activeWorker || workers[0] || null;
  }

  // 4. Match Site
  let siteId = sites[0]?.id ? String(sites[0].id) : '';
  for (const s of sites) {
    const sName = (s.name || '').toLowerCase();
    if (combined.includes(sName)) {
      siteId = String(s.id);
      break;
    }
  }

  return {
    rawText: text,
    matchedWorker,
    status,
    units,
    date,
    siteId,
    confidence: matchedWorker ? 0.95 : 0.3,
  };
}

export function VoiceAttendanceModal({
  visible,
  onClose,
  workers,
  sites,
  selectedDate,
  activeWorker = null,
  onSaveAttendance,
}: VoiceAttendanceModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Initialize and start Speech Recognition immediately on open
  const startListening = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null;

      if (!SpeechRecognition) {
        setVoiceStatus('Browser mic support not available. Please allow microphone permission.');
        return;
      }

      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN'; // Pure Hindi & Hinglish voice recognition
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceStatus('🔴 सुन रहा हूँ... बोलिए (जैसे: "गोपाल जी हाजिरी लगा दो आज की")');
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          setVoiceText(transcript);
        };

        recognition.onerror = () => {
          setIsListening(false);
          setVoiceStatus('आवाज़ साफ़ नहीं आई। दोबारा बोलने के लिए माइक दबाएं।');
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err: any) {
        setIsListening(false);
        setVoiceStatus('माइक शुरू करने के लिए टैप करें');
      }
    } else {
      setVoiceStatus('माइक पर टैप करके बोलें');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Start listening immediately when modal opens
  useEffect(() => {
    if (visible) {
      setVoiceText('');
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [visible]);

  // Parse voice text
  const parsed = useMemo(() => {
    if (!voiceText.trim()) return null;
    return parseAttendanceVoiceText(
      voiceText,
      workers,
      sites,
      selectedDate,
      activeWorker
    );
  }, [voiceText, workers, sites, selectedDate, activeWorker]);

  // Save attendance
  const handleConfirmSave = async () => {
    if (!parsed?.matchedWorker) return;
    setSaving(true);
    try {
      await onSaveAttendance({
        worker: parsed.matchedWorker,
        workerId: parsed.matchedWorker.id,
        siteId: parsed.siteId || (sites[0]?.id ? String(sites[0].id) : ''),
        date: parsed.date,
        units: parsed.units,
        status: parsed.status,
        notes: 'Marked via Voice Mic',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.modalOverlayDesktop]}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheetCard, isDesktop && styles.sheetCardDesktop]}>
          {/* Mobile Drag Handle */}
          {!isDesktop && <View style={styles.dragHandle} />}

          {/* Clean Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIconCircle}>
                <AppIcon name="mic" size={18} color="#2563EB" />
              </View>
              <Text style={styles.headerTitle}>बोल कर हाजिरी लगाएं</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <AppIcon name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Large Pulsing Mic Circle */}
            <View style={styles.micCenterSection}>
              <Pressable
                onPress={isListening ? stopListening : startListening}
                style={[
                  styles.bigMicCircle,
                  isListening && styles.bigMicCircleActive,
                ]}
              >
                <AppIcon
                  name={isListening ? 'mic' : 'mic-outline'}
                  size={40}
                  color="#FFFFFF"
                />
              </Pressable>

              <Text style={styles.micListeningStatus}>
                {isListening ? (
                  <Text style={{ color: '#DC2626', fontWeight: '800' }}>
                    🔴 सुन रहा हूँ... बोलिए
                  </Text>
                ) : (
                  voiceStatus || 'माइक पर टैप करके बोलें'
                )}
              </Text>
            </View>

            {/* 2. Recognized Transcript Bubble */}
            {voiceText ? (
              <View style={styles.transcriptBubble}>
                <AppIcon name="chatbubble-ellipses" size={18} color="#2563EB" />
                <Text style={styles.transcriptText}>{voiceText}</Text>
              </View>
            ) : null}

            {/* 3. Parsed Result Card & 1-Click Confirm Button */}
            {parsed ? (
              <View
                style={[
                  styles.previewCard,
                  parsed.status === 'PRESENT' && styles.previewPresent,
                  parsed.status === 'HALF_DAY' && styles.previewHalf,
                  parsed.status === 'ABSENT' && styles.previewAbsent,
                ]}
              >
                {parsed.matchedWorker ? (
                  <>
                    <View style={styles.workerIdentifiedRow}>
                      <View style={styles.workerAvatar}>
                        <Text style={styles.workerAvatarText}>
                          {(parsed.matchedWorker.name || 'W').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerIdentifiedName}>
                          {parsed.matchedWorker.name}
                        </Text>
                        <Text style={styles.workerIdentifiedSub}>
                          {parsed.status === 'PRESENT'
                            ? '🟢 उपस्थित (Full Day)'
                            : parsed.status === 'HALF_DAY'
                              ? '🟡 हाफ डे (0.5 Day)'
                              : '🔴 अनुपस्थित (0 Day)'} • 📅 {formatDateDisplay(parsed.date)}
                        </Text>
                      </View>
                      <View style={styles.wageBadge}>
                        <Text style={styles.wageBadgeText}>
                          {money(
                            Math.round(
                              Number(parsed.matchedWorker.daily_rate || 0) *
                                Number(parsed.units)
                            )
                          )}
                        </Text>
                      </View>
                    </View>

                    {/* Single Confirm Save Button */}
                    <Pressable
                      onPress={handleConfirmSave}
                      disabled={saving}
                      style={[styles.confirmSaveBtn, saving && { opacity: 0.7 }]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <AppIcon name="checkmark-done" size={18} color="#FFFFFF" />
                          <Text style={styles.confirmSaveBtnText}>
                            हाजिरी दर्ज करें ({parsed.matchedWorker.name})
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.unmatchedNotice}>
                    <AppIcon name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.unmatchedNoticeText}>
                      मजदूर का नाम समझ नहीं आया। साफ़ आवाज़ में मजदूर का नाम बोलें।
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalOverlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetCardDesktop: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 22,
    maxHeight: 520,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: 400,
  },
  scrollContent: {
    gap: 12,
    paddingVertical: 8,
  },

  // Big Mic Section
  micCenterSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  bigMicCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  bigMicCircleActive: {
    backgroundColor: '#DC2626',
    borderWidth: 4,
    borderColor: '#FECACA',
    shadowColor: '#DC2626',
  },
  micListeningStatus: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    fontWeight: '700',
    paddingHorizontal: 16,
  },

  // Transcript Bubble
  transcriptBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    padding: 12,
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0369A1',
  },

  // Preview Card
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  previewPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  previewHalf: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  previewAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  workerIdentifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  workerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  workerIdentifiedName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  workerIdentifiedSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  wageBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  wageBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  confirmSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmSaveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  unmatchedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  unmatchedNoticeText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
});
