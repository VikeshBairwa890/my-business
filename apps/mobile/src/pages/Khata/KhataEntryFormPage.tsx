import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { paise } from '../../../../../shared/finance';
import { TopNavBar } from '../../components/common/TopNavBar';
import { CalendarPickerModal } from '../../components/common/CalendarPickerModal';
import { BillImageViewerModal } from '../../components/bills/BillImageViewerModal';
import { AppIcon } from '../../components/icons/AppIcon';
import { Colors } from '../../theme/colors';
import { showToast } from '../../context/ToastContext';
import {
  saveDocToIndexedDB,
  getDocFromIndexedDB,
  uploadDocToServer,
  fetchDocFromServer,
  triggerBrowserDownload,
  viewPdfDocument,
} from '../../storage/docStorage';
import { Row } from '../../types';
import { today } from '../../forms';
import { KHATA_MODES, getEntryDateStr, isDebitEntry, ymdToDmy, dmyToYmd } from './khataUtils';

interface KhataEntryFormPageProps {
  party: Row;
  initialIsDebit: boolean;
  entry?: Row;
  onBack: () => void;
  onSave: (values: {
    party_id: string;
    isDebit: boolean;
    amount: number;
    date: string;
    mode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    note: string;
    proof_url: string;
    proof_name: string;
    proof_mime: string;
  }) => void;
  onDelete?: (entryId: string) => void;
}

const QUICK_NOTES_GAVE = ['Loan given', 'Advance paid', 'Expense paid', 'Personal help'];
const QUICK_NOTES_GOT = ['Payment received', 'Partial repayment', 'Full settlement', 'Cash received'];
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export function KhataEntryFormPage({
  party,
  initialIsDebit,
  entry,
  onBack,
  onSave,
  onDelete,
}: KhataEntryFormPageProps) {
  const isEdit = Boolean(entry?.id);
  const isDebit = entry ? isDebitEntry(entry) : initialIsDebit;
  const existingProofUrl = String(entry?.proof_url || entry?.proofUrl || '');
  const existingProofName = String(entry?.proof_name || entry?.proofName || '');
  const existingProofMime = String(entry?.proof_mime || entry?.proofMime || '');

  const [date, setDate] = useState(ymdToDmy(entry ? getEntryDateStr(entry) : today()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [amountText, setAmountText] = useState(
    entry?.amount ? String(Number(entry.amount) / 100) : ''
  );
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>(
    (String(entry?.mode || 'CASH').toUpperCase() as 'CASH' | 'UPI' | 'BANK_TRANSFER') || 'CASH'
  );
  const [note, setNote] = useState(String(entry?.note || ''));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Proof attachment state (Photo or PDF)
  const [proofDocId, setProofDocId] = useState(existingProofUrl);
  const [proofDataUrl, setProofDataUrl] = useState('');
  const [proofName, setProofName] = useState(existingProofName);
  const [proofMime, setProofMime] = useState(existingProofMime);
  const [proofChanged, setProofChanged] = useState(false);
  const [pickingProof, setPickingProof] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const isGave = isDebit;
  const themeColor = isGave ? '#DC2626' : '#059669';
  const isPdf =
    proofMime.toLowerCase().includes('pdf') || proofName.toLowerCase().endsWith('.pdf');
  const hasProof = Boolean(proofDataUrl || proofDocId);

  // Load existing proof preview when editing an entry that has an attachment
  useEffect(() => {
    let active = true;
    if (!existingProofUrl) return;
    if (existingProofUrl.startsWith('data:') || existingProofUrl.startsWith('http')) {
      setProofDataUrl(existingProofUrl);
      return;
    }
    (async () => {
      const local = await getDocFromIndexedDB(existingProofUrl);
      if (active && local?.dataUrl) {
        setProofDataUrl(local.dataUrl);
        if (!existingProofMime && local.mimeType) setProofMime(local.mimeType);
        return;
      }
      const remote = await fetchDocFromServer(existingProofUrl);
      if (active && remote?.blobUrl) {
        setProofDataUrl(remote.blobUrl);
      }
    })();
    return () => {
      active = false;
    };
  }, [existingProofUrl]);

  const processWebImageFile = (file: File) => {
    setPickingProof(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) {
        setPickingProof(false);
        return;
      }
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      const img = new window.Image();
      img.onload = () => {
        let finalUrl = src;
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const canvas = document.createElement('canvas');
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            finalUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85);
          }
        }
        setProofDataUrl(finalUrl);
        setProofName(file.name || 'proof_photo.jpg');
        setProofMime(isPng ? 'image/png' : 'image/jpeg');
        setProofChanged(true);
        setPickingProof(false);
      };
      img.onerror = () => {
        setProofDataUrl(src);
        setProofName(file.name || 'proof_photo.jpg');
        setProofMime(file.type || 'image/jpeg');
        setProofChanged(true);
        setPickingProof(false);
      };
      img.src = src;
    };
    reader.onerror = () => {
      setPickingProof(false);
      showToast('Failed to read selected photo', 'e');
    };
    reader.readAsDataURL(file);
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          if (file.size > MAX_FILE_BYTES) {
            showToast('Photo must be under 2 MB', 'e');
            return;
          }
          processWebImageFile(file);
        }
      };
      input.click();
      return;
    }

    try {
      setPickingProof(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Please allow photo library permission', 'w');
        setPickingProof(false);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.72,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const mime = asset.mimeType || 'image/jpeg';
        const dataUrl = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
        setProofDataUrl(dataUrl);
        setProofName(asset.fileName || 'proof_photo.jpg');
        setProofMime(mime);
        setProofChanged(true);
      }
    } catch {
      showToast('Could not open photo picker', 'e');
    } finally {
      setPickingProof(false);
    }
  };

  const handlePickPdf = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) {
          showToast('PDF file must be under 2 MB', 'e');
          return;
        }
        setPickingProof(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) {
            setProofDataUrl(dataUrl);
            setProofName(file.name || 'payment_proof.pdf');
            setProofMime('application/pdf');
            setProofChanged(true);
          }
          setPickingProof(false);
        };
        reader.onerror = () => {
          setPickingProof(false);
          showToast('Failed to read PDF file', 'e');
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    showToast('Take a Photo via Camera or choose from Gallery on mobile', 'w');
  };

  const handleRemoveProof = () => {
    setProofDocId('');
    setProofDataUrl('');
    setProofName('');
    setProofMime('');
    setProofChanged(true);
  };

  const handleViewProof = async () => {
    let url = proofDataUrl;
    if (!url && proofDocId) {
      showToast('Loading proof attachment...', 'i');
      if (proofDocId.startsWith('data:') || proofDocId.startsWith('http')) {
        url = proofDocId;
      } else {
        const local = await getDocFromIndexedDB(proofDocId);
        if (local?.dataUrl) {
          url = local.dataUrl;
        } else {
          const remote = await fetchDocFromServer(proofDocId);
          if (remote?.blobUrl) {
            url = remote.blobUrl;
          }
        }
      }
      if (url) {
        setProofDataUrl(url);
      }
    }

    if (!url) {
      showToast('Please wait, attachment loading...', 'w');
      return;
    }

    setViewerOpen(true);
  };

  const handleSubmit = async () => {
    const cleanDate = dmyToYmd(date);
    if (!cleanDate) {
      showToast('Enter a valid date (DD/MM/YYYY)', 'e');
      return;
    }

    const trimmed = amountText.trim();
    if (!trimmed) {
      showToast('Please enter amount', 'e');
      return;
    }

    let amountPaise = 0;
    try {
      amountPaise = paise(trimmed);
    } catch {
      showToast('Enter a valid amount (e.g. 500 or 1250.50)', 'e');
      return;
    }

    if (amountPaise <= 0) {
      showToast('Amount must be greater than ₹0', 'e');
      return;
    }

    let finalProofUrl = proofDocId;
    let finalProofName = proofName;
    let finalProofMime = proofMime;

    if (proofChanged) {
      if (proofDataUrl) {
        const genId = `khata_doc_${Date.now()}`;
        const safeName = proofName || (isPdf ? 'payment_proof.pdf' : 'payment_proof.jpg');
        const safeMime = proofMime || (isPdf ? 'application/pdf' : 'image/jpeg');
        try {
          await saveDocToIndexedDB(genId, safeName, proofDataUrl, safeMime);
          uploadDocToServer(genId, safeName, proofDataUrl, safeMime).catch(() => { });
          finalProofUrl = genId;
          finalProofName = safeName;
          finalProofMime = safeMime;
        } catch {
          finalProofUrl = '';
          finalProofName = '';
          finalProofMime = '';
        }
      } else {
        finalProofUrl = '';
        finalProofName = '';
        finalProofMime = '';
      }
    }

    onSave({
      party_id: party.id,
      isDebit,
      amount: amountPaise,
      date: cleanDate,
      mode,
      note: note.trim(),
      proof_url: finalProofUrl,
      proof_name: finalProofName,
      proof_mime: finalProofMime,
    });
  };

  const quickNotes = isGave ? QUICK_NOTES_GAVE : QUICK_NOTES_GOT;

  return (
    <View style={styles.pageRoot}>
      <TopNavBar
        title={isEdit ? 'Edit Entry' : isGave ? 'You Gave' : 'You Got'}
        onBack={onBack}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Single Clean Unified Entry Form Card */}
          <View style={styles.card}>
            {/* 1. Date (Clickable Date Picker Box) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Date <Text style={styles.req}>*</Text>
              </Text>
              <Pressable
                onPress={() => setCalendarOpen(true)}
                style={({ pressed }) => [
                  styles.dateSelectBox,
                  pressed && { opacity: 0.85, borderColor: Colors.primary },
                ]}
                accessibilityLabel="Select Entry Date"
              >
                <View style={styles.dateValueWrap}>
                  <Text style={styles.dateValueText}>
                    {date || 'Select Date'}
                  </Text>
                </View>
                <View style={styles.calendarIconBtn}>
                  <AppIcon name="calendar-outline" size={19} color={Colors.primary} />
                </View>
              </Pressable>
            </View>

            {/* 2. Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {isGave ? 'Amount Given' : 'Amount Received'} <Text style={styles.req}>*</Text>
              </Text>
              <View style={styles.amountInputWrap}>
                <Text style={[styles.rupeePrefix, { color: themeColor }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: themeColor }]}
                  value={amountText}
                  onChangeText={setAmountText}
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="decimal-pad"
                  autoFocus={!isEdit}
                />
                {amountText ? (
                  <Pressable onPress={() => setAmountText('')} hitSlop={8}>
                    <AppIcon name="close-circle" size={18} color="#CBD5E1" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* 3. Payment Mode */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Payment Mode</Text>
              <View style={styles.modeRow}>
                {KHATA_MODES.map((m) => {
                  const active = mode === m.value;
                  return (
                    <Pressable
                      key={m.value}
                      onPress={() => setMode(m.value)}
                      style={[
                        styles.modeChip,
                        active && styles.modeChipActive,
                      ]}
                    >
                      <AppIcon
                        name={m.icon}
                        size={15}
                        color={active ? '#FFFFFF' : Colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.modeChipText,
                          active && styles.modeChipTextActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. Details / Note */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Details / Note (Optional)</Text>
              <View style={[styles.inputWrap, { alignItems: 'flex-start', paddingVertical: 8 }]}>
                <TextInput
                  style={[styles.input, { minHeight: 54, textAlignVertical: 'top' }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder={
                    isGave
                      ? 'e.g. Personal loan, worker advance, expense...'
                      : 'e.g. Loan repaid, received via UPI or cash...'
                  }
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>
              <View style={styles.noteChipsRow}>
                {quickNotes.map((qn) => {
                  const selected = note === qn;
                  return (
                    <Pressable
                      key={qn}
                      onPress={() => setNote(qn)}
                      style={[styles.noteChip, selected && styles.noteChipActive]}
                    >
                      <Text style={[styles.noteChipText, selected && styles.noteChipTextActive]}>
                        {qn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 5. Proof Attachment (Photo or PDF) */}
            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <View style={styles.proofHeaderRow}>
                <Text style={styles.label}>Proof / Receipt (Optional)</Text>
                <Text style={styles.proofSizeHint}>(Max 2 MB)</Text>
              </View>

              {pickingProof ? (
                <View style={styles.proofLoadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.proofLoadingText}>Processing file...</Text>
                </View>
              ) : hasProof ? (
                <View style={styles.proofAttachedCard}>
                  {/* Left: Thumbnail / Document Preview (Static, not clickable) */}
                  <View style={styles.proofThumbWrap}>
                    {isPdf ? (
                      <View style={styles.pdfBadgeBox}>
                        <AppIcon name="document-text" size={22} color="#DC2626" />
                        <Text style={styles.pdfBadgeText}>PDF</Text>
                      </View>
                    ) : proofDataUrl ? (
                      <Image source={{ uri: proofDataUrl }} style={styles.proofImgThumb} />
                    ) : (
                      <View style={styles.photoPlaceholderBox}>
                        <AppIcon name="image-outline" size={22} color={Colors.primary} />
                      </View>
                    )}
                  </View>

                  {/* Middle: Name and status (Static, not clickable) */}
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.proofFileName} numberOfLines={1}>
                      {proofName || (isPdf ? 'payment_proof.pdf' : 'payment_proof.jpg')}
                    </Text>
                    <View style={styles.proofMetaRow}>
                      <View
                        style={[
                          styles.proofTypeTag,
                          isPdf ? styles.pdfTypeTag : styles.imgTypeTag,
                        ]}
                      >
                        <Text
                          style={[
                            styles.proofTypeTagText,
                            isPdf ? styles.pdfTypeTagText : styles.imgTypeTagText,
                          ]}
                        >
                          {isPdf ? 'PDF' : 'IMAGE'}
                        </Text>
                      </View>
                      <Text style={styles.proofAttachedLabel}>Attached</Text>
                    </View>
                  </View>

                  {/* Right Actions: Explicit View & Remove Buttons ONLY */}
                  <View style={styles.proofActionsRow}>
                    <Pressable
                      onPress={handleViewProof}
                      style={({ pressed }) => [styles.proofViewBtn, pressed && { opacity: 0.75 }]}
                      hitSlop={8}
                      accessibilityLabel="View Proof Attachment"
                    >
                      <AppIcon name="eye-outline" size={16} color={Colors.primary} />
                    </Pressable>

                    <Pressable
                      onPress={handleRemoveProof}
                      style={({ pressed }) => [
                        styles.proofRemoveBtn,
                        pressed && { opacity: 0.75 },
                      ]}
                      hitSlop={8}
                      accessibilityLabel="Remove Proof Attachment"
                    >
                      <AppIcon name="trash-outline" size={16} color="#DC2626" />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.proofButtonsRow}>
                  <Pressable
                    onPress={handlePickPhoto}
                    style={({ pressed }) => [styles.proofPickBtn, pressed && { opacity: 0.8 }]}
                    accessibilityLabel="Upload Photo"
                  >
                    <View style={[styles.proofIconCircle, { backgroundColor: '#EFF6FF' }]}>
                      <AppIcon name="camera-outline" size={17} color={Colors.primary} />
                    </View>
                    <Text style={styles.proofPickText}>Upload Photo</Text>
                  </Pressable>

                  <Pressable
                    onPress={handlePickPdf}
                    style={({ pressed }) => [styles.proofPickBtn, pressed && { opacity: 0.8 }]}
                    accessibilityLabel="Upload PDF"
                  >
                    <View style={[styles.proofIconCircle, { backgroundColor: '#FEF2F2' }]}>
                      <AppIcon name="document-text-outline" size={17} color="#DC2626" />
                    </View>
                    <Text style={styles.proofPickText}>Upload PDF</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {/* Delete Entry (Edit Mode Only) */}
          {isEdit && onDelete && entry?.id ? (
            <View style={styles.dangerCard}>
              {!confirmDelete ? (
                <Pressable onPress={() => setConfirmDelete(true)} style={styles.dangerBtn}>
                  <AppIcon name="trash-outline" size={16} color={Colors.danger} />
                  <Text style={styles.dangerBtnText}>Delete Entry</Text>
                </Pressable>
              ) : (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>Delete this entry permanently?</Text>
                  <View style={styles.confirmActions}>
                    <Pressable
                      onPress={() => setConfirmDelete(false)}
                      style={styles.confirmCancel}
                    >
                      <Text style={styles.confirmCancelText}>Keep</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDelete(entry.id)}
                      style={styles.confirmDel}
                    >
                      <Text style={styles.confirmDelText}>Yes, Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Uniform Full-Width 50/50 Cancel + Save Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.footerCancelBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.footerCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.footerSaveBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.footerSaveText}>
              {isEdit ? 'Update Entry' : isGave ? 'Save Given' : 'Save Received'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Calendar Picker */}
      <CalendarPickerModal
        visible={calendarOpen}
        title="Select Entry Date"
        selectedDate={dmyToYmd(date) || today()}
        onSelect={(picked) => {
          if (picked) {
            setDate(ymdToDmy(picked));
          }
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />

      {/* Fullscreen Image Proof Viewer */}
      <BillImageViewerModal
        visible={viewerOpen}
        imageUrl={proofDataUrl}
        title={proofName || 'Payment Proof'}
        date={date}
        party={party.name}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
    gap: 12,
  },

  /* Single Clean Unified Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' } as any,
      default: { elevation: 1 },
    }),
  },
  fieldGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  req: {
    color: Colors.danger,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  dateSelectBox: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    width: '100%',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  dateValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingVertical: 10,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  calendarIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Crisp Compact Amount Input */
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
  },
  rupeePrefix: {
    fontSize: 22,
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    paddingVertical: 6,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },

  /* Payment Mode */
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },

  /* Quick Notes */
  noteChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  noteChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  noteChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  noteChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  /* Proof Upload (Photo & PDF) */
  proofHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  proofSizeHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  proofButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  proofPickBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  proofIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofPickText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  proofLoadingBox: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  proofAttachedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofThumbWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofImgThumb: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadgeBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    marginTop: -2,
  },
  proofFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  proofMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  proofTypeTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pdfTypeTag: {
    backgroundColor: '#FEE2E2',
  },
  imgTypeTag: {
    backgroundColor: '#DBEAFE',
  },
  proofTypeTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  pdfTypeTagText: {
    color: '#DC2626',
  },
  imgTypeTagText: {
    color: '#2563EB',
  },
  proofAttachedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  proofActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proofViewBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofRemoveBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Danger Card */
  dangerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  dangerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  confirmBox: {
    gap: 8,
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmDel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  confirmDelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Uniform 50/50 Footer */
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  footerSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
