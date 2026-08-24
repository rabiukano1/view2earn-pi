import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from '@convex-dev/auth/react';
import { openTaskLink } from '../services/TaskLinkService';
import { api } from '../../convex/_generated/api';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';
import { biometricAvailable, promptBiometric, setLockEnabled, isLockEnabled } from '../auth/biometric';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Method = 'password' | 'otp';
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface LoginScreenProps {
  onShowSplash?: () => void;
}

export default function LoginScreen({ onShowSplash }: LoginScreenProps = {}) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();
  const [method, setMethod] = useState<Method>('password');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  // 'email' for entering email, 'code' for OTP via passwordless, 'verify-signup' for OTP after password signup
  const [otpStep, setOtpStep] = useState<'email' | 'code' | 'verify-signup'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(false);
  const applyReferral = useMutation(api.referrals.applyReferralCode);
  const { isAuthenticated } = useConvexAuth();
  
  const [detectedCountry, setDetectedCountry] = useState('unknown');

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_name) setDetectedCountry(data.country_name);
      })
      .catch(() => {});
  }, []);

  // Seconds remaining before the user can resend a verification code.
  const RESEND_SECONDS = 30;
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const handleTermsUnchecked = () => {
    setError('You must accept the Terms & Conditions and Privacy Policy to continue.');
  };

  // ponytail: using AsyncStorage for saved biometric credentials; upgrade to react-native-keychain / EncryptedStorage in production for hardware-backed secure storage.
  const BIO_CREDS_KEY = 'v2e_saved_bio_creds';

  // Ensure the fingerprint setup prompt fires at most once per sign-in, even
  // though it is invoked from several places (sign-in, verify, referral effect).
  const fingerprintAttempted = useRef(false);
  const attemptFingerprintSetup = async () => {
    if (fingerprintAttempted.current) return;
    fingerprintAttempted.current = true;
    try {
      if (await isLockEnabled()) return;
      if (await biometricAvailable()) {
        const wantFingerprint = await promptBiometric("Enable fingerprint login for future visits?");
        if (wantFingerprint) {
          await setLockEnabled(true);
        }
      }
    } catch {
      // Best effort — do not block auth
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    const available = await biometricAvailable();
    if (!available) {
      setError('Thumbprint / Biometric authentication is not supported or enabled on this device.');
      return;
    }

    try {
      const rawCreds = await AsyncStorage.getItem(BIO_CREDS_KEY);
      let credsToUse: { email: string; password: string } | null = null;
      if (rawCreds) {
        try {
          credsToUse = JSON.parse(rawCreds);
        } catch {
          credsToUse = null;
        }
      }

      // If no stored credentials, check if user has filled in email and password in the inputs
      if (!credsToUse || !credsToUse.email || !credsToUse.password) {
        const trimmedEmail = email.trim();
        if (trimmedEmail && password) {
          credsToUse = { email: trimmedEmail, password };
        } else {
          setError('Please enter your email and password once to enable thumbprint sign-in.');
          return;
        }
      }

      const verified = await promptBiometric('Scan thumbprint to sign in to View2Earn');
      if (!verified) {
        return;
      }

      setBusy(true);
      setError('');
      try {
        const result = await signIn('password', {
          email: credsToUse.email,
          password: credsToUse.password,
          flow: 'signIn',
        });
        if (result?.signingIn) {
          // ponytail: save credentials to persist thumbprint sign-in
          await AsyncStorage.setItem(BIO_CREDS_KEY, JSON.stringify(credsToUse)).catch(() => {});
          attemptFingerprintSetup();
        } else {
          setError('Email is not verified yet. Please sign in with password to receive a code.');
        }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes('InvalidSecret') || msg.includes('Incorrect password')) {
          setError('Saved credentials are no longer valid. Please sign in with your password.');
          await AsyncStorage.removeItem(BIO_CREDS_KEY).catch(() => {});
        } else {
          setError("Couldn't sign in with thumbprint. Please sign in with your password.");
        }
      } finally {
        setBusy(false);
      }
    } catch {
      setError('Thumbprint authentication failed.');
    }
  };

  // After signup, if a referral code was entered, apply it.
  useEffect(() => {
    if (isAuthenticated && referralCode.trim() && !referralApplied) {
      setReferralApplied(true);
      applyReferral({ code: referralCode.trim() }).catch(() => {
        // Best-effort — don't block the user from using the app.
        if (__DEV__) console.log('referral apply failed');
      });
      // Try fingerprint prompt after authentication
      attemptFingerprintSetup().catch(() => {});
    }
  }, [isAuthenticated, referralCode, referralApplied, applyReferral]);
  
  const [suggestSignup, setSuggestSignup] = useState(false);

  // "Sign in with Telegram": open the bot, poll the nonce, sign in when verified.
  const startTelegram = useMutation(api.telegramAuth.start);
  const [tgNonce, setTgNonce] = useState<string | null>(null);
  const tgStatus = useQuery(api.telegramAuth.status, tgNonce ? { nonce: tgNonce } : 'skip');

  useEffect(() => {
    if (tgNonce && tgStatus?.verified) {
      const nonce = tgNonce;
      setTgNonce(null);
      signIn('telegram', { nonce, country: detectedCountry }).then(() => {
        attemptFingerprintSetup();
      }).catch(() => setError('Telegram sign-in failed — try again.'));
    }
  }, [tgStatus, tgNonce, detectedCountry, signIn]);

  const continueWithTelegram = async () => {
    if (flow === 'signUp' && !acceptedTerms) return handleTermsUnchecked();
    setError('');
    try {
      const { nonce, url } = await startTelegram({});
      setTgNonce(nonce);
      await openTaskLink(url);
    } catch {
      setTgNonce(null);
      setError('Could not open Telegram.');
    }
  };

  const run = async (fn: () => Promise<unknown>, onErr: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError(onErr);
      if (__DEV__) console.log('auth error', String((e as { message?: string })?.message ?? e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return setError('Enter your email and password');
    if (flow === 'signUp' && !name.trim()) return setError('Please enter your full name');
    
    if (flow === 'signUp') {
      if (!acceptedTerms) return handleTermsUnchecked();
      setBusy(true);
      setError('');
      try {
        await signIn('password', { email: trimmedEmail, password, name: name.trim(), flow: 'signUp', country: detectedCountry });
        setOtpStep('verify-signup');
        setResendIn(RESEND_SECONDS);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes('already exists')) {
          try {
            await signIn('resend-otp', { email: trimmedEmail });
            setMethod('otp');
            setOtpStep('code');
            setResendIn(RESEND_SECONDS);
            setError('Account already exists. We sent a code to your email to log you in.');
          } catch {
            setError('Account already exists, but failed to send login code.');
          }
        } else {
          setError('Could not create account — the email may be invalid, or the password is under 8 characters.');
          if (__DEV__) console.log('signup error', msg);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    // Sign-in
    setBusy(true);
    setError('');
    setSuggestSignup(false);
    try {
      const result = await signIn('password', { email: trimmedEmail, password, flow: 'signIn' });
      if (result?.signingIn) {
        // ponytail: save credentials in storage to support instant thumbprint sign-ins
        await AsyncStorage.setItem(BIO_CREDS_KEY, JSON.stringify({ email: trimmedEmail, password })).catch(() => {});
        attemptFingerprintSetup();
      } else {
        // Account exists but email is unverified — the backend just sent a fresh
        // verification code. Route to the verify screen instead of doing nothing.
        setOtpStep('verify-signup');
        setResendIn(RESEND_SECONDS);
        setError('Your email is not verified yet. We sent a new code — enter it below.');
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (__DEV__) console.log('signin error', msg);
      if (msg.includes('InvalidSecret') || msg.includes('Incorrect password')) {
        setError('Incorrect password. Please try again.');
      } else if (msg.includes('does not exist') || msg.includes('not found')) {
        setError('No account found with this email address.');
        setSuggestSignup(true);
      } else {
        setError("We couldn't sign you in. Please check your email and password.");
        setSuggestSignup(true);
      }
    } finally {
      setBusy(false);
    }
  };

  // Verify the OTP code after password signup
  const verifySignupOtp = async () => {
    if (!code) return setError('Enter the 6-digit code sent to your email');
    const success = await run(
      () => signIn('password', { email: email.trim(), code, flow: 'email-verification' }), 
      'Invalid or expired code. Please try again.'
    );
    if (success) {
      attemptFingerprintSetup();
    }
  };

  // Create an account with the email/password already entered (fallback from suggest).
  const createAccount = async () => {
    setSuggestSignup(false);
    setFlow('signUp');
  };

  const sendCode = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setError('Enter your email');
    run(async () => {
      await signIn('resend-otp', { email: trimmedEmail });
      setOtpStep('code');
      setResendIn(RESEND_SECONDS);
    }, 'Could not send the code — try again.');
  };

  const verifyCode = async () => {
    if (!code) return setError('Enter the code from your email');
    const success = await run(() => signIn('resend-otp', { email: email.trim(), code }), 'Invalid or expired code.');
    if (success) {
      attemptFingerprintSetup();
    }
  };

  // Resend the code for whichever verification step is currently showing
  // (passwordless OTP login, or the post-signup email verification).
  const resendCode = async () => {
    if (resendIn > 0 || busy) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setError('Enter your email');
    setBusy(true);
    setError('');
    try {
      if (isVerifyingSignup) {
        await signIn('password', { email: trimmedEmail, flow: 'email-verification' });
      } else {
        await signIn('resend-otp', { email: trimmedEmail });
      }
      setResendIn(RESEND_SECONDS);
    } catch {
      setError('Could not resend the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchMethod = (m: Method) => {
    setMethod(m);
    setError('');
    setSuggestSignup(false);
    setOtpStep('email');
    setCode('');
  };

  // Render logic depending on OTP step
  const isVerifyingSignup = otpStep === 'verify-signup';
  // Terms acceptance is only required while creating an account (sign-up form).
  const requiresTerms = flow === 'signUp' && !isVerifyingSignup;

  const primaryLabel = isVerifyingSignup 
    ? 'Verify Email' 
    : method === 'password'
      ? flow === 'signUp'
        ? 'Create account'
        : 'Sign in'
      : otpStep === 'email'
        ? 'Email me a code'
        : 'Verify code';

  const onPrimary = isVerifyingSignup 
    ? verifySignupOtp
    : method === 'password' ? submitPassword : otpStep === 'email' ? sendCode : verifyCode;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <TouchableOpacity activeOpacity={0.85} onPress={onShowSplash}>
          <View style={styles.emblemGlow}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
        <Text style={styles.titleText}>{isVerifyingSignup ? "Verify Email" : (flow === 'signUp' ? 'Create Account' : 'Welcome Back')}</Text>
        <Text style={styles.tagline}>
          {isVerifyingSignup 
            ? `We sent a 6-digit code to ${email}`
            : 'Earn rewards for your social engagement'}
        </Text>
      </View>

      <View style={styles.glassCard}>
        {/* Method tabs - hidden if verifying signup */}
        {!isVerifyingSignup && (
          <View style={styles.tabs}>
            {(['password', 'otp'] as Method[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.tab, method === m && styles.tabActive]}
                onPress={() => switchMethod(m)}>
                <Text style={[styles.tabText, method === m && styles.tabTextActive]}>
                  {m === 'password' ? 'Password' : 'Email code'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Inputs */}
        {!isVerifyingSignup && (
          <>
            {method === 'password' && flow === 'signUp' && (
              <View style={styles.inputWrapper}>
                <Icon name="user" iconStyle="solid" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textFaint}
                  value={name}
                  onChangeText={(t) => { setName(t); if (error) setError(''); }}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Icon name="envelope" iconStyle="solid" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={(t) => { setEmail(t); if (error) setError(''); }}
                editable={method === 'password' || otpStep === 'email'}
              />
            </View>

            {method === 'password' && (
              <View style={styles.inputWrapper}>
                <Icon name="lock" iconStyle="solid" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 8 chars)"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
                />
              </View>
            )}

            {/* Referral code — only visible in sign-up flow */}
            {(method === 'password' && flow === 'signUp') ? (
              <View style={styles.inputWrapper}>
                <Icon name="gift" iconStyle="solid" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Referral code (optional)"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="characters"
                  value={referralCode}
                  onChangeText={setReferralCode}
                  maxLength={10}
                />
              </View>
            ) : null}
          </>
        )}

        {/* OTP Input for both Passwordless and Signup Verification */}
        {(isVerifyingSignup || (method === 'otp' && otpStep === 'code')) ? (
          <View style={styles.otpContainer}>
            <View style={[styles.inputWrapper, styles.otpWrapper]}>
              <Icon name="key" iconStyle="solid" size={18} color={colors.primary} />
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={styles.resendRow}
              onPress={resendCode}
              disabled={resendIn > 0 || busy}
              activeOpacity={0.7}>
              <Text style={[styles.resendText, (resendIn > 0 || busy) && styles.resendTextDisabled]}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Terms & Privacy Agreement Checkbox — sign-up only */}
        {requiresTerms ? (
          <View style={styles.termsRow}>
            <TouchableOpacity
              style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}
              onPress={() => {
                setAcceptedTerms(!acceptedTerms);
                if (error.includes('Terms')) setError('');
              }}
              activeOpacity={0.8}>
              {acceptedTerms ? (
                <Icon name="check" iconStyle="solid" size={12} color="#FFFFFF" />
              ) : null}
            </TouchableOpacity>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>Terms</Text>,{' '}
              <Text style={styles.termsLink} onPress={() => navigation.navigate('Policy', { policy: 'privacy' })}>Privacy</Text>,{' '}
              <Text style={styles.termsLink} onPress={() => navigation.navigate('Policy', { policy: 'anti-fraud' })}>Anti-Fraud</Text>,{' '}
              <Text style={styles.termsLink} onPress={() => navigation.navigate('Policy', { policy: 'cookies' })}>Cookies</Text> and{' '}
              <Text style={styles.termsLink} onPress={() => navigation.navigate('Policy', { policy: 'rewards' })}>Rewards</Text> policies.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="circle-exclamation" iconStyle="solid" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {(suggestSignup && method === 'password') ? (
          <TouchableOpacity style={styles.suggestBtn} onPress={createAccount} activeOpacity={0.85}>
            <Text style={styles.suggestText}>Create a new account instead</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.actionBtnFlex, (busy || (requiresTerms && !acceptedTerms)) && styles.btnDisabled]}
            onPress={onPrimary}
            disabled={busy}
            activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.btnText}>{primaryLabel}</Text>
            )}
          </TouchableOpacity>

          {!isVerifyingSignup && method === 'password' && flow === 'signIn' ? (
            <TouchableOpacity
              style={[styles.thumbprintBtn, busy && styles.btnDisabled]}
              onPress={handleBiometricLogin}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityLabel="Sign in with thumbprint">
              <Icon name="fingerprint" iconStyle="solid" size={24} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!isVerifyingSignup && method === 'password' && flow === 'signIn' ? (
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        ) : null}

        {isVerifyingSignup ? (
          <TouchableOpacity
            onPress={() => {
              setOtpStep('email');
              setCode('');
              setError('');
            }}
            style={styles.switchRow}>
            <Text style={styles.switchText}>Entered wrong email? Go back</Text>
          </TouchableOpacity>
        ) : method === 'password' ? (
          <TouchableOpacity
            onPress={() => {
              setFlow(flow === 'signUp' ? 'signIn' : 'signUp');
              setError('');
              setSuggestSignup(false);
            }}
            style={styles.switchRow}>
            <Text style={styles.switchText}>
              {flow === 'signUp' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        ) : otpStep === 'code' ? (
          <TouchableOpacity
            onPress={() => {
              setOtpStep('email');
              setCode('');
              setError('');
            }}
            style={styles.switchRow}>
            <Text style={styles.switchText}>Use a different email</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Divider */}
      {!isVerifyingSignup && (
        <>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.socialBtnGroup}>
            {flow === 'signIn' ? (
              <TouchableOpacity
                style={[styles.socialBtn, styles.fpBtn, busy && styles.btnDisabled]}
                onPress={handleBiometricLogin}
                disabled={busy}
                activeOpacity={0.85}>
                <Icon name="fingerprint" iconStyle="solid" size={20} color={colors.white} />
                <Text style={styles.socialText}>Sign in with Thumbprint</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.socialBtn, styles.tgBtn, ((requiresTerms && !acceptedTerms) || tgNonce) && styles.btnDisabled]}
              onPress={continueWithTelegram}
              disabled={!!tgNonce}
              activeOpacity={0.85}>
              <Icon name="telegram" iconStyle="brand" size={20} color={colors.white} />
              <Text style={styles.socialText}>
                {tgNonce ? 'Waiting for Telegram…' : 'Continue with Telegram'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.soon}>Sidra KYC sign-in coming soon</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  hero: { alignItems: 'center', marginBottom: 32 },
  emblemGlow: {
    padding: 4,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 20,
  },
  logoImage: { width: 96, height: 96, borderRadius: 28 },
  titleText: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
  tagline: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  
  glassCard: { 
    backgroundColor: colors.surface, 
    borderRadius: radius.xl, 
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...shadow.card,
    elevation: 12
  },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 24, backgroundColor: colors.surfaceAlt, padding: 4, borderRadius: radius.pill },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.surface, ...shadow.raised },
  tabText: { fontWeight: '600', color: colors.textMuted, fontSize: 14 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  
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
  
  otpContainer: { alignItems: 'center', marginVertical: 10 },
  otpWrapper: { width: '80%', borderColor: colors.primarySoft, borderWidth: 2, backgroundColor: colors.surface },
  otpInput: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 8 },
  resendRow: { paddingVertical: 12, alignItems: 'center' },
  resendText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  resendTextDisabled: { color: colors.textFaint },
  
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
    paddingRight: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    fontWeight: '400',
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  errorBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: colors.danger + '15', 
    padding: 12, 
    borderRadius: radius.md, 
    marginBottom: 16 
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  suggestBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  suggestText: { color: colors.primaryDeep, fontWeight: '700', fontSize: 14 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtnFlex: {
    flex: 1,
  },
  thumbprintBtn: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
    elevation: 4,
  },
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
  switchRow: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  switchText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  forgotRow: { alignItems: 'center', marginTop: 12, paddingVertical: 6 },
  forgotText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 28 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  
  socialBtnGroup: {
    gap: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: radius.pill,
    paddingVertical: 16,
    ...shadow.raised,
  },
  tgBtn: { backgroundColor: '#2AABEE' },
  fpBtn: { backgroundColor: '#111827' },
  socialText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  soon: { textAlign: 'center', color: colors.textFaint, fontSize: 13, marginTop: 24, fontWeight: '500' },
});
