import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import Icon from './Icon';
import { colors, radius, shadow } from '../theme';

// "Continue with Google" button for the LoginScreen. Uses @convex-dev/auth's
// built-in Google OAuth flow. On native, this opens a Chrome Custom Tab / Safari
// via the Convex Auth redirect URL; the auth library handles the token exchange.
//
// Requires AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET set as Convex env vars, and the
// redirect URI registered in the Google Cloud Console.

export default function GoogleAuthButton() {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const continueWithGoogle = async () => {
    setBusy(true);
    setError('');
    try {
      // Convex Auth's signIn('google') triggers the OAuth redirect flow.
      // On React Native, it opens the browser for the Google consent screen,
      // then redirects back to the app via the Convex site URL callback.
      await signIn('google');
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      if (__DEV__) console.log('Google auth error', msg);
      setError('Google sign-in failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={continueWithGoogle}
        disabled={busy}
        activeOpacity={0.85}>
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Icon name="google" iconStyle="brand" size={20} color={colors.text} />
            <Text style={styles.btnText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.pill,
    paddingVertical: 15,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  error: { color: colors.danger, fontSize: 12, marginTop: 8, textAlign: 'center', fontWeight: '600' },
});
