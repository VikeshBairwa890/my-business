import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserInfo,
  StoredAuthState,
  getStoredAuthState,
  saveAuthState,
  clearAuthState,
  request,
} from '../api';

export interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  user: UserInfo | null;
  ready: boolean;
  setAuth: (token: string, user?: UserInfo | null) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partialUser: Partial<UserInfo>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  token: null,
  user: null,
  ready: false,
  setAuth: async () => {},
  logout: async () => {},
  updateUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<StoredAuthState>({
    isLoggedIn: false,
    token: null,
    user: null,
  });
  const [ready, setReady] = useState(false);

  // Restore saved authentication state on startup
  useEffect(() => {
    let mounted = true;
    getStoredAuthState()
      .then((saved) => {
        if (mounted) {
          setAuthState(saved);
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setAuth = async (token: string, user: UserInfo | null = null) => {
    const updatedUser = user || authState.user;
    await saveAuthState(token, updatedUser);
    setAuthState({
      isLoggedIn: true,
      token,
      user: updatedUser,
    });
  };

  const logout = async () => {
    if (authState.token) {
      try {
        await request('/auth/logout', authState.token, {});
      } catch {
        // Safe to ignore on network error or expired token
      }
    }
    await clearAuthState();
    setAuthState({
      isLoggedIn: false,
      token: null,
      user: null,
    });
  };

  const updateUser = async (partialUser: Partial<UserInfo>) => {
    if (!authState.user) return;
    const merged: UserInfo = {
      ...authState.user,
      ...partialUser,
    };
    await saveAuthState(authState.token, merged);
    setAuthState((prev) => ({
      ...prev,
      user: merged,
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: authState.isLoggedIn,
        token: authState.token,
        user: authState.user,
        ready,
        setAuth,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
