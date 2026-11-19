import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Theme & Common Components
import { Colors } from './src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav, TabItem } from './src/components/common/BottomNav';
import { Button } from './src/components/common/Button';
import { FormModal } from './src/ui';
import { ServerConfigModal } from './src/components/common/ServerConfigModal';

// Pages
import { AuthPage } from './src/pages/Auth';
import { DashboardPage } from './src/pages/Dashboard';
import { SitesPage, NewSitePage, EditSitePage } from './src/pages/Sites';
import { AttendancePage, BulkAttendancePage, MarkAttendancePage } from './src/pages/Attendance';
import { LabourPage, EditWorkerPage } from './src/pages/Labour';
import { HisabPage, VoidEntryPage } from './src/pages/Hisab';
import { ReportsPage } from './src/pages/Reports';
import { ProfilePage } from './src/pages/Profile';
import { NotificationsPage } from './src/pages/Notifications';
import {
  getReadNotificationIds,
  saveReadNotificationIds,
  getUnreadNotificationCount,
} from './src/storage/notificationStorage';
import { SettingsPage } from './src/pages/Settings';
import { BanksPage } from './src/pages/Banks';
import { PaymentsPage } from './src/pages/Payments';
import { KhataPage } from './src/pages/Khata';
import {
  MaterialBillPage,
  WagePaymentPage,
  ReceivePaymentPage,
  ExpenseBillPage,
  ExtraWorkPage,
} from './src/pages/Entries';

// API & Helpers
import { request, commandKey, UserInfo, saveCachedSnapshot, getCachedSnapshot } from './src/api';
import { attendanceForm, entryForm, siteForm, workerForm, voidForm, today } from './src/forms';
import { pdfReport, shareReport } from './src/report';
import { FormSpec, Row, Snapshot } from './src/types';
import { LanguageProvider, useLanguage } from './src/i18n';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider, showToast } from './src/context/ToastContext';
import { AppLoader } from './src/components/common/AppLoader';

function MainApp() {
  const { t, lang } = useLanguage();
  const { isLoggedIn, token, user, ready, setAuth, logout, updateUser } = useAuth();
  const [data, setData] = useState<Snapshot | null>(() => getCachedSnapshot());

  const navTabs: TabItem[] = [
    { key: 'home', label: 'Home', icon: 'home-outline' },
    { key: 'sites', label: 'Sites', icon: 'business-outline' },
    { key: 'ledger', label: 'Hisaab', icon: 'document-text-outline' },
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
  ];

  // Check initial browser path on Web
  const getInitialRouteState = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/entry/material') {
        return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: 'MATERIAL' };
      }
      if (path === '/entry/wage' || path === '/entry/wage-payment') {
        return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: 'WAGE_PAYMENT' };
      }
      if (path === '/entry/receipt' || path === '/entry/payment-in') {
        return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: 'RECEIPT' };
      }
      if (path === '/entry/expense') {
        return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: 'EXPENSE' };
      }
      if (path === '/entry/extra') {
        return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: 'EXTRA' };
      }
      if (path === '/attendance/daily' || path === '/daily-attendance' || path === '/haziri') {
        return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: 'BULK_ATTENDANCE' };
      }
      if (path === '/sites/new') {
        return { tab: 'sites', selectedSiteId: null, selectedWorkerId: null, isNewSite: true, activeEntryKind: null };
      }
      if (path.startsWith('/sites/') && path.length > 7) {
        return { tab: 'sites', selectedSiteId: path.replace('/sites/', ''), selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/sites') {
        return { tab: 'sites', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/attendance') {
        return { tab: 'attendance', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path.startsWith('/team/') && path.length > 6) {
        return { tab: 'team', selectedSiteId: null, selectedWorkerId: path.replace('/team/', ''), isNewSite: false, activeEntryKind: null };
      }
      if (path.startsWith('/labour/') && path.length > 8) {
        return { tab: 'team', selectedSiteId: null, selectedWorkerId: path.replace('/labour/', ''), isNewSite: false, activeEntryKind: null };
      }
      if (path === '/team' || path === '/labour') {
        return { tab: 'team', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/ledger' || path === '/hisab') {
        return { tab: 'ledger', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/reports') {
        return { tab: 'reports', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/payments' || path === '/payment') {
        return { tab: 'payments', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/profile') {
        return { tab: 'profile', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/notifications') {
        return { tab: 'notifications', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/settings') {
        return { tab: 'settings', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path === '/banks') {
        return { tab: 'banks', selectedSiteId: null, selectedWorkerId: null, selectedKhataPartyId: null, isNewSite: false, activeEntryKind: null };
      }
      if (path.startsWith('/khata/') && path.length > 7) {
        return { tab: 'khata', selectedSiteId: null, selectedWorkerId: null, selectedKhataPartyId: path.replace('/khata/', ''), isNewSite: false, activeEntryKind: null };
      }
      if (path === '/khata') {
        return { tab: 'khata', selectedSiteId: null, selectedWorkerId: null, selectedKhataPartyId: null, isNewSite: false, activeEntryKind: null };
      }
    }
    return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, selectedKhataPartyId: null, isNewSite: false, activeEntryKind: null };
  };

  const initialRoute = useRef(getInitialRouteState()).current;
  const [tab, setTab] = useState(initialRoute.tab);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(initialRoute.selectedSiteId);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialRoute.selectedWorkerId);
  const [selectedKhataPartyId, setSelectedKhataPartyId] = useState<string | null>(
    (initialRoute as any).selectedKhataPartyId || null
  );
  const [isNewSite, setIsNewSite] = useState<boolean>(initialRoute.isNewSite);
  const [activeEntryKind, setActiveEntryKind] = useState<string | null>(initialRoute.activeEntryKind);
  const [activeEntryParams, setActiveEntryParams] = useState<{ siteId?: string; workerId?: string; bill?: Row } | null>(null);

  const [form, setForm] = useState<FormSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showFabModal, setShowFabModal] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

  // Load persistent read notification IDs on mount
  useEffect(() => {
    getReadNotificationIds().then((ids) => {
      setReadNotificationIds(ids);
    });
  }, []);

  const unreadNotificationCount = useMemo(() => {
    return getUnreadNotificationCount(data, readNotificationIds);
  }, [data, readNotificationIds]);
  const pendingRef = useRef<{ signature: string; key: string } | null>(null);
  const inFlightCommandsRef = useRef(0);
  const mutationSeqRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = 'light';
      document.documentElement.style.backgroundColor = '#F4F6F9';
      if (document.body) {
        document.body.style.backgroundColor = '#F4F6F9';
        document.body.style.color = '#0F172A';
      }
      let styleEl = document.getElementById('thekabook-web-light-styles');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'thekabook-web-light-styles';
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        html, body, #root {
          background-color: #F4F6F9 !important;
          color: #0F172A !important;
          color-scheme: light !important;
        }
        input, textarea, select {
          background-color: transparent !important;
          color: #0F172A !important;
          color-scheme: light !important;
        }
        input::placeholder, textarea::placeholder {
          color: #94A3B8 !important;
        }
      `;
    }
  }, []);

  async function refresh(t = token, silent = false) {
    if (!t) return;
    if (!silent) setRefreshing(true);
    const startSeq = mutationSeqRef.current;
    try {
      const snap = await request('/snapshot', t);
      // Never overwrite newer optimistic edits if a mutation occurred while /snapshot was in-flight
      if (mutationSeqRef.current === startSeq) {
        setData(snap);
        saveCachedSnapshot(snap);
        if (snap?.user || snap?.organization) {
          updateUser({
            name: snap.user?.name || user?.name || '',
            organizationName: snap.organization?.name || user?.organizationName || '',
            avatar: snap.user?.avatar || user?.avatar || '',
            phone: snap.user?.phone || user?.phone || '',
          });
        }
      }
      setError('');
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401) {
        await logout();
        setData(null);
        saveCachedSnapshot(null);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  function scheduleSilentRefresh(t = token) {
    if (!t) return;
    if (inFlightCommandsRef.current === 0) {
      refresh(t, true);
    }
  }

  function mergeAttendanceList(prevList: Row[], incoming: Row[]): Row[] {
    let next = [...prevList];
    for (const rec of incoming) {
      if (!rec) continue;
      const recDate = String(rec.date || '').slice(0, 10);
      const recSite = rec.site_id || rec.siteId;
      const recWorker = rec.worker_id || rec.workerId;
      const matchIdx = next.findIndex(
        (a) =>
          (rec.id && a.id === rec.id) ||
          ((a.site_id || a.siteId) === recSite &&
            (a.worker_id || a.workerId) === recWorker &&
            String(a.date || '').slice(0, 10) === recDate)
      );
      if (matchIdx >= 0) {
        next[matchIdx] = { ...next[matchIdx], ...rec };
      } else {
        next = [rec, ...next];
      }
    }
    return next;
  }

  function handleBulkAttendanceSaved(records: Row[]) {
    mutationSeqRef.current += 1;
    setData((prev) => {
      if (!prev) return prev;
      const nextSnap: Snapshot = {
        ...prev,
        attendance: mergeAttendanceList(prev.attendance, records),
      };
      saveCachedSnapshot(nextSnap);
      return nextSnap;
    });
    scheduleSilentRefresh(token);
  }

  // Fetch snapshot data in the background as soon as token is ready
  useEffect(() => {
    if (token) {
      // If we already have cached data, refresh SILENTLY (no spinner blocking UI)
      // If no data yet, show refresh spinner
      refresh(token, Boolean(data));
    }
  }, [token]);

  async function handleLogin(newToken: string, newUser?: UserInfo) {
    await setAuth(newToken, newUser || null);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setData(null);
      saveCachedSnapshot(null);
      setSelectedSiteId(null);
      setIsNewSite(false);
      setTab('home');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.pushState(null, '', '/');
      }
    }
  }

  function getReturnUrl() {
    if (selectedSiteId) return `/sites/${selectedSiteId}`;
    if (selectedWorkerId) return `/team/${selectedWorkerId}`;
    if (tab === 'home') return '/';
    return `/${tab}`;
  }

  function openForm(spec: FormSpec) {
    pendingRef.current = null;
    setError('');
    setForm(spec);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      let targetUrl = '';
      if (spec.action === 'site.update') {
        targetUrl = spec.entity_id ? `/sites/${spec.entity_id}/edit` : '/sites/edit';
      } else if (spec.action === 'site.create') {
        targetUrl = '/sites/new';
      } else if (spec.action === 'worker.create') {
        targetUrl = '/team/new';
      } else if (spec.action === 'worker.update') {
        targetUrl = spec.entity_id ? `/team/${spec.entity_id}/edit` : '/team/edit';
      } else if (spec.action === 'attendance.save') {
        targetUrl = '/attendance/mark';
      } else if (spec.action === 'entry.void') {
        targetUrl = '/ledger/void';
      }
      if (targetUrl && window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  }

  function closeForm() {
    setForm(null);
    setError('');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const backUrl = getReturnUrl();
      if (window.location.pathname !== backUrl) {
        window.history.pushState(null, '', backUrl);
      }
    }
  }

  async function handleSaveForm(values: Record<string, string>) {
    if (!form) return;
    const currentForm = form;
    const prevSnapshot = data;
    const transformedData = currentForm.transform(values);
    const clientEntityId = currentForm.entity_id || commandKey();
    const requestKey = commandKey();
    const body = {
      action: currentForm.action,
      ...(currentForm.action !== 'attendance.save' || currentForm.entity_id
        ? { entity_id: clientEntityId }
        : {}),
      data: transformedData,
    };

    // 1. Smart, context-aware success message
    let successMsg = lang === 'hi' ? 'सफलतापूर्वक सुरक्षित हो गया' : 'Saved successfully';
    if (currentForm.action === 'attendance.save') {
      const isUpdate = Boolean(currentForm.entity_id) || currentForm.title.toLowerCase().includes('correct');
      const recordDate = String(transformedData?.date || '').slice(0, 10);
      const todayStr = today();
      const isPastDate = Boolean(recordDate && recordDate < todayStr);
      if (isUpdate) {
        successMsg = lang === 'hi' ? 'हाजिरी सफलतापूर्वक अपडेट हो गई' : 'Attendance updated successfully';
      } else if (isPastDate) {
        successMsg = lang === 'hi' ? 'पिछली तारीख की हाजिरी दर्ज हो गई' : 'Past date attendance marked successfully';
      } else {
        successMsg = lang === 'hi' ? 'हाजिरी सफलतापूर्वक दर्ज हो गई' : 'Attendance marked successfully';
      }
    } else if (currentForm.action === 'site.create') {
      successMsg = lang === 'hi' ? 'साइट सफलतापूर्वक बन गई' : 'Site created successfully';
    } else if (currentForm.action === 'site.update') {
      successMsg = lang === 'hi' ? 'साइट अपडेट हो गई' : 'Site updated successfully';
    } else if (currentForm.action === 'worker.create') {
      successMsg = lang === 'hi' ? 'मजदूर सफलतापूर्वक जुड़ गया' : 'Worker added successfully';
    } else if (currentForm.action === 'worker.update') {
      successMsg = lang === 'hi' ? 'मजदूर जानकारी अपडेट हो गई' : 'Worker updated successfully';
    } else if (currentForm.action === 'entry.void') {
      successMsg = lang === 'hi' ? 'एंट्री रद्द कर दी गई' : 'Entry voided successfully';
    }

    // 2. Apply instant optimistic UI update & return to previous page immediately (0ms wait!)
    mutationSeqRef.current += 1;
    const mySeq = mutationSeqRef.current;
    closeForm();
    pendingRef.current = null;
    showToast(successMsg, 's');

    setData((prev) => {
      if (!prev) return prev;
      let nextSnap: Snapshot = prev;

      if (currentForm.action.startsWith('site.')) {
        const pricing = transformedData.pricing || 'FIXED';
        const qty = Number(transformedData.quantity || 1);
        const unitRate = Number(transformedData.unit_rate || 0);
        const contractAmt = pricing !== 'FIXED' ? Math.round(qty * unitRate) : Number(transformedData.contract_amount || 0);
        const optimisticSite: Row = {
          ...transformedData,
          id: clientEntityId,
          org_id: prev.organization?.id,
          orgId: prev.organization?.id,
          name: String(transformedData.name || '').trim(),
          owner_name: String(transformedData.owner_name || '').trim(),
          ownerName: String(transformedData.owner_name || '').trim(),
          work_type: transformedData.work_type || 'LABOUR',
          workType: transformedData.work_type || 'LABOUR',
          contract_amount: contractAmt,
          contractAmount: contractAmt,
          quantity: qty,
          unit_rate: unitRate,
          unitRate,
          remaining_estimate:
            transformedData.status === 'COMPLETED'
              ? 0
              : Number(transformedData.remaining_estimate ?? contractAmt),
          remainingEstimate:
            transformedData.status === 'COMPLETED'
              ? 0
              : Number(transformedData.remaining_estimate ?? contractAmt),
          start_date: String(transformedData.start_date || today()).slice(0, 10),
          end_date: transformedData.end_date ? String(transformedData.end_date).slice(0, 10) : null,
          status: transformedData.status || 'ONGOING',
        };
        const exists = prev.sites.some((s) => s.id === clientEntityId);
        const sites = exists
          ? prev.sites.map((s) => (s.id === clientEntityId ? { ...s, ...optimisticSite } : s))
          : [optimisticSite, ...prev.sites];
        nextSnap = { ...prev, sites };
      } else if (currentForm.action.startsWith('worker.')) {
        const optimisticWorker: Row = {
          ...transformedData,
          id: clientEntityId,
          org_id: prev.organization?.id,
          orgId: prev.organization?.id,
          name: String(transformedData.name || '').trim(),
          phone: transformedData.phone || '',
          skill: String(transformedData.skill || '').trim(),
          daily_rate: Number(transformedData.daily_rate ?? 0),
          dailyRate: Number(transformedData.daily_rate ?? 0),
          overtime_rate: Number(transformedData.overtime_rate ?? 0),
          overtimeRate: Number(transformedData.overtime_rate ?? 0),
          photo: transformedData.photo || '',
          active: transformedData.active !== undefined ? Boolean(transformedData.active) : true,
        };
        const exists = prev.workers.some((w) => w.id === clientEntityId);
        const workers = exists
          ? prev.workers.map((w) => (w.id === clientEntityId ? { ...w, ...optimisticWorker } : w))
          : [...prev.workers, optimisticWorker];
        nextSnap = { ...prev, workers };
      } else if (currentForm.action === 'attendance.save') {
        const attDate = String(transformedData.date || today()).slice(0, 10);
        const existingAtt = prev.attendance.find(
          (a) =>
            (currentForm.entity_id && a.id === currentForm.entity_id) ||
            (a.site_id === transformedData.site_id &&
              a.worker_id === transformedData.worker_id &&
              String(a.date || '').slice(0, 10) === attDate)
        );
        const workerObj = prev.workers.find((w) => w.id === transformedData.worker_id);
        const dailyRate = Number(existingAtt?.daily_rate ?? workerObj?.daily_rate ?? 0);
        const otRate = Number(existingAtt?.overtime_rate ?? workerObj?.overtime_rate ?? 0);
        const unitsNum = Number(transformedData.units ?? 0);
        const otMins = Number(transformedData.overtime_minutes ?? 0);
        const calcAmount = Math.round(unitsNum * dailyRate) + Math.round((otMins * otRate) / 60);
        const optimisticAtt: Row = {
          ...(existingAtt || {}),
          id: existingAtt?.id || clientEntityId,
          org_id: prev.organization?.id,
          site_id: transformedData.site_id,
          siteId: transformedData.site_id,
          worker_id: transformedData.worker_id,
          workerId: transformedData.worker_id,
          date: attDate,
          units: unitsNum,
          overtime_minutes: otMins,
          overtimeMinutes: otMins,
          daily_rate: dailyRate,
          dailyRate,
          overtime_rate: otRate,
          overtimeRate: otRate,
          amount: calcAmount,
          notes: transformedData.notes || '',
        };
        nextSnap = {
          ...prev,
          attendance: mergeAttendanceList(prev.attendance, [optimisticAtt]),
        };
      } else if (currentForm.action === 'entry.void') {
        const nowIso = new Date().toISOString();
        const entries = prev.entries.map((e) =>
          e.id === clientEntityId
            ? {
              ...e,
              voided_at: nowIso,
              voidedAt: nowIso,
              void_reason: transformedData?.reason || 'Voided by user',
              voidReason: transformedData?.reason || 'Voided by user',
            }
            : e
        );
        nextSnap = { ...prev, entries };
      }

      saveCachedSnapshot(nextSnap);
      return nextSnap;
    });

    // 3. Persist to backend in background with authoritative reconciliation & safe rollback
    inFlightCommandsRef.current += 1;
    try {
      const res = await request('/commands', token, {
        ...body,
        key: requestKey,
      });

      if (res?.record) {
        setData((prev) => {
          if (!prev) return prev;
          let nextSnap: Snapshot = prev;
          if (currentForm.action.startsWith('site.')) {
            const exists = prev.sites.some((s) => s.id === res.record.id);
            const sites = exists
              ? prev.sites.map((s) => (s.id === res.record.id ? { ...s, ...res.record } : s))
              : [res.record, ...prev.sites];
            nextSnap = { ...prev, sites };
          } else if (currentForm.action.startsWith('worker.')) {
            const exists = prev.workers.some((w) => w.id === res.record.id);
            const workers = exists
              ? prev.workers.map((w) => (w.id === res.record.id ? { ...w, ...res.record } : w))
              : [...prev.workers, res.record];
            nextSnap = { ...prev, workers };
          } else if (currentForm.action === 'attendance.save') {
            nextSnap = {
              ...prev,
              attendance: mergeAttendanceList(prev.attendance, [res.record]),
            };
          } else if (currentForm.action === 'entry.void') {
            const entries = prev.entries.map((e) =>
              e.id === res.record.id ? { ...e, ...res.record } : e
            );
            nextSnap = { ...prev, entries };
          }
          saveCachedSnapshot(nextSnap);
          return nextSnap;
        });
      }
    } catch (e: any) {
      // Revert optimistic state cleanly and notify user
      if (mutationSeqRef.current === mySeq && prevSnapshot) {
        setData(prevSnapshot);
        saveCachedSnapshot(prevSnapshot);
      } else {
        refresh(token, true);
      }
      const errMsg = e?.message || 'Could not save changes';
      setError(errMsg);
      showToast(errMsg, 'e');
    } finally {
      inFlightCommandsRef.current = Math.max(0, inFlightCommandsRef.current - 1);
      scheduleSilentRefresh(token);
    }
  }

  async function handleUpdateProfile(values: { name?: string; organization_name?: string }) {
    const prevSnapshot = data;
    mutationSeqRef.current += 1;
    const mySeq = mutationSeqRef.current;

    // 1. Instant optimistic profile update
    setData((prev) => {
      if (!prev) return prev;
      const nextSnap: Snapshot = {
        ...prev,
        user: {
          ...prev.user,
          name: values.name ? values.name.trim() : prev.user.name,
        },
        organization: {
          ...prev.organization,
          name: values.organization_name ? values.organization_name.trim() : prev.organization.name,
        },
      };
      saveCachedSnapshot(nextSnap);
      return nextSnap;
    });
    updateUser({
      name: values.name ? values.name.trim() : user?.name || '',
      organizationName: values.organization_name
        ? values.organization_name.trim()
        : user?.organizationName || '',
    });

    // 2. Sync to backend in background without blocking Profile Save button
    inFlightCommandsRef.current += 1;
    request('/commands', token, {
      action: 'profile.update',
      data: values,
      key: commandKey(),
    })
      .catch((e: any) => {
        if (mutationSeqRef.current === mySeq && prevSnapshot) {
          setData(prevSnapshot);
          saveCachedSnapshot(prevSnapshot);
        } else {
          refresh(token, true);
        }
        const errMsg = e?.message || 'Failed to update profile';
        setError(errMsg);
        showToast(errMsg, 'e');
      })
      .finally(() => {
        inFlightCommandsRef.current = Math.max(0, inFlightCommandsRef.current - 1);
        scheduleSilentRefresh(token);
      });
  }

  const tabHistoryRef = useRef<string[]>(['home']);
  const lastBackPressRef = useRef<number>(0);

  function navigate(
    newTab: string,
    urlPath?: string,
    siteId: string | null = null,
    newSite = false,
    workerId: string | null = null,
    entryKind: string | null = null
  ) {
    if (newTab !== tab) {
      tabHistoryRef.current = [...tabHistoryRef.current.filter((t) => t !== newTab), newTab];
    }
    setTab(newTab);
    setSelectedSiteId(siteId);
    setSelectedWorkerId(workerId);
    if (newTab !== 'khata') setSelectedKhataPartyId(null);
    setIsNewSite(newSite);
    setActiveEntryKind(entryKind);
    if (!entryKind) setActiveEntryParams(null);
    setError('');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const targetUrl =
        urlPath ||
        (newSite
          ? '/sites/new'
          : siteId
            ? `/sites/${siteId}`
            : workerId
              ? `/team/${workerId}`
              : entryKind === 'MATERIAL'
                ? '/entry/material'
                : entryKind === 'WAGE_PAYMENT'
                  ? '/entry/wage'
                  : entryKind === 'RECEIPT'
                    ? '/entry/receipt'
                    : entryKind === 'EXPENSE'
                      ? '/entry/expense'
                      : entryKind === 'EXTRA'
                        ? '/entry/extra'
                        : entryKind === 'BULK_ATTENDANCE'
                          ? '/attendance/daily'
                          : newTab === 'home'
                            ? '/'
                            : `/${newTab}`);
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  }

  // Handle hardware / Android system back button gracefully
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onHardwareBackPress = () => {
      // 1. If any form page is open, close it
      if (form) {
        closeForm();
        return true;
      }

      // 1b. If viewing an entry page, go back to overview
      if (activeEntryKind) {
        setActiveEntryKind(null);
        setActiveEntryParams(null);
        navigate('home', '/', null, false, null, null);
        return true;
      }

      // 2. If creating new site, go back to sites list
      if (isNewSite) {
        setIsNewSite(false);
        setSelectedSiteId(null);
        setSelectedWorkerId(null);
        setActiveEntryKind(null);
        setTab('sites');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.pushState(null, '', '/sites');
        }
        return true;
      }

      // 3. If viewing a specific site detail, go back to sites list
      if (selectedSiteId) {
        setSelectedSiteId(null);
        setActiveEntryKind(null);
        setTab('sites');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.pushState(null, '', '/sites');
        }
        return true;
      }

      // 3b. If viewing a specific worker detail in labour/team, go back to labour list
      if (tab === 'team' && selectedWorkerId) {
        setSelectedWorkerId(null);
        setActiveEntryKind(null);
        setTab('team');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.pushState(null, '', '/team');
        }
        return true;
      }

      // 3c. If viewing a specific Udhaar Khata party, go back to Khata list
      if (tab === 'khata' && selectedKhataPartyId) {
        setSelectedKhataPartyId(null);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.pushState(null, '', '/khata');
        }
        return true;
      }

      // 4. If in profile screen, go back to home tab
      if (tab === 'profile') {
        navigate('home', '/', null, false, null, null);
        return true;
      }

      // 5. If on another tab, go back to previous tab or home
      if (tab !== 'home') {
        const prevStack = tabHistoryRef.current.filter((t) => t !== tab);
        const prevTab = prevStack.length > 0 ? prevStack[prevStack.length - 1] : 'home';
        tabHistoryRef.current = prevStack.length > 0 ? prevStack : ['home'];
        navigate(prevTab, prevTab === 'home' ? '/' : `/${prevTab}`, null, false, null, null);
        return true;
      }

      // 6. If already on Home (Overview) with nothing open -> Double back to exit
      const now = Date.now();
      if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      const exitMsg = 'Press back again to exit app';

      if (Platform.OS === 'android') {
        ToastAndroid.show(exitMsg, ToastAndroid.SHORT);
      } else {
        showToast(exitMsg, 'w');
      }
      return true;
    };

    const backSub = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );
    return () => backSub.remove();
  }, [form, isNewSite, selectedSiteId, selectedWorkerId, selectedKhataPartyId, activeEntryKind, tab, lang]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onPopState = () => {
        const path = window.location.pathname;
        setForm(null);
        if (path === '/sites/new') {
          setTab('sites');
          setIsNewSite(true);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/entry/material') {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind('MATERIAL');
        } else if (path === '/entry/wage' || path === '/entry/wage-payment') {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind('WAGE_PAYMENT');
        } else if (path === '/entry/receipt' || path === '/entry/payment-in') {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind('RECEIPT');
        } else if (path === '/entry/expense') {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind('EXPENSE');
        } else if (path === '/entry/extra') {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind('EXTRA');
        } else if (path.startsWith('/sites/') && path.length > 7) {
          setTab('sites');
          setIsNewSite(false);
          setSelectedSiteId(path.replace('/sites/', ''));
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/sites') {
          setTab('sites');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/attendance/daily' || path === '/daily-attendance' || path === '/haziri') {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind('BULK_ATTENDANCE');
        } else if (path === '/attendance') {
          setTab('attendance');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/payments' || path === '/payment') {
          setTab('payments');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path.startsWith('/team/') && path.length > 6) {
          setTab('team');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(path.replace('/team/', ''));
          setActiveEntryKind(null);
        } else if (path.startsWith('/labour/') && path.length > 8) {
          setTab('team');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(path.replace('/labour/', ''));
          setActiveEntryKind(null);
        } else if (path === '/team' || path === '/labour') {
          setTab('team');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/ledger' || path === '/hisab') {
          setTab('ledger');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/reports') {
          setTab('reports');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        } else if (path === '/profile') {
          setTab('profile');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setSelectedKhataPartyId(null);
          setActiveEntryKind(null);
        } else if (path.startsWith('/khata/') && path.length > 7) {
          setTab('khata');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setSelectedKhataPartyId(path.replace('/khata/', ''));
          setActiveEntryKind(null);
        } else if (path === '/khata') {
          setTab('khata');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setSelectedKhataPartyId(null);
          setActiveEntryKind(null);
        } else {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setSelectedKhataPartyId(null);
          setActiveEntryKind(null);
        }
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, []);

  function handleNavigate(targetTab: string, targetId?: string) {
    let actualTab = targetTab;
    if (targetTab === 'workers' || targetTab === 'labour') {
      actualTab = 'team';
    } else if (targetTab === 'hisab') {
      actualTab = 'ledger';
    }
    if (actualTab === 'khata') {
      setSelectedKhataPartyId(targetId || null);
    }
    const siteId = actualTab === 'sites' ? (targetId || null) : null;
    const workerId = actualTab === 'team' ? (targetId || null) : null;
    navigate(
      actualTab,
      actualTab === 'home' ? '/' : actualTab === 'khata' && targetId ? `/khata/${targetId}` : `/${actualTab}`,
      siteId,
      false,
      workerId
    );
  }

  async function handleCreateNewSite(values: Record<string, string>) {
    const prevSnapshot = data;
    const spec = siteForm();
    const entityId = commandKey();
    const transformedData = spec.transform(values);
    const requestKey = commandKey();
    const body = {
      action: spec.action,
      entity_id: entityId,
      data: transformedData,
    };

    // 1. Instant optimistic site creation & immediate navigation (0ms wait!)
    mutationSeqRef.current += 1;
    const mySeq = mutationSeqRef.current;
    setError('');
    pendingRef.current = null;
    showToast('New site created successfully', 's');

    setData((prev) => {
      if (!prev) return prev;
      const pricing = transformedData.pricing || 'FIXED';
      const qty = Number(transformedData.quantity || 1);
      const unitRate = Number(transformedData.unit_rate || 0);
      const contractAmt =
        pricing !== 'FIXED' ? Math.round(qty * unitRate) : Number(transformedData.contract_amount || 0);
      const optimisticSite: Row = {
        ...transformedData,
        id: entityId,
        org_id: prev.organization?.id,
        orgId: prev.organization?.id,
        name: String(transformedData.name || '').trim(),
        owner_name: String(transformedData.owner_name || '').trim(),
        ownerName: String(transformedData.owner_name || '').trim(),
        work_type: transformedData.work_type || 'LABOUR',
        workType: transformedData.work_type || 'LABOUR',
        contract_amount: contractAmt,
        contractAmount: contractAmt,
        quantity: qty,
        unit_rate: unitRate,
        unitRate,
        remaining_estimate:
          transformedData.status === 'COMPLETED'
            ? 0
            : Number(transformedData.remaining_estimate ?? contractAmt),
        remainingEstimate:
          transformedData.status === 'COMPLETED'
            ? 0
            : Number(transformedData.remaining_estimate ?? contractAmt),
        start_date: String(transformedData.start_date || today()).slice(0, 10),
        end_date: transformedData.end_date ? String(transformedData.end_date).slice(0, 10) : null,
        status: transformedData.status || 'ONGOING',
      };
      const nextSnap: Snapshot = {
        ...prev,
        sites: [optimisticSite, ...prev.sites],
      };
      saveCachedSnapshot(nextSnap);
      return nextSnap;
    });

    navigate('sites', '/sites', null, false);

    // 2. Persist in background with rollback on error
    inFlightCommandsRef.current += 1;
    try {
      const res = await request('/commands', token, {
        ...body,
        key: requestKey,
      });
      if (res?.record) {
        setData((prev) => {
          if (!prev) return prev;
          const exists = prev.sites.some((s) => s.id === res.record.id);
          const sites = exists
            ? prev.sites.map((s) => (s.id === res.record.id ? { ...s, ...res.record } : s))
            : [res.record, ...prev.sites];
          const nextSnap: Snapshot = { ...prev, sites };
          saveCachedSnapshot(nextSnap);
          return nextSnap;
        });
      }
    } catch (e: any) {
      if (mutationSeqRef.current === mySeq && prevSnapshot) {
        setData(prevSnapshot);
        saveCachedSnapshot(prevSnapshot);
      } else {
        refresh(token, true);
      }
      const errMsg = e?.message || 'Failed to create site';
      setError(errMsg);
      showToast(errMsg, 'e');
    } finally {
      inFlightCommandsRef.current = Math.max(0, inFlightCommandsRef.current - 1);
      scheduleSilentRefresh(token);
    }
  }

  async function handleShareReport(pdf = false, siteId?: string) {
    if (!data) return;
    try {
      if (pdf) {
        await pdfReport(data, siteId);
      } else {
        const msg = await shareReport(data, siteId);
        showToast(msg, 's');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  const openEntryPage = (
    kind: string,
    siteId?: string,
    workerId?: string,
    bill?: Row
  ) => {
    if (!data?.sites.length) {
      showToast(lang === 'hi' ? 'कृपया पहले एक साइट जोड़ें' : 'Please add a work site first', 'w');
      return;
    }
    if (kind === 'WAGE_PAYMENT' && !data?.workers.length) {
      showToast(lang === 'hi' ? 'कृपया पहले एक मजदूर (Labour) जोड़ें' : 'Please add a worker first', 'w');
      return;
    }
    if (kind === 'RECEIPT' && !siteId && !workerId) {
      navigate('payments', '/payments', null, false, null, null);
      return;
    }
    setActiveEntryParams({ siteId, workerId, bill });
    let url = '/entry/material';
    if (kind === 'WAGE_PAYMENT') url = '/entry/wage';
    else if (kind === 'RECEIPT') url = '/entry/receipt';
    else if (kind === 'EXPENSE') url = '/entry/expense';
    else if (kind === 'EXTRA') url = '/entry/extra';

    navigate('home', url, null, false, null, kind);
  };

  async function handleSaveEntry(
    kind: string,
    values: Record<string, string>,
    siteId?: string,
    workerId?: string,
    bill?: Row
  ) {
    if (!data) return;
    const prevSnapshot = data;
    const spec = entryForm(data, kind, siteId, workerId, bill);
    const entityId = commandKey();
    const transformedData = spec.transform(values);
    const requestKey = commandKey();
    const body = {
      action: spec.action,
      entity_id: entityId,
      data: transformedData,
    };

    // 1. Instant optimistic entry creation & immediate navigation (0ms wait!)
    mutationSeqRef.current += 1;
    const mySeq = mutationSeqRef.current;
    setError('');
    pendingRef.current = null;
    setActiveEntryKind(null);
    setActiveEntryParams(null);
    navigate('home', '/', null, false, null, null);
    showToast(lang === 'hi' ? 'सफलतापूर्वक सुरक्षित हो गया' : 'Saved successfully', 's');

    setData((prev) => {
      if (!prev) return prev;
      const optimisticEntry: Row = {
        ...transformedData,
        id: entityId,
        org_id: prev.organization?.id,
        orgId: prev.organization?.id,
        site_id: transformedData.site_id,
        siteId: transformedData.site_id,
        worker_id: transformedData.worker_id || null,
        workerId: transformedData.worker_id || null,
        linked_entry_id: transformedData.linked_entry_id || null,
        linkedEntryId: transformedData.linked_entry_id || null,
        date: String(transformedData.date || today()).slice(0, 10),
        amount: Number(transformedData.amount || 0),
        description: String(transformedData.description || '').trim(),
        party: transformedData.party || '',
        mode: transformedData.mode || 'CASH',
        reference: transformedData.reference || '',
        quantity: transformedData.quantity != null ? Number(transformedData.quantity) : null,
        unit: transformedData.unit || '',
        voided_at: null,
        voidedAt: null,
        void_reason: null,
        voidReason: null,
      };
      const nextSnap: Snapshot = {
        ...prev,
        entries: [optimisticEntry, ...prev.entries],
      };
      saveCachedSnapshot(nextSnap);
      return nextSnap;
    });

    // 2. Persist in background with authoritative reconciliation & rollback on error
    inFlightCommandsRef.current += 1;
    try {
      const res = await request('/commands', token, {
        ...body,
        key: requestKey,
      });

      if (res?.record) {
        setData((prev) => {
          if (!prev) return prev;
          const exists = prev.entries.some((e) => e.id === res.record.id);
          const entries = exists
            ? prev.entries.map((e) => (e.id === res.record.id ? { ...e, ...res.record } : e))
            : [res.record, ...prev.entries];
          const nextSnap: Snapshot = { ...prev, entries };
          saveCachedSnapshot(nextSnap);
          return nextSnap;
        });
      }
    } catch (e: any) {
      if (mutationSeqRef.current === mySeq && prevSnapshot) {
        setData(prevSnapshot);
        saveCachedSnapshot(prevSnapshot);
      } else {
        refresh(token, true);
      }
      const errMsg = e?.message || 'Failed to save entry';
      setError(errMsg);
      showToast(errMsg, 'e');
    } finally {
      inFlightCommandsRef.current = Math.max(0, inFlightCommandsRef.current - 1);
      scheduleSilentRefresh(token);
    }
  }

  const openEntryModal = (
    kind: string,
    siteId?: string,
    workerId?: string,
    bill?: Row
  ) => {
    openEntryPage(kind, siteId, workerId, bill);
  };

  const openAttendanceModal = (
    siteId?: string,
    workerId?: string,
    existing?: Row
  ) => {
    if (!data?.sites.length || !data?.workers.some((w) => w.active)) {
      showToast('Please add an active worker and site first', 'w');
      return;
    }
    openForm(attendanceForm(data, siteId, workerId, existing));
  };

  function handleKhataCommand(
    action:
      | 'khata.partyCreate'
      | 'khata.partyUpdate'
      | 'khata.partyDelete'
      | 'khata.entryCreate'
      | 'khata.entryUpdate'
      | 'khata.entryDelete',
    payload: Record<string, any>,
    entityId?: string
  ): string {
    const prevSnapshot = data;
    const clientEntityId = entityId || commandKey();
    const requestKey = commandKey();
    const nowIso = new Date().toISOString();

    if (action === 'khata.partyDelete') {
      const hasEntries = (prevSnapshot?.khataEntries ?? []).some(
        (e) => (e.party_id || e.partyId) === clientEntityId
      );
      if (hasEntries) {
        showToast('Cannot delete this person because their ledger has existing entries', 'e');
        return clientEntityId;
      }
    }

    let toastMsg = 'Saved successfully';
    if (action === 'khata.partyCreate') toastMsg = 'Person added to Khata Book';
    else if (action === 'khata.partyUpdate') {
      toastMsg = payload.reminder_date !== undefined && Object.keys(payload).length === 1
        ? payload.reminder_date
          ? 'Collection reminder date set'
          : 'Reminder date cleared'
        : 'Person details updated';
    } else if (action === 'khata.partyDelete') toastMsg = 'Person deleted from Khata Book';
    else if (action === 'khata.entryCreate') {
      toastMsg = payload.isDebit ? 'Amount given saved' : 'Amount received saved';
    } else if (action === 'khata.entryUpdate') toastMsg = 'Entry updated';
    else if (action === 'khata.entryDelete') toastMsg = 'Entry deleted';

    mutationSeqRef.current += 1;
    const mySeq = mutationSeqRef.current;
    showToast(toastMsg, 's');

    // 1. Instant 0ms optimistic update
    setData((prev) => {
      if (!prev) return prev;
      const prevParties = prev.khataParties ?? [];
      const prevEntries = prev.khataEntries ?? [];
      let nextParties = prevParties;
      let nextEntries = prevEntries;

      if (action === 'khata.partyCreate') {
        const optimisticParty: Row = {
          id: clientEntityId,
          org_id: prev.organization?.id,
          orgId: prev.organization?.id,
          name: String(payload.name || '').trim(),
          phone: String(payload.phone || '').trim(),
          photo: String(payload.photo || payload.avatar || '').trim(),
          category: String(payload.category || 'FRIEND').toUpperCase(),
          worker_id: payload.worker_id || null,
          workerId: payload.worker_id || null,
          notes: String(payload.notes || '').trim(),
          reminder_date: payload.reminder_date || null,
          reminderDate: payload.reminder_date || null,
          active: true,
          created_at: nowIso,
          updated_at: nowIso,
        };
        nextParties = [optimisticParty, ...prevParties];
      } else if (action === 'khata.partyUpdate') {
        nextParties = prevParties.map((p) =>
          p.id === clientEntityId
            ? {
              ...p,
              ...payload,
              ...(payload.reminder_date !== undefined
                ? { reminder_date: payload.reminder_date, reminderDate: payload.reminder_date }
                : {}),
              ...(payload.worker_id !== undefined
                ? { worker_id: payload.worker_id, workerId: payload.worker_id }
                : {}),
              updated_at: nowIso,
            }
            : p
        );
      } else if (action === 'khata.partyDelete') {
        nextParties = prevParties.filter((p) => p.id !== clientEntityId);
        nextEntries = prevEntries.filter(
          (e) => (e.party_id || e.partyId) !== clientEntityId
        );
      } else if (action === 'khata.entryCreate') {
        const isDebitVal = Boolean(payload.isDebit ?? payload.is_debit);
        const pUrl = String(payload.proof_url ?? payload.proofUrl ?? '').trim();
        const pName = String(payload.proof_name ?? payload.proofName ?? '').trim();
        const pMime = String(payload.proof_mime ?? payload.proofMime ?? '').trim();
        const optimisticEntry: Row = {
          id: clientEntityId,
          org_id: prev.organization?.id,
          orgId: prev.organization?.id,
          party_id: payload.party_id,
          partyId: payload.party_id,
          isDebit: isDebitVal,
          is_debit: isDebitVal,
          amount: Number(payload.amount || 0),
          date: String(payload.date || today()).slice(0, 10),
          note: String(payload.note || '').trim(),
          mode: String(payload.mode || 'CASH').toUpperCase(),
          proof_url: pUrl,
          proofUrl: pUrl,
          proof_name: pName,
          proofName: pName,
          proof_mime: pMime,
          proofMime: pMime,
          created_at: nowIso,
          updated_at: nowIso,
        };
        nextEntries = [...prevEntries, optimisticEntry];
        nextParties = prevParties.map((p) =>
          p.id === payload.party_id ? { ...p, updated_at: nowIso } : p
        );
      } else if (action === 'khata.entryUpdate') {
        nextEntries = prevEntries.map((e) =>
          e.id === clientEntityId
            ? {
              ...e,
              ...payload,
              ...(payload.isDebit !== undefined
                ? { isDebit: Boolean(payload.isDebit), is_debit: Boolean(payload.isDebit) }
                : {}),
              ...(payload.proof_url !== undefined || payload.proofUrl !== undefined
                ? {
                  proof_url: String(payload.proof_url ?? payload.proofUrl ?? ''),
                  proofUrl: String(payload.proof_url ?? payload.proofUrl ?? ''),
                }
                : {}),
              ...(payload.proof_name !== undefined || payload.proofName !== undefined
                ? {
                  proof_name: String(payload.proof_name ?? payload.proofName ?? ''),
                  proofName: String(payload.proof_name ?? payload.proofName ?? ''),
                }
                : {}),
              ...(payload.proof_mime !== undefined || payload.proofMime !== undefined
                ? {
                  proof_mime: String(payload.proof_mime ?? payload.proofMime ?? ''),
                  proofMime: String(payload.proof_mime ?? payload.proofMime ?? ''),
                }
                : {}),
              updated_at: nowIso,
            }
            : e
        );
      } else if (action === 'khata.entryDelete') {
        nextEntries = prevEntries.filter((e) => e.id !== clientEntityId);
      }

      const nextSnap: Snapshot = {
        ...prev,
        khataParties: nextParties,
        khataEntries: nextEntries,
      };
      saveCachedSnapshot(nextSnap);
      return nextSnap;
    });

    // 2. Persist in background with authoritative reconciliation & clean rollback on error
    inFlightCommandsRef.current += 1;
    request('/commands', token, {
      action,
      entity_id: clientEntityId,
      data: payload,
      key: requestKey,
    })
      .then((res) => {
        if (!res?.record) return;
        setData((prev) => {
          if (!prev) return prev;
          const prevParties = prev.khataParties ?? [];
          const prevEntries = prev.khataEntries ?? [];
          let nextSnap: Snapshot = prev;

          if (action === 'khata.partyCreate' || action === 'khata.partyUpdate') {
            const exists = prevParties.some((p) => p.id === res.record.id);
            const khataParties = exists
              ? prevParties.map((p) => (p.id === res.record.id ? { ...p, ...res.record } : p))
              : [res.record, ...prevParties];
            nextSnap = { ...prev, khataParties };
          } else if (action === 'khata.entryCreate' || action === 'khata.entryUpdate') {
            const exists = prevEntries.some((e) => e.id === res.record.id);
            const khataEntries = exists
              ? prevEntries.map((e) => (e.id === res.record.id ? { ...e, ...res.record } : e))
              : [...prevEntries, res.record];
            nextSnap = { ...prev, khataEntries };
          }
          saveCachedSnapshot(nextSnap);
          return nextSnap;
        });
      })
      .catch((e: any) => {
        if (mutationSeqRef.current === mySeq && prevSnapshot) {
          setData(prevSnapshot);
          saveCachedSnapshot(prevSnapshot);
        } else {
          refresh(token, true);
        }
        const errMsg = e?.message || 'Could not save Khata changes';
        setError(errMsg);
        showToast(errMsg, 'e');
      })
      .finally(() => {
        inFlightCommandsRef.current = Math.max(0, inFlightCommandsRef.current - 1);
        scheduleSilentRefresh(token);
      });

    return clientEntityId;
  }

  if (!ready) {
    return <AppLoader message="ThekaBook" />;
  }

  if (!isLoggedIn || !token) {
    return <AuthPage onLogin={handleLogin} />;
  }



  return (
    <View style={styles.webDesktopWrapper}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {/* Main Screen Content */}
        <View style={styles.content}>
          {form && form.action.startsWith('site.') ? (
            <EditSitePage
              key={form.action + (form.entity_id || '')}
              spec={form}
              busy={busy}
              error={error}
              onBack={closeForm}
              onSave={handleSaveForm}
            />
          ) : form && form.action === 'attendance.save' && data ? (
            <MarkAttendancePage
              key={form.action + (form.entity_id || '')}
              spec={form}
              data={data}
              busy={busy}
              error={error}
              onBack={closeForm}
              onSave={handleSaveForm}
            />
          ) : form && form.action.startsWith('worker.') && data ? (
            <EditWorkerPage
              key={form.action + (form.entity_id || '')}
              data={data}
              worker={form.entity_id ? data.workers.find((w) => w.id === form.entity_id) : undefined}
              busy={busy}
              error={error}
              onBack={closeForm}
              onSave={handleSaveForm}
              onOpenPaymentModal={(wId) => {
                setForm(null);
                openEntryModal('WAGE_PAYMENT', undefined, wId);
              }}
              onOpenAttendanceModal={(wId) => {
                setForm(null);
                openAttendanceModal(undefined, wId);
              }}
            />
          ) : form && form.action === 'entry.void' && data ? (
            <VoidEntryPage
              key={form.action + (form.entity_id || '')}
              spec={form}
              entry={data.entries.find((e) => e.id === form.entity_id)}
              site={data.sites.find((s) => s.id === data.entries.find((e) => e.id === form.entity_id)?.site_id)}
              worker={data.workers.find((w) => w.id === data.entries.find((e) => e.id === form.entity_id)?.worker_id)}
              busy={busy}
              error={error}
              onBack={closeForm}
              onSave={handleSaveForm}
            />
          ) : tab === 'home' && !activeEntryKind && !isNewSite ? (
            <DashboardPage
              data={data}
              refreshing={refreshing}
              onRefresh={() => refresh()}
              onNavigateTab={handleNavigate}
              onOpenEntry={(kind, siteId, workerId) => openEntryPage(kind, siteId, workerId)}
              onSelectSite={(siteId) => navigate('sites', `/sites/${siteId}`, siteId, false)}
              onOpenNewSite={() => navigate('sites', '/sites/new', null, true)}
              onOpenAttendance={(siteId) => openAttendanceModal(siteId)}
              onShareReport={() => handleShareReport(true)}
              onOpenProfile={() => handleNavigate('profile')}
              onOpenNotifications={() => navigate('notifications', '/notifications', null, false)}
              unreadNotificationCount={unreadNotificationCount}
              onLogout={handleLogout}
              onShowToast={(msg, type) => showToast(msg, type as any)}
            />
          ) : !data ? (
            <View style={styles.loadingContainer}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Connection Error</Text>
                  <Text style={styles.errorDesc}>{error}</Text>
                  <Button
                    title="Retry Connection"
                    onPress={() => refresh()}
                    style={{ marginTop: 12 }}
                  />
                  <Button
                    title="Back to Home"
                    variant="secondary"
                    onPress={() => navigate('home', '/', null, false, null, null)}
                    style={{ marginTop: 8 }}
                  />
                </View>
              ) : (
                <AppLoader message="Opening data..." />
              )}
            </View>
          ) : isNewSite ? (
            <NewSitePage
              data={data}
              busy={busy}
              error={error}
              onBack={() => navigate('sites', '/sites', null, false)}
              onSave={handleCreateNewSite}
            />
          ) : activeEntryKind === 'MATERIAL' && data ? (
            <MaterialBillPage
              data={data}
              busy={busy}
              error={error}
              siteId={activeEntryParams?.siteId}
              bill={activeEntryParams?.bill}
              onBack={() => navigate('home', '/', null, false, null, null)}
              onSave={(vals) =>
                handleSaveEntry('MATERIAL', vals, activeEntryParams?.siteId, undefined, activeEntryParams?.bill)
              }
              onRefresh={() => refresh()}
              refreshing={refreshing}
              onOpenProfile={() => handleNavigate('profile')}
            />
          ) : activeEntryKind === 'WAGE_PAYMENT' && data ? (
            <WagePaymentPage
              data={data}
              busy={busy}
              error={error}
              siteId={activeEntryParams?.siteId}
              workerId={activeEntryParams?.workerId}
              onBack={() => navigate('home', '/', null, false, null, null)}
              onSave={(vals) =>
                handleSaveEntry('WAGE_PAYMENT', vals, activeEntryParams?.siteId, activeEntryParams?.workerId)
              }
              onRefresh={() => refresh()}
              refreshing={refreshing}
              onOpenProfile={() => handleNavigate('profile')}
            />
          ) : activeEntryKind === 'RECEIPT' && data ? (
            <ReceivePaymentPage
              data={data}
              busy={busy}
              error={error}
              siteId={activeEntryParams?.siteId}
              onBack={() => navigate('home', '/', null, false, null, null)}
              onSave={(vals) =>
                handleSaveEntry('RECEIPT', vals, activeEntryParams?.siteId)
              }
              onRefresh={() => refresh()}
              refreshing={refreshing}
              onOpenProfile={() => handleNavigate('profile')}
            />
          ) : activeEntryKind === 'EXPENSE' && data ? (
            <ExpenseBillPage
              data={data}
              busy={busy}
              error={error}
              siteId={activeEntryParams?.siteId}
              bill={activeEntryParams?.bill}
              onBack={() => navigate('home', '/', null, false, null, null)}
              onSave={(vals) =>
                handleSaveEntry('EXPENSE', vals, activeEntryParams?.siteId, undefined, activeEntryParams?.bill)
              }
              onRefresh={() => refresh()}
              refreshing={refreshing}
              onOpenProfile={() => handleNavigate('profile')}
            />
          ) : activeEntryKind === 'EXTRA' && data ? (
            <ExtraWorkPage
              data={data}
              busy={busy}
              error={error}
              siteId={activeEntryParams?.siteId}
              onBack={() => navigate('home', '/', null, false, null, null)}
              onSave={(vals) =>
                handleSaveEntry('EXTRA', vals, activeEntryParams?.siteId)
              }
              onRefresh={() => refresh()}
              refreshing={refreshing}
              onOpenProfile={() => handleNavigate('profile')}
            />
          ) : activeEntryKind === 'BULK_ATTENDANCE' && data ? (
            <BulkAttendancePage
              data={data}
              initialSiteId={activeEntryParams?.siteId || undefined}
              onBack={() => {
                setActiveEntryKind(null);
                setActiveEntryParams(null);
                navigate('home', '/', null, false, null, null);
              }}
              onRefresh={() => refresh(token, true)}
              onBulkAttendanceSaved={handleBulkAttendanceSaved}
              refreshing={refreshing}
            />
          ) : (
            <>
              {tab === 'sites' && (
                <SitesPage
                  data={data}
                  selectedSiteId={selectedSiteId}
                  onSelectSite={(sId) => navigate('sites', sId ? `/sites/${sId}` : '/sites', sId, false)}
                  onOpenNewSite={() => navigate('sites', '/sites/new', null, true)}
                  onEditSite={(s) => openForm(siteForm(s))}
                  onOpenEntry={openEntryModal}
                  onOpenAttendance={openAttendanceModal}
                  onShareReport={(sId) => handleShareReport(false, sId)}
                  onOpenProfile={() => handleNavigate('profile')}
                  onBack={() => navigate('home', '/', null, false, null, null)}
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                />
              )}

              {tab === 'attendance' && (
                <AttendancePage
                  data={data}
                  onBack={() => navigate('home', '/', null, false, null, null)}
                  onOpenAttendanceModal={openAttendanceModal}
                  onOpenProfile={() => handleNavigate('profile')}
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                  onBulkAttendanceSaved={handleBulkAttendanceSaved}
                />
              )}

              {tab === 'payments' && (
                <PaymentsPage
                  data={data}
                  busy={busy}
                  error={error}
                  onBack={() => navigate('home', '/', null, false, null, null)}
                  onOpenProfile={() => handleNavigate('profile')}
                  onSaveEntry={(kind, vals, sId, wId) =>
                    handleSaveEntry(kind, vals, sId, wId)
                  }
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                />
              )}

              {tab === 'team' && (
                <LabourPage
                  data={data}
                  selectedWorkerId={selectedWorkerId}
                  onSelectWorker={(wId) =>
                    navigate('team', wId ? `/team/${wId}` : '/team', null, false, wId)
                  }
                  onOpenWorkerModal={(w) => openForm(workerForm(w))}
                  onOpenPaymentModal={(wId) =>
                    openEntryModal('WAGE_PAYMENT', undefined, wId)
                  }
                  onOpenProfile={() => handleNavigate('profile')}
                  onBack={() => navigate('home', '/', null, false, null, null)}
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                />
              )}

              {tab === 'ledger' && (
                <HisabPage
                  data={data}
                  onOpenEntry={openEntryModal}
                  onOpenVoidModal={(entry) => openForm(voidForm(entry))}
                  onOpenProfile={() => handleNavigate('profile')}
                  onBack={() => navigate('home', '/', null, false, null, null)}
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                />
              )}

              {tab === 'reports' && (
                <ReportsPage
                  data={data}
                  onGenerateReport={handleShareReport}
                  onOpenProfile={() => handleNavigate('profile')}
                  onBack={() => navigate('home', '/', null, false, null, null)}
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                />
              )}

              {tab === 'profile' && (
                <ProfilePage
                  data={data}
                  onBack={() => navigate('home', '/', null, false)}
                  onUpdateProfile={handleUpdateProfile}
                  onLogout={handleLogout}
                  onRefresh={() => refresh()}
                  refreshing={refreshing}
                />
              )}

              {tab === 'notifications' && (
                <NotificationsPage
                  data={data}
                  onBack={() => navigate('home', '/', null, false)}
                  onNavigateTab={handleNavigate}
                  onRefresh={() => refresh()}
                  refreshing={refreshing}
                  readIds={readNotificationIds}
                  onUpdateReadIds={setReadNotificationIds}
                />
              )}

              {tab === 'settings' && (
                <SettingsPage
                  data={data}
                  onBack={() => navigate('home', '/', null, false)}
                  onNavigateTab={handleNavigate}
                  onOpenProfile={() => handleNavigate('profile')}
                  onLogout={handleLogout}
                  onRefresh={() => refresh()}
                  refreshing={refreshing}
                />
              )}

              {tab === 'banks' && (
                <BanksPage
                  data={data}
                  onBack={() => navigate('home', '/', null, false)}
                  onNavigateTab={handleNavigate}
                  onRefresh={() => refresh()}
                  refreshing={refreshing}
                />
              )}

              {tab === 'khata' && (
                <KhataPage
                  data={data}
                  selectedPartyId={selectedKhataPartyId}
                  onSelectParty={(pId) => {
                    setSelectedKhataPartyId(pId);
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      const url = pId ? `/khata/${pId}` : '/khata';
                      if (window.location.pathname !== url) {
                        window.history.pushState(null, '', url);
                      }
                    }
                  }}
                  onBack={() => navigate('home', '/', null, false)}
                  refreshing={refreshing}
                  onRefresh={() => refresh()}
                  onKhataCommand={handleKhataCommand}
                />
              )}
            </>
          )}
        </View>

        {/* Footer Bottom Navigation with Center Golden Action FAB */}
        {!activeEntryKind && !isNewSite && !form && tab !== 'khata' && (
          <BottomNav
            tabs={navTabs}
            activeTab={tab}
            onTabPress={handleNavigate}
            onCenterPress={() => setShowFabModal(true)}
          />
        )}

        {/* FAB Quick Action Sheet */}
        {showFabModal ? (
          <View style={styles.fabModalBackdrop}>
            <Pressable style={styles.fabModalDismiss} onPress={() => setShowFabModal(false)} />
            <View style={styles.fabSheetContent}>
              <View style={styles.fabSheetHandle} />
              <Text style={styles.fabSheetTitle}>Record Quick Entry</Text>
              <Text style={styles.fabSheetSub}>Choose an action to record for your sites</Text>

              <View style={styles.fabGrid}>
                <Pressable
                  style={styles.fabActionBtn}
                  onPress={() => {
                    setShowFabModal(false);
                    navigate('sites', '/sites/new', null, true);
                  }}
                >
                  <View style={[styles.fabActionIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="business" size={24} color="#1D4ED8" />
                  </View>
                  <Text style={styles.fabActionLabel}>New Site</Text>
                </Pressable>

                <Pressable
                  style={styles.fabActionBtn}
                  onPress={() => {
                    setShowFabModal(false);
                    setActiveEntryKind('BULK_ATTENDANCE');
                    setActiveEntryParams(null);
                    navigate('home', '/attendance/daily', null, false, null, 'BULK_ATTENDANCE');
                  }}
                >
                  <View style={[styles.fabActionIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="calendar" size={24} color="#4338CA" />
                  </View>
                  <Text style={styles.fabActionLabel}>Bulk Attendance</Text>
                </Pressable>

                <Pressable
                  style={styles.fabActionBtn}
                  onPress={() => {
                    setShowFabModal(false);
                    openEntryPage('MATERIAL');
                  }}
                >
                  <View style={[styles.fabActionIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="cube" size={24} color="#D97706" />
                  </View>
                  <Text style={styles.fabActionLabel}>Material Bill</Text>
                </Pressable>

                <Pressable
                  style={styles.fabActionBtn}
                  onPress={() => {
                    setShowFabModal(false);
                    openEntryPage('WAGE_PAYMENT');
                  }}
                >
                  <View style={[styles.fabActionIconBox, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="cash" size={24} color="#059669" />
                  </View>
                  <Text style={styles.fabActionLabel}>Labour Wage</Text>
                </Pressable>

                <Pressable
                  style={styles.fabActionBtn}
                  onPress={() => {
                    setShowFabModal(false);
                    openEntryPage('RECEIPT');
                  }}
                >
                  <View style={[styles.fabActionIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="card" size={24} color="#047857" />
                  </View>
                  <Text style={styles.fabActionLabel}>Payment In</Text>
                </Pressable>

                <Pressable
                  style={styles.fabActionBtn}
                  onPress={() => {
                    setShowFabModal(false);
                    openEntryPage('EXPENSE');
                  }}
                >
                  <View style={[styles.fabActionIconBox, { backgroundColor: '#FFE4E6' }]}>
                    <Ionicons name="receipt" size={24} color="#E11D48" />
                  </View>
                  <Text style={styles.fabActionLabel}>Other Expense</Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.fabCloseBtn}
                onPress={() => setShowFabModal(false)}
              >
                <Text style={styles.fabCloseBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Server Config Modal */}
        <ServerConfigModal
          visible={showServerConfig}
          onClose={() => setShowServerConfig(false)}
          onSaved={() => refresh()}
        />

        {/* Fallback Form Modal (for any generic action) */}
        {form &&
          !form.action.startsWith('site.') &&
          form.action !== 'attendance.save' &&
          !form.action.startsWith('worker.') &&
          form.action !== 'entry.void' ? (
          <FormModal
            key={form.action + (form.entity_id || '')}
            spec={form}
            busy={busy}
            error={error}
            onClose={() => {
              setForm(null);
              setError('');
            }}
            onSave={handleSaveForm}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <MainApp />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webDesktopWrapper: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    backgroundColor: Colors.background,
    ...Platform.select({
      web: {
        height: '100vh',
        boxShadow: '0 0 32px rgba(0, 0, 0, 0.08)',
        position: 'relative',
        overflow: 'hidden',
      } as any,
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  errorBox: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.danger,
    marginBottom: 6,
  },
  errorDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  /* FAB Action Sheet Styles */
  fabModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  fabModalDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fabSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: { boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.16)' },
      default: { elevation: 16 },
    }),
  },
  fabSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  fabSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  fabSheetSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 18,
  },
  fabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fabActionBtn: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fabActionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fabActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  fabCloseBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fabCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
