import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { AppIcon } from '../../components/icons/AppIcon';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { request } from '../../api';

interface AuthPageProps {
  onLogin: (token: string) => Promise<void>;
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const endpoint = '/auth/' + (isRegister ? 'register' : 'login');
      const payload = {
        email: email.trim(),
        password,
        ...(isRegister ? { name, organization: org } : {}),
      };
      const result = await request(endpoint, null, payload);
      await onLogin(result.token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.container}>
          {/* Brand Header */}
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <AppIcon name="shield-checkmark" size={26} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.brandTitle}>ThekaBook</Text>
              <Text style={styles.brandSubtitle}>KAAM KA POORA HISAB</Text>
            </View>
          </View>

          {/* Value Prop Banner */}
          <View style={styles.headlineBox}>
            <Text style={styles.headline}>
              Your Work. Your Team.{'\n'}
              <Text style={{ color: Colors.primary }}>Every Rupee, Clear.</Text>
            </Text>
            <Text style={styles.tagline}>
              Sites se salary tak — professional contractor workspace.
            </Text>
          </View>

          {/* Form Card */}
          <Card style={styles.authCard}>
            <Text style={styles.formTitle}>
              {isRegister ? 'Create Contractor Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.formDesc}>
              {isRegister
                ? 'Enter your business details to start your ledger'
                : 'Sign in with your email and password'}
            </Text>

            {isRegister && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>YOUR NAME</Text>
                  <TextInput
                    accessibilityLabel="Your name"
                    style={styles.input}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor={Colors.textSubtle}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>BUSINESS / CONTRACTOR NAME</Text>
                  <TextInput
                    accessibilityLabel="Business name"
                    style={styles.input}
                    placeholder="e.g. Kumar Construction"
                    placeholderTextColor={Colors.textSubtle}
                    value={org}
                    onChangeText={setOrg}
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                accessibilityLabel="Email address"
                style={styles.input}
                placeholder="contractor@example.com"
                placeholderTextColor={Colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                accessibilityLabel="Password"
                style={styles.input}
                placeholder={isRegister ? 'Minimum 10 characters' : 'Enter your password'}
                placeholderTextColor={Colors.textSubtle}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              title={busy ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
              disabled={busy}
              loading={busy}
              onPress={submit}
              icon="arrow-forward"
              size="lg"
              style={{ marginTop: 6 }}
            />

            <Pressable
              onPress={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={styles.toggleBtn}
            >
              <Text style={styles.toggleText}>
                {isRegister
                  ? 'Already have an account? Sign in'
                  : 'New contractor? Create an account'}
              </Text>
            </Pressable>
          </Card>

          {/* Trust Footer */}
          <View style={styles.trustRow}>
            <AppIcon name="lock-closed-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.trustText}>
              256-bit Secure • Private Workspace • Cloud PostgreSQL
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  headlineBox: {
    gap: 6,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  authCard: {
    padding: 22,
    gap: 14,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  formDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: -8,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceSubtle,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    color: Colors.accentDark,
    fontSize: 13,
    fontWeight: '700',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  trustText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
