import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Snapshot } from '../types';
import { money } from '../finance';
import { today } from '../forms';
import {
  computePartySummary,
  daysBetween,
  formatShortDate,
  PartySummary,
} from '../pages/Khata/khataUtils';

export interface NotificationItem {
  id: string;
  type: 'khata' | 'payment' | 'haziri' | 'site' | 'wage' | 'system';
  title: string;
  message: string;
  timeAgo: string;
  read: boolean;
  actionTab?: string;
  targetId?: string;
  amount?: number;
  khataSummary?: PartySummary;
}

export const NOTIFICATIONS_READ_KEY = 'thekabook_read_notifications_v1';

/**
 * Retrieve set of read notification IDs from local device storage
 */
export async function getReadNotificationIds(): Promise<Set<string>> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(NOTIFICATIONS_READ_KEY);
      }
    } else {
      raw = await SecureStore.getItemAsync(NOTIFICATIONS_READ_KEY);
    }
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch { }
  return new Set();
}

/**
 * Persist set of read notification IDs to device storage
 */
export async function saveReadNotificationIds(ids: Set<string> | string[]): Promise<void> {
  try {
    const arr = Array.from(ids);
    const jsonStr = JSON.stringify(arr);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(NOTIFICATIONS_READ_KEY, jsonStr);
      }
    } else {
      await SecureStore.setItemAsync(NOTIFICATIONS_READ_KEY, jsonStr);
    }
  } catch { }
}

function formatEntryTimeAgo(dateStr?: string, todayStr = today()): string {
  if (!dateStr) return 'Recent';
  const cleanDate = String(dateStr).slice(0, 10);
  if (cleanDate === todayStr) return 'Today';
  const diffDays = daysBetween(cleanDate, todayStr);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 7) return `${diffDays}d ago`;
  return formatShortDate(cleanDate);
}

/**
 * Generate contextual notification items from snapshot data
 */
export function generateNotificationItems(
  data?: Snapshot | null,
  readIds: Set<string> = new Set()
): NotificationItem[] {
  const list: NotificationItem[] = [];
  const todayStr = today();

  // 1. Khata Book Due Date Payment Reminders (Due Today or Overdue)
  const khataParties = data?.khataParties ?? [];
  const khataEntries = data?.khataEntries ?? [];
  const dueKhata = khataParties
    .map((p) => computePartySummary(p, khataEntries))
    .filter((s) => s.balance > 0 && s.reminderDate && s.reminderDate <= todayStr)
    .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));

  dueKhata.forEach((s) => {
    const overdueDays = daysBetween(s.reminderDate, todayStr);
    const isDueToday = overdueDays <= 0;
    const id = `khata-due-${s.party.id}-${s.reminderDate}`;
    list.push({
      id,
      type: 'khata',
      title: isDueToday
        ? `Due Today: ${s.party.name} • ${money(s.balance)}`
        : `Overdue (${overdueDays}d): ${s.party.name} • ${money(s.balance)}`,
      message: 'Payment reminder due • Tap to view Khata ledger',
      timeAgo: isDueToday ? 'Today' : formatShortDate(s.reminderDate),
      read: readIds.has(id),
      actionTab: 'khata',
      targetId: s.party.id,
      amount: s.balance,
      khataSummary: s,
    });
  });

  // 2. Recent Client Payments Received
  const recentPayments = (data?.entries || [])
    .filter((e) => e.kind === 'RECEIPT' && !e.is_void)
    .slice(-3)
    .reverse();

  recentPayments.forEach((entry) => {
    const site = data?.sites.find((s) => s.id === entry.site_id);
    const siteName = site?.name || 'Work Site';
    const id = `entry-${entry.id}`;
    list.push({
      id,
      type: 'payment',
      title: `Payment Received: ${money(entry.amount || 0)}`,
      message: `Client payment received for ${siteName}. Added to hisaab ledger.`,
      timeAgo: formatEntryTimeAgo(entry.date, todayStr),
      read: readIds.has(id),
      actionTab: 'ledger',
      targetId: entry.id,
      amount: entry.amount,
    });
  });

  // 3. Recent Wage Payments
  const recentWages = (data?.entries || [])
    .filter((e) => e.kind === 'WAGE_PAYMENT' && !e.is_void)
    .slice(-2)
    .reverse();

  recentWages.forEach((wEntry) => {
    const worker = data?.workers.find((w) => w.id === wEntry.worker_id);
    const workerName = worker?.name || 'Worker';
    const id = `wage-${wEntry.id}`;
    list.push({
      id,
      type: 'wage',
      title: `Wage Paid: ${money(wEntry.amount || 0)}`,
      message: `Payment disbursed to ${workerName}. Balance updated.`,
      timeAgo: formatEntryTimeAgo(wEntry.date, todayStr),
      read: readIds.has(id),
      actionTab: 'team',
      targetId: wEntry.worker_id,
      amount: wEntry.amount,
    });
  });

  // 4. Daily Haziri / Attendance Reminder
  const workerCount = data?.workers?.length || 0;
  const haziriDoneToday = (data?.attendance || []).some(
    (a) => String(a.date || '').slice(0, 10) === todayStr
  );
  const haziriId = `haziri-daily-${todayStr}`;
  list.push({
    id: haziriId,
    type: 'haziri',
    title: 'Daily Haziri Reminder',
    message: haziriDoneToday
      ? `Today's haziri has been marked for active workers.`
      : workerCount > 0
        ? `Don't forget to mark attendance for today's ${workerCount} active workers.`
        : 'Add your team members and mark daily haziri to track attendance.',
    timeAgo: 'Today',
    read: haziriDoneToday || readIds.has(haziriId),
    actionTab: 'attendance',
  });

  // 5. Active Sites Status Alert
  const activeSites = (data?.sites || []).filter((s) => s.status !== 'COMPLETED');
  if (activeSites.length > 0) {
    const firstSite = activeSites[0];
    const siteAlertId = `site-alert-${firstSite.id}`;
    list.push({
      id: siteAlertId,
      type: 'site',
      title: `Site Active: ${firstSite.name}`,
      message: 'Review client progress, material invoices and upcoming contractor margins.',
      timeAgo: 'Active',
      read: readIds.has(siteAlertId) || true,
      actionTab: 'sites',
      targetId: firstSite.id,
    });
  }

  // 6. System & Cloud Sync Notification
  list.push({
    id: 'system-cloud-sync',
    type: 'system',
    title: '100% Cloud Ledger Protected',
    message: 'All your work sites, attendance registers and billing records are securely backed up.',
    timeAgo: 'Secure',
    read: true,
    actionTab: 'profile',
  });

  return list;
}

/**
 * Compute the count of unread notifications
 */
export function getUnreadNotificationCount(
  data?: Snapshot | null,
  readIds: Set<string> = new Set()
): number {
  const items = generateNotificationItems(data, readIds);
  return items.filter((n) => !n.read && !readIds.has(n.id)).length;
}
