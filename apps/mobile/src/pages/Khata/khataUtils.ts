import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { money } from '../../../../../shared/finance';
import { Row } from '../../types';
import { today } from '../../forms';

const BANK_STORAGE_KEY = 'thekabook_bank_accounts_v1';
const PROFILE_STORAGE_KEY = 'thekabook_contractor_profile_v3';

export async function getPrimaryUpiId(): Promise<string> {
  try {
    let bankStr: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      bankStr = localStorage.getItem(BANK_STORAGE_KEY);
    } else {
      bankStr = await SecureStore.getItemAsync(BANK_STORAGE_KEY);
    }

    if (bankStr) {
      const parsed = JSON.parse(bankStr);
      if (Array.isArray(parsed)) {
        const primary = parsed.find(
          (b: any) => b?.isPrimary && typeof b?.upiId === 'string' && b.upiId.trim().includes('@')
        );
        if (primary) {
          const val = String(primary.upiId).trim();
          if (val.toLowerCase() !== 'contractor@upi') return val;
        }
        const anyValid = parsed.find(
          (b: any) =>
            typeof b?.upiId === 'string' &&
            b.upiId.trim().includes('@') &&
            b.upiId.trim().toLowerCase() !== 'contractor@upi'
        );
        if (anyValid) return String(anyValid.upiId).trim();
      }
    }

    let profStr: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      profStr =
        localStorage.getItem(PROFILE_STORAGE_KEY) ||
        localStorage.getItem('thekabook_contractor_profile_v2');
    } else {
      profStr = await SecureStore.getItemAsync(PROFILE_STORAGE_KEY);
    }

    if (profStr) {
      const prof = JSON.parse(profStr);
      const val = typeof prof?.upiId === 'string' ? prof.upiId.trim() : '';
      if (val && val.includes('@') && val.toLowerCase() !== 'contractor@upi') {
        return val;
      }
    }
  } catch {
    // Gracefully fall back to no UPI ID
  }
  return '';
}

export function getMonthDateRange(monthOffset = 0): {
  from: string;
  to: string;
  label: string;
} {
  const base = new Date(`${today()}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth() + monthOffset;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const label = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return { from: fmt(first), to: fmt(last), label };
}

export type KhataCategory = 'FRIEND' | 'LABOUR' | 'SUPPLIER' | 'CLIENT' | 'OTHER';

export const KHATA_CATEGORIES: { value: KhataCategory; label: string; color: string; bg: string }[] = [
  { value: 'FRIEND', label: 'Friend', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'LABOUR', label: 'Labour', color: '#D97706', bg: '#FEF3C7' },
  { value: 'SUPPLIER', label: 'Supplier', color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'CLIENT', label: 'Client', color: '#059669', bg: '#ECFDF5' },
  { value: 'OTHER', label: 'Other', color: '#475569', bg: '#F1F5F9' },
];

export const KHATA_MODES: { value: 'CASH' | 'UPI' | 'BANK_TRANSFER'; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { value: 'UPI', label: 'UPI', icon: 'phone-portrait-outline' },
  { value: 'BANK_TRANSFER', label: 'Bank', icon: 'business-outline' },
];

export function getCategoryMeta(cat?: string) {
  const upper = String(cat || 'FRIEND').toUpperCase();
  return KHATA_CATEGORIES.find((c) => c.value === upper) || KHATA_CATEGORIES[0];
}

export function getPartyId(entry: Row): string {
  return String(entry.party_id || entry.partyId || '');
}

/** true => GAVE (Maine Diye), false => GOT (Mujhe Mile) */
export function isDebitEntry(entry: Row): boolean {
  if (typeof entry.isDebit === 'boolean') return entry.isDebit;
  if (typeof entry.is_debit === 'boolean') return entry.is_debit;
  return String(entry.type || '').toUpperCase() === 'GAVE';
}

export function getEntryDateStr(entry: Row): string {
  return String(entry.date || today()).slice(0, 10);
}

export function getReminderDateStr(party: Row): string {
  const raw = party.reminder_date || party.reminderDate;
  return raw ? String(raw).slice(0, 10) : '';
}

export function daysBetween(fromYmd: string, toYmd: string = today()): number {
  if (!fromYmd) return 0;
  const a = new Date(`${fromYmd.slice(0, 10)}T00:00:00`);
  const b = new Date(`${toYmd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDaysAgo(dateYmd?: string | null): { label: string; days: number } {
  if (!dateYmd) return { label: 'No entries yet', days: -1 };
  const days = daysBetween(dateYmd, today());
  if (days <= 0) return { label: 'Today', days: 0 };
  if (days === 1) return { label: 'Yesterday', days: 1 };
  if (days < 30) return { label: `${days} days ago`, days };
  const months = Math.floor(days / 30);
  return { label: months === 1 ? '1 month ago' : `${months} months ago`, days };
}

export function formatShortDate(dateYmd?: string | null): string {
  if (!dateYmd) return '';
  const d = new Date(`${String(dateYmd).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateYmd).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Converts YYYY-MM-DD -> DD/MM/YYYY (e.g. 2026-11-18 -> 18/11/2026) */
export function ymdToDmy(ymd?: string | null): string {
  const s = String(ymd || '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Converts DD/MM/YYYY (or DD-MM-YYYY or YYYY-MM-DD) -> YYYY-MM-DD, or null if invalid */
export function dmyToYmd(input?: string | null): string | null {
  const s = String(input || '').trim();
  if (!s) return null;
  let y = 0;
  let mo = 0;
  let d = 0;
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dmy) {
    d = Number(dmy[1]);
    mo = Number(dmy[2]);
    y = Number(dmy[3]);
  } else if (ymd) {
    y = Number(ymd[1]);
    mo = Number(ymd[2]);
    d = Number(ymd[3]);
  } else {
    return null;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const check = new Date(y, mo - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDaysYmd(daysToAdd: number): string {
  const d = new Date(`${today()}T00:00:00`);
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PartySummary {
  party: Row;
  totalGave: number;
  totalGot: number;
  /** Positive => Lene Hain (You'll Get). Negative => Dene Hain (You'll Give). */
  balance: number;
  entryCount: number;
  lastEntryDate: string | null;
  lastActivityTs: number;
  daysSinceLast: number;
  daysLabel: string;
  reminderDate: string;
  isReminderDue: boolean;
}

export function computePartySummary(party: Row, allEntries: Row[]): PartySummary {
  const entries = allEntries.filter((e) => getPartyId(e) === party.id);
  let totalGave = 0;
  let totalGot = 0;
  let lastEntryDate: string | null = null;
  let lastActivityTs = new Date(party.updated_at || party.updatedAt || party.created_at || party.createdAt || Date.now()).getTime();

  for (const e of entries) {
    const amt = Number(e.amount || 0);
    if (isDebitEntry(e)) totalGave += amt;
    else totalGot += amt;

    const dStr = getEntryDateStr(e);
    if (!lastEntryDate || dStr > lastEntryDate) {
      lastEntryDate = dStr;
    }
    const ts = new Date(e.created_at || e.createdAt || `${dStr}T12:00:00`).getTime();
    if (!Number.isNaN(ts) && ts > lastActivityTs) {
      lastActivityTs = ts;
    }
  }

  const balance = totalGave - totalGot;
  const { label: daysLabel, days: daysSinceLast } = formatDaysAgo(lastEntryDate);
  const reminderDate = getReminderDateStr(party);
  const todayStr = today();
  const isReminderDue = Boolean(
    balance > 0 &&
    ((reminderDate && reminderDate <= todayStr) || (!reminderDate && daysSinceLast >= 7))
  );

  return {
    party,
    totalGave,
    totalGot,
    balance,
    entryCount: entries.length,
    lastEntryDate,
    lastActivityTs,
    daysSinceLast,
    daysLabel,
    reminderDate,
    isReminderDue,
  };
}

export function computeKhataTotals(summaries: PartySummary[]) {
  let totalToGet = 0;
  let totalToGive = 0;
  for (const s of summaries) {
    if (s.balance > 0) totalToGet += s.balance;
    else if (s.balance < 0) totalToGive += Math.abs(s.balance);
  }
  return {
    totalToGet,
    totalToGive,
    net: totalToGet - totalToGive,
  };
}

export interface KhataTimelineRow {
  entry: Row;
  runningBalance: number;
}

/**
 * Returns entries sorted newest-first for Khatabook UI, while computing true chronological running balance.
 */
export function buildPartyTimeline(partyId: string, allEntries: Row[]): KhataTimelineRow[] {
  const mine = allEntries
    .filter((e) => getPartyId(e) === partyId)
    .sort((a, b) => {
      const da = getEntryDateStr(a);
      const db = getEntryDateStr(b);
      if (da !== db) return da.localeCompare(db);
      const ta = new Date(a.created_at || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.createdAt || 0).getTime();
      return ta - tb;
    });

  let running = 0;
  const rows: KhataTimelineRow[] = mine.map((entry) => {
    const amt = Number(entry.amount || 0);
    if (isDebitEntry(entry)) running += amt;
    else running -= amt;
    return { entry, runningBalance: running };
  });

  return rows.reverse();
}

export function normalizeIndianPhone(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function buildReminderMessage(
  party: Row,
  balancePaise: number,
  senderName: string,
  lastEntryDate?: string | null,
  upiId?: string
): string {
  const absAmt = money(Math.abs(balancePaise));
  const partyName = String(party.name || '').trim() || 'there';
  const from = senderName?.trim() || 'ThekaBook';

  if (balancePaise > 0) {
    const datePart = lastEntryDate ? ` (Last entry: ${formatShortDate(lastEntryDate)})` : '';
    const upiBlock = upiId ? `\n\nPay via UPI: ${upiId}` : '';
    return `Hello ${partyName},\n\nThis is a gentle payment reminder. An amount of ${absAmt} is pending in your account${datePart}.${upiBlock}\n\nPlease settle it at your earliest convenience.\n\nThank you,\n${from}`;
  }
  if (balancePaise < 0) {
    return `Hello ${partyName},\n\nAccount update: A balance of ${absAmt} is payable from my side. I will settle it soon.\n\nRegards,\n${from}`;
  }
  return `Hello ${partyName},\n\nYour account balance is fully settled (₹0).\n\nRegards,\n${from}`;
}

export async function openWhatsAppReminder(
  party: Row,
  balancePaise: number,
  senderName: string,
  lastEntryDate: string | null,
  onError: (msg: string) => void
) {
  const phone = normalizeIndianPhone(party.phone);
  if (!phone) {
    onError('Add a mobile number for this person to send WhatsApp reminder');
    return;
  }
  const upiId = balancePaise > 0 ? await getPrimaryUpiId() : '';
  const msg = buildReminderMessage(party, balancePaise, senderName, lastEntryDate, upiId);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      onError('WhatsApp is not installed on this device');
      return;
    }
    await Linking.openURL(url);
  } catch {
    onError('Could not open WhatsApp');
  }
}

export async function openSmsReminder(
  party: Row,
  balancePaise: number,
  senderName: string,
  lastEntryDate: string | null,
  onError: (msg: string) => void
) {
  const digits = String(party.phone || '').replace(/\D/g, '');
  if (!digits) {
    onError('Add a mobile number for this person to send SMS reminder');
    return;
  }
  const upiId = balancePaise > 0 ? await getPrimaryUpiId() : '';
  const msg = buildReminderMessage(party, balancePaise, senderName, lastEntryDate, upiId);
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${digits}${sep}body=${encodeURIComponent(msg)}`;
  try {
    if (Platform.OS === 'web') {
      // On desktop browsers, sms: protocol may not have a handler; copy message or try opening
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(msg).catch(() => { });
      }
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
      onError('SMS opens on mobile phone (Reminder text copied to clipboard)');
      return;
    }
    await Linking.openURL(url);
  } catch {
    onError('SMS app is not available on this device');
  }
}

export async function openPhoneCall(party: Row, onError: (msg: string) => void) {
  const digits = String(party.phone || '').replace(/\D/g, '');
  if (!digits) {
    onError('Add a mobile number for this person to call');
    return;
  }
  const url = `tel:${digits}`;
  try {
    await Linking.openURL(url);
  } catch {
    onError('Cannot open dialer on this device');
  }
}

const AVATAR_THEMES = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#ECFDF5', text: '#047857' },
  { bg: '#FEF3C7', text: '#B45309' },
  { bg: '#F5F3FF', text: '#6D28D9' },
  { bg: '#FFF1F2', text: '#BE123C' },
  { bg: '#ECFEFF', text: '#0E7490' },
];

export function getAvatarTheme(name?: string) {
  const s = String(name || 'A');
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return AVATAR_THEMES[sum % AVATAR_THEMES.length];
}
