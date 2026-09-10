import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RESEND_SECONDS = 30;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Countdown before the user can request another code.
  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [step, resendIn]);

  const sendResetCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setError('Enter your email address');
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await signIn('password', { email: trimmedEmail, flow: 'reset' });
      setStep('code');
      setResendIn(RESEND_SECONDS);
      setSuccess(`We sent a reset code to ${trimmedEmail}`);
    } catch {
      setError('Could not send the reset code. Check the email and try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendResetCode = async () => {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn('password', { email: email.trim(), flow: 'reset' });
      setResendIn(RESEND_SECONDS);
      setSuccess('A new reset code was sent.');
    } catch {
      setError('Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!code) return setError('Enter the code from your email');
    if (!newPassword || newPassword.length < 8) {
      return setError('New password must be at least 8 characters');
    }
    setBusy(true);
    setError('');
    try {
      const result = await signIn('password', {
        email: trimmedEmail,
        code,
        newPassword,
        flow: 'reset-verification',
      });
      if (!result?.signingIn) {
        setError('Invalid or expired code. Please try again.');
      }
      // On success the user is signed in and the auth gate opens the app.
    } catch {
      setError('Could not reset password. The code may be invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Forgot Password" subtitle="Reset your account password" back />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.card, dark && styles.cardDark]}>
          {step === 'email' ? (
            <>
              <Text style={[styles.hint, dark && styles.textLight]}>
                Enter the email linked to your account and we will send you a 6-digit reset code.
              </Text>
              <View style={styles.inputWrapper}>
                <Icon name="envelope" iconStyle="solid" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, dark && styles.textLight]}
                  placeholder="Email address"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.hint, dark && styles.textLight]}>
                Enter the code sent to your email and choose a new password.
              </Text>
              <View style={styles.inputWrapper}>
                <Icon name="key" iconStyle="solid" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.input, styles.codeInput, dark && styles.textLight]}
                  placeholder="000000"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                  autoFocus
                />
              </View>
              <View style={styles.inputWrapper}>
                <Icon name="lock" iconStyle="solid" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, dark && styles.textLight]}
                  placeholder="New password (min 8 chars)"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>
            </>
          )}

          {success ? (
            <View style={styles.successBox}>
              <Icon name="circle-check" iconStyle="solid" size={14} color={colors.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="circle-exclamation" iconStyle="solid" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDisabled]}
            onPress={step === 'email' ? sendResetCode : resetPassword}
            disabled={busy}
            activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.btnText}>
                {step === 'email' ? 'Send Reset Code' : 'Reset Password'}
              </Text>
            )}
          </TouchableOpacity>

          {step === 'code' ? (
            <TouchableOpacity
              style={styles.resendRow}
              onPress={resendResetCode}
              disabled={resendIn > 0 || busy}
              activeOpacity={0.7}>
              <Text style={[styles.resendText, resendIn > 0 && styles.resendTextDisabled]}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  hint: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 20 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: colors.text, fontWeight: '500' },
  codeInput: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 6 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.success + '15',
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  successText: { color: colors.success, fontSize: 13, fontWeight: '600', flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger + '15',
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.raised,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  resendRow: { alignItems: 'center', paddingVertical: 14 },
  resendText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  resendTextDisabled: { color: colors.textFaint },
  backRow: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  backText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
});
