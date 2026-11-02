import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../icons/AppIcon';
import { Snapshot, Row } from '../../types';
import { today } from '../../forms';
import { money } from '../../finance';

export interface VoiceInputModalProps {
  visible: boolean;
  onClose: () => void;
  data: Snapshot;
  initialSiteId?: string;
  onSaveVoiceEntry: (
    action: 'attendance.save' | 'entry.create',
    payload: any
  ) => Promise<boolean>;
  onShowToast?: (msg: string, type?: string) => void;
}

export type DetectedCategory =
  | 'ATTENDANCE'
  | 'WAGE_PAYMENT'
  | 'MATERIAL'
  | 'EXPENSE'
  | 'RECEIPT'
  | 'UNKNOWN';

interface ParsedResult {
  category: DetectedCategory;
  workerId?: string;
  workerName?: string;
  siteId?: string;
  siteName?: string;
  units?: 1 | 0.5 | 0;
  overtimeMinutes?: number;
  amount?: number; // in rupees
  description?: string;
  date: string;
  rawText: string;
}

// Hindi number word to digit converter helper
const parseNumberWords = (text: string): number | null => {
  const t = text.toLowerCase();
  // Check for direct numeric values first (e.g. ₹500, 1500, 50,000)
  const numMatch = t.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
  if (numMatch) {
    const clean = numMatch[1].replace(/,/g, '');
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 0) return Math.round(val);
  }

  // Common Hindi multipliers
  const words: Record<string, number> = {
    ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5,
    chhah: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
    gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
    solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20,
    tees: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50,
    saath: 60, sattar: 70, assi: 80, nabbe: 90,
  };

  let total = 0;
  let current = 0;

  // Lakh check
  const lakhMatch = t.match(/(\w+)?\s*(?:lakh|laakh)/i);
  if (lakhMatch) {
    const mult = lakhMatch[1] && words[lakhMatch[1]] ? words[lakhMatch[1]] : 1;
    total += mult * 100000;
  }

  // Hazaar check
  const hazarMatch = t.match(/(\w+)?\s*(?:hazar|hazaar|hjaar)/i);
  if (hazarMatch) {
    const mult = hazarMatch[1] && words[hazarMatch[1]] ? words[hazarMatch[1]] : 1;
    total += mult * 1000;
  }

  // Sau check
  const sauMatch = t.match(/(\w+)?\s*(?:sau|so)/i);
  if (sauMatch) {
    const mult = sauMatch[1] && words[sauMatch[1]] ? words[sauMatch[1]] : 1;
    total += mult * 100;
  }

  return total > 0 ? total : null;
};

// Natural Language Parser for Hindi / Hinglish / English Voice Prompts
export function parseVoiceInput(
  raw: string,
  data: Snapshot,
  defaultSiteId?: string
): ParsedResult {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const currentDate = today();

  // 1. Worker Identification
  let detectedWorker: Row | undefined;
  for (const w of data.workers) {
    const nameLower = (w.name || '').toLowerCase().trim();
    if (!nameLower) continue;
    // Check if worker name appears as a whole word or substring
    const parts = nameLower.split(/\s+/);
    const firstName = parts[0];
    if (lower.includes(nameLower) || (firstName.length >= 3 && lower.includes(firstName))) {
      detectedWorker = w;
      break;
    }
  }

  // 2. Site Identification
  let detectedSite: Row | undefined;
  for (const s of data.sites) {
    const nameLower = (s.name || '').toLowerCase().trim();
    if (!nameLower) continue;
    const parts = nameLower.split(/\s+/);
    const firstName = parts[0];
    if (lower.includes(nameLower) || (firstName.length >= 4 && lower.includes(firstName))) {
      detectedSite = s;
      break;
    }
  }
  const siteId = detectedSite?.id || defaultSiteId || data.sites[0]?.id || '';
  const siteName = (detectedSite || data.sites.find((s) => s.id === siteId))?.name || 'Default Site';

  // 3. Amount Extraction
  const amount = parseNumberWords(lower) || undefined;

  // 4. Overtime Detection
  let overtimeMinutes = 0;
  const otMatch = lower.match(/(\d+)\s*(?:ghante|ghanta|hour|hours|hr|hrs)?\s*(?:overtime|ot)/i);
  if (otMatch) {
    const hrs = parseInt(otMatch[1], 10);
    if (!isNaN(hrs)) overtimeMinutes = hrs * 60;
  }

  // 5. Intent / Category Detection
  const isAdvanceKeywords =
    lower.includes('advance') ||
    lower.includes('diye') ||
    lower.includes('diya') ||
    lower.includes('paid') ||
    lower.includes('wage') ||
    lower.includes('majdoori') ||
    lower.includes('payment diya') ||
    lower.includes('haathkharch');

  const isMaterialKeywords =
    lower.includes('cement') ||
    lower.includes('ret') ||
    lower.includes('balu') ||
    lower.includes('badarpur') ||
    lower.includes('sariya') ||
    lower.includes('paint') ||
    lower.includes('putti') ||
    lower.includes('eet') ||
    lower.includes('bricks') ||
    lower.includes('gitti') ||
    lower.includes('rodi') ||
    lower.includes('tiles') ||
    lower.includes('material') ||
    lower.includes('saman');

  const isExpenseKeywords =
    lower.includes('diesel') ||
    lower.includes('petrol') ||
    lower.includes('fuel') ||
    lower.includes('chai') ||
    lower.includes('nashta') ||
    lower.includes('khana') ||
    lower.includes('auto') ||
    lower.includes('tempo') ||
    lower.includes('bhada') ||
    lower.includes('kiraya') ||
    lower.includes('freight') ||
    lower.includes('kharcha') ||
    lower.includes('expense');

  const isReceiptKeywords =
    lower.includes('paisa aaya') ||
    lower.includes('payment aayi') ||
    lower.includes('jama') ||
    lower.includes('received') ||
    lower.includes('client payment');

  const isAttendanceKeywords =
    lower.includes('haziri') ||
    lower.includes('attendance') ||
    lower.includes('present') ||
    lower.includes('aaya') ||
    lower.includes('aaye') ||
    lower.includes('aayi') ||
    lower.includes('half day') ||
    lower.includes('half') ||
    lower.includes('aadha') ||
    lower.includes('aadhi') ||
    lower.includes('absent') ||
    lower.includes('chhutti') ||
    lower.includes('chutti') ||
    lower.includes('nahi aaya');

  // Decision Logic
  // Case A: Labour Advance / Wage Payment
  if (detectedWorker && isAdvanceKeywords && amount) {
    return {
      category: 'WAGE_PAYMENT',
      workerId: detectedWorker.id,
      workerName: detectedWorker.name,
      siteId,
      siteName,
      amount,
      description: `${detectedWorker.name} ko advance payment`,
      date: currentDate,
      rawText: text,
    };
  }

  // Case B: Material Cost
  if (isMaterialKeywords && amount) {
    return {
      category: 'MATERIAL',
      siteId,
      siteName,
      amount,
      description: text.slice(0, 100),
      date: currentDate,
      rawText: text,
    };
  }

  // Case C: Site Expense (Diesel, Chai, Auto, etc.)
  if (isExpenseKeywords && amount) {
    return {
      category: 'EXPENSE',
      siteId,
      siteName,
      amount,
      description: text.slice(0, 100),
      date: currentDate,
      rawText: text,
    };
  }

  // Case D: Client Receipt
  if (isReceiptKeywords && amount) {
    return {
      category: 'RECEIPT',
      siteId,
      siteName,
      amount,
      description: text.slice(0, 100),
      date: currentDate,
      rawText: text,
    };
  }

  // Case E: Haziri / Attendance
  if (detectedWorker || isAttendanceKeywords) {
    let units: 1 | 0.5 | 0 = 1; // Default Present
    if (
      lower.includes('half') ||
      lower.includes('aadha') ||
      lower.includes('aadhi') ||
      lower.includes('adha') ||
      lower.includes('0.5')
    ) {
      units = 0.5;
    } else if (
      lower.includes('absent') ||
      lower.includes('chhutti') ||
      lower.includes('chutti') ||
      lower.includes('nahi aaya') ||
      lower.includes('bimar')
    ) {
      units = 0;
    }

    const worker = detectedWorker || data.workers.find((w) => w.active);
    return {
      category: 'ATTENDANCE',
      workerId: worker?.id,
      workerName: worker?.name || 'Worker',
      siteId,
      siteName,
      units,
      overtimeMinutes,
      description: `Voice Haziri: ${units === 1 ? 'Present' : units === 0.5 ? 'Half Day' : 'Absent'}`,
      date: currentDate,
      rawText: text,
    };
  }

  // Fallback: If amount is present, treat as Expense
  if (amount) {
    return {
      category: 'EXPENSE',
      siteId,
      siteName,
      amount,
      description: text || 'Kharcha',
      date: currentDate,
      rawText: text,
    };
  }

  return {
    category: 'UNKNOWN',
    siteId,
    siteName,
    date: currentDate,
    rawText: text,
  };
}

export function VoiceInputModal({
  visible,
  onClose,
  data,
  initialSiteId,
  onSaveVoiceEntry,
  onShowToast,
}: VoiceInputModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recognitionLanguage, setRecognitionLanguage] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [isSaving, setIsSaving] = useState(false);

  // Editable parsed draft
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [editCategory, setEditCategory] = useState<DetectedCategory>('ATTENDANCE');
  const [editWorkerId, setEditWorkerId] = useState<string>('');
  const [editSiteId, setEditSiteId] = useState<string>('');
  const [editUnits, setEditUnits] = useState<1 | 0.5 | 0>(1);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');

  // Pulse animation for mic
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recognitionRef = useRef<any>(null);

  // Check speech recognition support and initialize
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    } else {
      // Native fallback
      setSpeechSupported(false);
    }
  }, []);

  // Pulse animation loop when listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  // When speechText changes, re-parse
  useEffect(() => {
    if (!speechText.trim()) {
      setParsed(null);
      return;
    }
    const result = parseVoiceInput(speechText, data, initialSiteId);
    setParsed(result);
    setEditCategory(result.category !== 'UNKNOWN' ? result.category : 'ATTENDANCE');
    if (result.workerId) setEditWorkerId(result.workerId);
    if (result.siteId) setEditSiteId(result.siteId);
    if (result.units !== undefined) setEditUnits(result.units);
    if (result.amount !== undefined) setEditAmount(String(result.amount));
    if (result.description) setEditDesc(result.description);
  }, [speechText, data, initialSiteId]);

  // Start listening function
  const startListening = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        onShowToast?.('Speech Recognition browser me uplabdh nahi hai. Aap likhkar try karein.', 'w');
        return;
      }

      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch { }
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = recognitionLanguage;
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setSpeechText(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('[VoiceInput] Error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            onShowToast?.('Microphone permission blocked hai. Browser setting me allow karein.', 'e');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err: any) {
        console.warn('[VoiceInput] Start error:', err);
        setIsListening(false);
      }
    } else {
      onShowToast?.('Mobile microphone integration ready. Text enter karein.', 'i');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { }
    }
    setIsListening(false);
  };

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setSpeechText('');
      setParsed(null);
      setEditWorkerId(data.workers.find((w) => w.active)?.id || '');
      setEditSiteId(initialSiteId || data.sites[0]?.id || '');
      setEditUnits(1);
      setEditAmount('');
      setEditDesc('');
      // Auto start listening on open if supported
      setTimeout(() => {
        startListening();
      }, 300);
    } else {
      stopListening();
    }
  }, [visible]);

  // Handle Save
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (editCategory === 'ATTENDANCE') {
        if (!editWorkerId) {
          onShowToast?.('Kripya worker chunein', 'w');
          setIsSaving(false);
          return;
        }
        const success = await onSaveVoiceEntry('attendance.save', {
          site_id: editSiteId || data.sites[0]?.id,
          worker_id: editWorkerId,
          date: parsed?.date || today(),
          units: editUnits,
          overtime_minutes: parsed?.overtimeMinutes || 0,
          notes: editDesc || 'Bol kar lagayi gayi haziri',
        });
        if (success) {
          const wName = data.workers.find((w) => w.id === editWorkerId)?.name || 'Worker';
          onShowToast?.(`✅ ${wName} ki Haziri darj ho gayi!`, 's');
          onClose();
        }
      } else {
        // Financial Entry
        const numAmt = parseFloat(editAmount);
        if (isNaN(numAmt) || numAmt <= 0) {
          onShowToast?.('Kripya sahi amount (rakam) dalein', 'w');
          setIsSaving(false);
          return;
        }

        const amtInPaise = Math.round(numAmt * 100);
        const payload: any = {
          site_id: editSiteId || data.sites[0]?.id,
          kind: editCategory,
          amount: amtInPaise,
          date: parsed?.date || today(),
          description: editDesc || `${editCategory} Entry`,
          mode: 'CASH',
          party: editCategory === 'WAGE_PAYMENT' ? data.workers.find((w) => w.id === editWorkerId)?.name || '' : '',
          worker_id: editCategory === 'WAGE_PAYMENT' ? editWorkerId : null,
        };

        const success = await onSaveVoiceEntry('entry.create', payload);
        if (success) {
          onShowToast?.(`✅ ₹${numAmt} ki entry save ho gayi!`, 's');
          onClose();
        }
      }
    } catch (err: any) {
      onShowToast?.(err.message || 'Error saving entry', 'e');
    } finally {
      setIsSaving(false);
    }
  };

  const sampleVoicePrompts = [
    'रमेश की हाजिरी लगा दो',
    'सोनू हाफ डे',
    'रमेश को 500 रुपये एडवांस',
    'चाय नाश्ता 150 खर्चा',
    '10 बोरी सीमेंट 3500',
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheetContent, isDesktop && styles.desktopSheet]}>
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="mic" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Bol Kar Likhein</Text>
                <Text style={styles.headerSub}>Voice Haziri & Expense Assistant</Text>
              </View>
            </View>

            {/* Language toggle pill */}
            <Pressable
              onPress={() =>
                setRecognitionLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))
              }
              style={styles.langPill}
            >
              <Text style={styles.langPillText}>
                {recognitionLanguage === 'hi-IN' ? '🇮🇳 हिंदी' : '🇬🇧 English'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* 1. ANIMATED MIC BUTTON & STATUS */}
            <View style={styles.micSection}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: isListening ? 0.35 : 0,
                  },
                ]}
              />

              <Pressable
                onPress={() => (isListening ? stopListening() : startListening())}
                style={[
                  styles.micButton,
                  isListening ? styles.micButtonActive : styles.micButtonIdle,
                ]}
                accessibilityLabel="Toggle voice recording"
              >
                <Ionicons
                  name={isListening ? 'mic' : 'mic-outline'}
                  size={36}
                  color="#FFFFFF"
                />
              </Pressable>

              <Text style={styles.listeningStatusText}>
                {isListening
                  ? 'सुन रहा हूँ... साफ़ आवाज़ में बोलिए'
                  : 'माइक दबाकर बोलिए'}
              </Text>
            </View>

            {/* 2. REALTIME TRANSCRIPT / MANUAL EDIT BOX */}
            <View style={styles.transcriptCard}>
              <View style={styles.transcriptCardHeader}>
                <Text style={styles.transcriptCardLabel}>
                  {isListening ? 'Recording Live...' : 'Aapki Awaaz / Text:'}
                </Text>
                {speechText ? (
                  <Pressable onPress={() => setSpeechText('')}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>

              <TextInput
                value={speechText}
                onChangeText={setSpeechText}
                placeholder="उदा: 'Ramesh present' ya 'Ramesh ko 500 advance' ya '150 chai kharcha'"
                placeholderTextColor="#94A3B8"
                multiline
                style={styles.transcriptInput}
              />
            </View>

            {/* 3. QUICK CHIPS (If user wants to test quickly) */}
            <View style={styles.sampleChipsSection}>
              <Text style={styles.sampleSectionTitle}>Bolne ke udharan (Tap to try):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {sampleVoicePrompts.map((p, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSpeechText(p)}
                    style={styles.sampleChip}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color="#2563EB" />
                    <Text style={styles.sampleChipText}>{p}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* 4. SMART RECOGNITION PREVIEW CARD */}
            {parsed ? (
              <View style={styles.previewCard}>
                <View style={styles.previewCardTop}>
                  <View style={styles.detectedBadgeRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        editCategory === 'ATTENDANCE'
                          ? styles.badgeGreen
                          : editCategory === 'WAGE_PAYMENT'
                            ? styles.badgeBlue
                            : editCategory === 'MATERIAL'
                              ? styles.badgeAmber
                              : styles.badgeRose,
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>
                        {editCategory === 'ATTENDANCE'
                          ? '✅ HAZIRI / ATTENDANCE'
                          : editCategory === 'WAGE_PAYMENT'
                            ? '💵 LABOUR ADVANCE / WAGE'
                            : editCategory === 'MATERIAL'
                              ? '🧱 MATERIAL BILL'
                              : editCategory === 'RECEIPT'
                                ? '💰 CLIENT PAYMENT'
                                : '🧾 SITE EXPENSE (KHARCHA)'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.previewSubtitle}>Smart Parser dwara samjha gaya</Text>
                </View>

                {/* Form Fields Based on Category */}
                <View style={styles.previewForm}>
                  {/* Category Switcher Tabs */}
                  <View style={styles.categorySwitchRow}>
                    <Pressable
                      onPress={() => setEditCategory('ATTENDANCE')}
                      style={[
                        styles.catTab,
                        editCategory === 'ATTENDANCE' && styles.catTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catTabText,
                          editCategory === 'ATTENDANCE' && styles.catTabTextActive,
                        ]}
                      >
                        Haziri
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setEditCategory('WAGE_PAYMENT')}
                      style={[
                        styles.catTab,
                        editCategory === 'WAGE_PAYMENT' && styles.catTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catTabText,
                          editCategory === 'WAGE_PAYMENT' && styles.catTabTextActive,
                        ]}
                      >
                        Advance
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setEditCategory('EXPENSE')}
                      style={[
                        styles.catTab,
                        editCategory === 'EXPENSE' && styles.catTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catTabText,
                          editCategory === 'EXPENSE' && styles.catTabTextActive,
                        ]}
                      >
                        Kharcha
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setEditCategory('MATERIAL')}
                      style={[
                        styles.catTab,
                        editCategory === 'MATERIAL' && styles.catTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catTabText,
                          editCategory === 'MATERIAL' && styles.catTabTextActive,
                        ]}
                      >
                        Material
                      </Text>
                    </Pressable>
                  </View>

                  {/* Worker Selection (For Attendance or Wage Payment) */}
                  {(editCategory === 'ATTENDANCE' || editCategory === 'WAGE_PAYMENT') && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>👷 Labour / Worker:</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.workerSelectScroll}
                      >
                        {data.workers
                          .filter((w) => w.active)
                          .map((w) => {
                            const isSelected = w.id === editWorkerId;
                            return (
                              <Pressable
                                key={w.id}
                                onPress={() => setEditWorkerId(w.id)}
                                style={[
                                  styles.workerPill,
                                  isSelected && styles.workerPillSelected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.workerPillText,
                                    isSelected && styles.workerPillTextSelected,
                                  ]}
                                >
                                  {w.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Site Selection */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>🏗️ Work Site:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.siteSelectScroll}
                    >
                      {data.sites.map((s) => {
                        const isSelected = s.id === editSiteId;
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() => setEditSiteId(s.id)}
                            style={[
                              styles.sitePill,
                              isSelected && styles.sitePillSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.sitePillText,
                                isSelected && styles.sitePillTextSelected,
                              ]}
                            >
                              {s.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Attendance Specific Units Selector */}
                  {editCategory === 'ATTENDANCE' && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>📅 Attendance Status:</Text>
                      <View style={styles.unitsRow}>
                        <Pressable
                          onPress={() => setEditUnits(1)}
                          style={[
                            styles.unitBtn,
                            editUnits === 1 && styles.unitBtnPresent,
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={editUnits === 1 ? '#FFFFFF' : '#16A34A'}
                          />
                          <Text
                            style={[
                              styles.unitBtnText,
                              editUnits === 1 && styles.unitBtnTextWhite,
                            ]}
                          >
                            Present (1)
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setEditUnits(0.5)}
                          style={[
                            styles.unitBtn,
                            editUnits === 0.5 && styles.unitBtnHalf,
                          ]}
                        >
                          <Ionicons
                            name="time"
                            size={18}
                            color={editUnits === 0.5 ? '#FFFFFF' : '#D97706'}
                          />
                          <Text
                            style={[
                              styles.unitBtnText,
                              editUnits === 0.5 && styles.unitBtnTextWhite,
                            ]}
                          >
                            Half Day (0.5)
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setEditUnits(0)}
                          style={[
                            styles.unitBtn,
                            editUnits === 0 && styles.unitBtnAbsent,
                          ]}
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color={editUnits === 0 ? '#FFFFFF' : '#DC2626'}
                          />
                          <Text
                            style={[
                              styles.unitBtnText,
                              editUnits === 0 && styles.unitBtnTextWhite,
                            ]}
                          >
                            Absent (0)
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Amount Field (For Financial Entries) */}
                  {editCategory !== 'ATTENDANCE' && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>💰 Amount (रुपये):</Text>
                      <View style={styles.amountInputRow}>
                        <Text style={styles.rupeeSymbol}>₹</Text>
                        <TextInput
                          value={editAmount}
                          onChangeText={setEditAmount}
                          placeholder="e.g. 500"
                          keyboardType="numeric"
                          style={styles.amountInput}
                        />
                      </View>

                      {/* Quick Adjust Buttons */}
                      <View style={styles.quickAddRow}>
                        {[100, 200, 500, 1000].map((step) => (
                          <Pressable
                            key={step}
                            onPress={() => {
                              const curr = parseFloat(editAmount) || 0;
                              setEditAmount(String(curr + step));
                            }}
                            style={styles.quickAddChip}
                          >
                            <Text style={styles.quickAddChipText}>+{step}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Description / Notes */}
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>📝 Vivaran / Note:</Text>
                    <TextInput
                      value={editDesc}
                      onChangeText={setEditDesc}
                      placeholder="Note ya description"
                      placeholderTextColor="#94A3B8"
                      style={styles.descInput}
                    />
                  </View>
                </View>

                {/* 5. CONFIRM & SAVE BUTTON */}
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.confirmSaveBtn,
                    pressed && { opacity: 0.88 },
                    isSaving && { opacity: 0.7 },
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                      <Text style={styles.confirmSaveBtnText}>
                        Pushti karein aur Save karein
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          {/* Close button at bottom */}
          <Pressable onPress={onClose} style={styles.footerCloseBtn}>
            <Text style={styles.footerCloseBtnText}>Bandh Karein (Close)</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 99999,
  },
  dismissArea: {
    flex: 1,
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: '90%',
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: { boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.2)' },
      default: { elevation: 20 },
    }),
  },
  desktopSheet: {
    maxWidth: 580,
    borderRadius: 24,
    marginBottom: 40,
    alignSelf: 'center',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  langPill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  scrollBody: {
    maxHeight: 520,
  },
  micSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563EB',
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)' },
      default: { elevation: 8 },
    }),
  },
  micButtonActive: {
    backgroundColor: '#DC2626',
  },
  micButtonIdle: {
    backgroundColor: '#2563EB',
  },
  listeningStatusText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  transcriptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  transcriptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  transcriptCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  transcriptInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    minHeight: 44,
  },
  sampleChipsSection: {
    marginBottom: 16,
  },
  sampleSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sampleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)' },
      default: { elevation: 3 },
    }),
  },
  previewCardTop: {
    marginBottom: 14,
  },
  detectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeBlue: {
    backgroundColor: '#DBEAFE',
  },
  badgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  badgeRose: {
    backgroundColor: '#FFE4E6',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  previewSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  previewForm: {
    gap: 12,
  },
  categorySwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  catTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  catTabActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
      default: { elevation: 1 },
    }),
  },
  catTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catTabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  fieldBlock: {
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  workerSelectScroll: {
    flexDirection: 'row',
  },
  workerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  workerPillSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  workerPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  workerPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  siteSelectScroll: {
    flexDirection: 'row',
  },
  sitePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  sitePillSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  sitePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  sitePillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  unitsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitBtnPresent: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  unitBtnHalf: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  unitBtnAbsent: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  unitBtnTextWhite: {
    color: '#FFFFFF',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563EB',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 8,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickAddChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickAddChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  descInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  confirmSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)' },
      default: { elevation: 4 },
    }),
  },
  confirmSaveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  footerCloseBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  footerCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});

