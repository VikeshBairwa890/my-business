import React, { useEffect, useState, useRef } from 'react';
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
import { SiteFormModal } from './src/components/sites/SiteFormModal';
import { AttendanceModal } from './src/components/attendance/AttendanceModal';
import { WorkerFormModal } from './src/components/workers/WorkerFormModal';
import { VoidEntryModal } from './src/components/common/VoidEntryModal';

// Pages
import { AuthPage } from './src/pages/Auth';
import { DashboardPage } from './src/pages/Dashboard';
import { SitesPage, NewSitePage } from './src/pages/Sites';
import { AttendancePage } from './src/pages/Attendance';
import { LabourPage } from './src/pages/Labour';
import { HisabPage } from './src/pages/Hisab';
import { ReportsPage } from './src/pages/Reports';
import { ProfilePage } from './src/pages/Profile';
import {
  MaterialBillPage,
  WagePaymentPage,
  ReceivePaymentPage,
  ExpenseBillPage,
  ExtraWorkPage,
} from './src/pages/Entries';

// API & Helpers
import { request, commandKey, UserInfo } from './src/api';
import { attendanceForm, entryForm, siteForm, workerForm, voidForm } from './src/forms';
import { pdfReport, shareReport } from './src/report';
import { FormSpec, Row, Snapshot } from './src/types';
import { LanguageProvider, useLanguage } from './src/i18n';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppLoader } from './src/components/common/AppLoader';

function MainApp() {
  const { t, lang } = useLanguage();
  const { isLoggedIn, token, user, ready, setAuth, logout, updateUser } = useAuth();
  const [data, setData] = useState<Snapshot | null>(null);

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
      if (path === '/profile') {
        return { tab: 'profile', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
      }
    }
    return { tab: 'home', selectedSiteId: null, selectedWorkerId: null, isNewSite: false, activeEntryKind: null };
  };

  const initialRoute = useRef(getInitialRouteState()).current;
  const [tab, setTab] = useState(initialRoute.tab);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(initialRoute.selectedSiteId);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialRoute.selectedWorkerId);
  const [isNewSite, setIsNewSite] = useState<boolean>(initialRoute.isNewSite);
  const [activeEntryKind, setActiveEntryKind] = useState<string | null>(initialRoute.activeEntryKind);
  const [activeEntryParams, setActiveEntryParams] = useState<{ siteId?: string; workerId?: string; bill?: Row } | null>(null);

  const [form, setForm] = useState<FormSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showFabModal, setShowFabModal] = useState(false);
  const pendingRef = useRef<{ signature: string; key: string } | null>(null);

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

  async function refresh(t = token) {
    if (!t) return;
    setRefreshing(true);
    try {
      const snap = await request('/snapshot', t);
      setData(snap);
      if (snap?.user || snap?.organization) {
        updateUser({
          name: snap.user?.name || user?.name || '',
          organizationName: snap.organization?.name || user?.organizationName || '',
        });
      }
      setError('');
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401) {
        await logout();
        setData(null);
      }
    } finally {
      setRefreshing(false);
    }
  }

  // Fetch snapshot data in the background as soon as token is ready
  useEffect(() => {
    if (token && !data && !refreshing) {
      refresh(token);
    }
  }, [token, data, refreshing]);

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);

  async function handleLogin(newToken: string, newUser?: UserInfo) {
    await setAuth(newToken, newUser || null);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setData(null);
      setSelectedSiteId(null);
      setIsNewSite(false);
      setTab('home');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.pushState(null, '', '/');
      }
    }
  }

  function openForm(spec: FormSpec) {
    pendingRef.current = null;
    setError('');
    setForm(spec);
  }

  async function handleSaveForm(values: Record<string, string>) {
    if (!form || busy) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        action: form.action,
        entity_id: form.entity_id,
        data: form.transform(values),
      };
      const signature = JSON.stringify(body);
      if (pendingRef.current?.signature !== signature) {
        pendingRef.current = { signature, key: commandKey() };
      }
      await request('/commands', token, {
        ...body,
        key: pendingRef.current.key,
      });
      setForm(null);
      pendingRef.current = null;
      setToast('Saved successfully');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateProfile(values: { name?: string; organization_name?: string }) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        action: 'profile.update',
        data: values,
      };
      await request('/commands', token, {
        ...body,
        key: commandKey(),
      });
      await refresh();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
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
    const onHardwareBackPress = () => {
      // 1. If any modal form is open, close the modal
      if (form) {
        setForm(null);
        setError('');
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
        setToast(exitMsg);
      }
      return true;
    };

    const backSub = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );
    return () => backSub.remove();
  }, [form, isNewSite, selectedSiteId, selectedWorkerId, activeEntryKind, tab, lang]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onPopState = () => {
        const path = window.location.pathname;
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
        } else if (path === '/attendance') {
          setTab('attendance');
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
          setActiveEntryKind(null);
        } else {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
          setSelectedWorkerId(null);
          setActiveEntryKind(null);
        }
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, []);

  function handleNavigate(targetTab: string) {
    let actualTab = targetTab;
    if (targetTab === 'workers' || targetTab === 'labour') {
      actualTab = 'team';
    } else if (targetTab === 'hisab') {
      actualTab = 'ledger';
    }
    navigate(actualTab, actualTab === 'home' ? '/' : `/${actualTab}`, null, false, null);
  }

  async function handleCreateNewSite(values: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const spec = siteForm();
      const body = {
        action: spec.action,
        entity_id: commandKey(),
        data: spec.transform(values),
      };
      const signature = JSON.stringify(body);
      if (pendingRef.current?.signature !== signature) {
        pendingRef.current = { signature, key: commandKey() };
      }
      await request('/commands', token, {
        ...body,
        key: pendingRef.current.key,
      });
      pendingRef.current = null;
      setToast('New site created successfully');
      await refresh();
      navigate('sites', '/sites', null, false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleShareReport(pdf = false, siteId?: string) {
    if (!data) return;
    try {
      if (pdf) {
        await pdfReport(data, siteId);
      } else {
        const msg = await shareReport(data, siteId);
        setToast(msg);
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
      setToast(lang === 'hi' ? 'कृपया पहले एक साइट जोड़ें' : 'Please add a work site first');
      return;
    }
    if (kind === 'WAGE_PAYMENT' && !data?.workers.length) {
      setToast(lang === 'hi' ? 'कृपया पहले एक मजदूर (Labour) जोड़ें' : 'Please add a worker first');
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
    if (busy || !data) return;
    setBusy(true);
    setError('');
    try {
      const spec = entryForm(data, kind, siteId, workerId, bill);
      const body = {
        action: spec.action,
        entity_id: commandKey(),
        data: spec.transform(values),
      };
      const signature = JSON.stringify(body);
      if (pendingRef.current?.signature !== signature) {
        pendingRef.current = { signature, key: commandKey() };
      }
      await request('/commands', token, {
        ...body,
        key: pendingRef.current.key,
      });
      pendingRef.current = null;
      setToast(lang === 'hi' ? 'सफलतापूर्वक सुरक्षित हो गया' : 'Saved successfully');
      await refresh();
      setActiveEntryKind(null);
      setActiveEntryParams(null);
      navigate('home', '/', null, false, null, null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
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
      setToast('Please add an active worker and site first');
      return;
    }
    openForm(attendanceForm(data, siteId, workerId, existing));
  };

  if (!ready) {
    return <AppLoader message="ThekaBook" />;
  }

  if (!isLoggedIn || !token) {
    return <AuthPage onLogin={handleLogin} />;
  }



  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Toast notification */}
      {toast ? (
        <View style={styles.toastContainer}>
          <View
            style={[
              styles.toast,
              toast.toLowerCase().includes('error') || toast.toLowerCase().includes('fail')
                ? styles.toastError
                : toast.toLowerCase().includes('please') || toast.toLowerCase().includes('कृपया') || toast.toLowerCase().includes('add')
                  ? styles.toastWarning
                  : styles.toastSuccess,
            ]}
          >
            <Ionicons
              name={
                toast.toLowerCase().includes('error') || toast.toLowerCase().includes('fail')
                  ? 'alert-circle'
                  : toast.toLowerCase().includes('please') || toast.toLowerCase().includes('कृपया') || toast.toLowerCase().includes('add')
                    ? 'information-circle'
                    : 'checkmark-circle'
              }
              size={18}
              color={
                toast.toLowerCase().includes('error') || toast.toLowerCase().includes('fail')
                  ? '#DC2626'
                  : toast.toLowerCase().includes('please') || toast.toLowerCase().includes('कृपया') || toast.toLowerCase().includes('add')
                    ? '#D97706'
                    : '#059669'
              }
            />
            <Text
              style={[
                styles.toastText,
                toast.toLowerCase().includes('error') || toast.toLowerCase().includes('fail')
                  ? styles.toastTextError
                  : toast.toLowerCase().includes('please') || toast.toLowerCase().includes('कृपया') || toast.toLowerCase().includes('add')
                    ? styles.toastTextWarning
                    : styles.toastTextSuccess,
              ]}
            >
              {toast}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Main Screen Content */}
      <View style={styles.content}>
        {tab === 'home' && !activeEntryKind && !isNewSite ? (
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
            onLogout={handleLogout}
            onShowToast={(msg) => setToast(msg)}
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
                refreshing={refreshing}
                onRefresh={() => refresh()}
              />
            )}

            {tab === 'attendance' && (
              <AttendancePage
                data={data}
                onOpenAttendanceModal={openAttendanceModal}
                onOpenProfile={() => handleNavigate('profile')}
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
                refreshing={refreshing}
                onRefresh={() => refresh()}
              />
            )}

            {tab === 'reports' && (
              <ReportsPage
                data={data}
                onGenerateReport={handleShareReport}
                onOpenProfile={() => handleNavigate('profile')}
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
          </>
        )}
      </View>

      {/* Footer Bottom Navigation with Center Golden Action FAB */}
      <BottomNav
        tabs={navTabs}
        activeTab={tab}
        onTabPress={handleNavigate}
        onCenterPress={() => setShowFabModal(true)}
      />

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
                <Text style={styles.fabActionLabel}>Nayi Site</Text>
              </Pressable>

              <Pressable
                style={styles.fabActionBtn}
                onPress={() => {
                  setShowFabModal(false);
                  openAttendanceModal();
                }}
              >
                <View style={[styles.fabActionIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="calendar" size={24} color="#4338CA" />
                </View>
                <Text style={styles.fabActionLabel}>Daily Haziri</Text>
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

      {/* Form Modal */}
      {form && form.action.startsWith('site.') ? (
        <SiteFormModal
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
      ) : form && form.action === 'attendance.save' && data ? (
        <AttendanceModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action.startsWith('worker.') && data ? (
        <WorkerFormModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          worker={form.entity_id ? data.workers.find((w) => w.id === form.entity_id) : undefined}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
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
        <VoidEntryModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          entry={data.entries.find((e) => e.id === form.entity_id)}
          site={data.sites.find((s) => s.id === data.entries.find((e) => e.id === form.entity_id)?.site_id)}
          worker={data.workers.find((w) => w.id === data.entries.find((e) => e.id === form.entity_id)?.worker_id)}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form ? (
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
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
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
  toastContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  toastSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  toastWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  toastError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  toastTextSuccess: {
    color: '#065F46',
  },
  toastTextWarning: {
    color: '#92400E',
  },
  toastTextError: {
    color: '#991B1B',
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

