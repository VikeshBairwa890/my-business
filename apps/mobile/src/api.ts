import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const TOKEN_KEY = 'thekabook_session';

export function getApiBaseUrl(): string {
  // 1. Explicit env URL takes top priority (Production & Local dev configuration)
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // 2. Web browser: Always use window.location.hostname for seamless local/prod web preview
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:4000`;
  }

  // 3. Expo Constants extra.apiUrl (embedded into standalone APK binary if configured)
  const configApiUrl = (Constants.expoConfig?.extra as any)?.apiUrl;
  if (configApiUrl && !configApiUrl.includes('loca.lt')) {
    return configApiUrl.replace(/\/$/, '');
  }

  // 4. Mobile (Expo Go & dev client): Auto-detect Metro bundler IP from developer host
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:4000`;
    }
  }

  // 5. React Native SourceCode scriptURL fallback
  const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
  if (scriptURL) {
    try {
      const match = scriptURL.match(/https?:\/\/([^/:]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:4000`;
      }
    } catch { }
  }

  // 6. Platform default fallback: Android emulator uses 10.0.2.2 to access host machine
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export function getPublicReportBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && !envUrl.includes('localhost') && !/^https?:\/\/(192\.168\.|10\.|172\.)/.test(envUrl)) {
    return envUrl.replace(/\/$/, '');
  }
  return getApiBaseUrl();
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  orgId?: string;
  organizationName?: string;
  [key: string]: any;
}

export interface StoredAuthState {
  isLoggedIn: boolean;
  token: string | null;
  user: UserInfo | null;
}

const AUTH_STATE_KEY = 'thekabook_auth_state';

export const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (saved) return saved;
      }
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(TOKEN_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export async function saveToken(token: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
      }
      if (typeof sessionStorage !== 'undefined') {
        token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY);
      }
      return;
    }
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch { }
}

export async function saveAuthState(token: string | null, user: UserInfo | null): Promise<void> {
  try {
    const isLoggedIn = Boolean(token);
    const state: StoredAuthState = {
      isLoggedIn,
      token,
      user,
    };
    const serialized = JSON.stringify(state);

    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        if (token) {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(AUTH_STATE_KEY, serialized);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(AUTH_STATE_KEY);
        }
      }
      if (typeof sessionStorage !== 'undefined') {
        if (token) {
          sessionStorage.setItem(TOKEN_KEY, token);
          sessionStorage.setItem(AUTH_STATE_KEY, serialized);
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(AUTH_STATE_KEY);
        }
      }
      return;
    }

    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(AUTH_STATE_KEY, serialized);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(AUTH_STATE_KEY);
    }
  } catch { }
}

export async function getStoredAuthState(): Promise<StoredAuthState> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(AUTH_STATE_KEY);
      }
      if (!raw && typeof sessionStorage !== 'undefined') {
        raw = sessionStorage.getItem(AUTH_STATE_KEY);
      }
    } else {
      raw = await SecureStore.getItemAsync(AUTH_STATE_KEY);
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token) {
        return {
          isLoggedIn: true,
          token: parsed.token,
          user: parsed.user || null,
        };
      }
    }

    // Fallback: Check if token exists alone
    const directToken = await getToken();
    if (directToken) {
      return {
        isLoggedIn: true,
        token: directToken,
        user: null,
      };
    }

    return {
      isLoggedIn: false,
      token: null,
      user: null,
    };
  } catch {
    return {
      isLoggedIn: false,
      token: null,
      user: null,
    };
  }
}

export async function clearAuthState(): Promise<void> {
  await saveAuthState(null, null);
}

const REMEMBERED_EMAIL_KEY = 'thekabook_remembered_email';

export async function getRememberedEmail(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(REMEMBERED_EMAIL_KEY) : null;
    }
    return await SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function saveRememberedEmail(email: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      return;
    }
    if (email) await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email);
    else await SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY);
  } catch { }
}

export async function request(path: string, token: string | null, body?: unknown) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };

  let lastError: any = null;

  // Maximum 2 attempts for transient connection glitches
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      const rawText = await res.text();
      let json: any = null;
      if (rawText && rawText.trim().length > 0) {
        try {
          json = JSON.parse(rawText);
        } catch {
          throw new Error(`Server returned non-JSON response (${res.status})`);
        }
      } else {
        json = {};
      }

      if (!res.ok) {
        const error: any = new Error(json.error || `Request failed with status ${res.status}`);
        error.status = res.status;
        throw error;
      }

      return json;
    } catch (err: any) {
      lastError = err;
      // Never retry 4xx user/validation errors (e.g. invalid credentials 401, validation 400)
      if (err.status && err.status < 500) {
        throw err;
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  throw new Error(lastError?.message || `API unreachable at ${baseUrl}. Check server status.`);
}

export const commandKey = () => Crypto.randomUUID();


