import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { LoginPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';

export { LoginPage } from './LoginPage';
export { SignUpPage } from './SignUpPage';
export { ForgotPasswordPage } from './ForgotPasswordPage';

import { UserInfo } from '../../api';

export type AuthMode = 'login' | 'signup' | 'forgot-password';

export interface AuthPageProps {
  onLogin: (token: string, user?: UserInfo) => Promise<void>;
  initialMode?: AuthMode;
}

export function AuthPage({ onLogin, initialMode }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(() => {
    if (initialMode) return initialMode;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('signup') || path.includes('register')) {
        return 'signup';
      }
      if (path.includes('forgot') || path.includes('reset')) {
        return 'forgot-password';
      }
    }
    return 'login';
  });

  // Sync with browser back/forward buttons on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = () => {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('signup') || path.includes('register')) {
          setMode('signup');
        } else if (path.includes('forgot') || path.includes('reset')) {
          setMode('forgot-password');
        } else {
          setMode('login');
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const navigateToSignUp = () => {
    setMode('signup');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', '/signup');
      } catch (e) {
        // Safely ignore history errors in non-standard environments
      }
    }
  };

  const navigateToLogin = () => {
    setMode('login');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', '/login');
      } catch (e) {
        // Safely ignore history errors in non-standard environments
      }
    }
  };

  const navigateToForgotPassword = () => {
    setMode('forgot-password');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', '/forgot-password');
      } catch (e) {
        // Safely ignore history errors in non-standard environments
      }
    }
  };

  if (mode === 'signup') {
    return (
      <SignUpPage
        key="auth-signup-screen"
        onLogin={onLogin}
        onNavigateToLogin={navigateToLogin}
      />
    );
  }

  if (mode === 'forgot-password') {
    return (
      <ForgotPasswordPage
        key="auth-forgot-password-screen"
        onNavigateToLogin={navigateToLogin}
      />
    );
  }

  return (
    <LoginPage
      key="auth-login-screen"
      onLogin={onLogin}
      onNavigateToSignUp={navigateToSignUp}
      onNavigateToForgotPassword={navigateToForgotPassword}
    />
  );
}
