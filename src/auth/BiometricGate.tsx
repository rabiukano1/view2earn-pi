import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { isLockEnabled, promptBiometric } from './biometric';
import Icon from '../components/Icon';
import { colors, shadow } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Gates its children behind a biometric prompt when the lock is enabled.
export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null); // null = still checking
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.me);

  const unlock = useCallback(async () => {
    if (await promptBiometric()) setLocked(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (!(await isLockEnabled())) {
        setLocked(false);
        return;
      }
      setLocked(true);
      if (await promptBiometric()) setLocked(false);
    })();
  }, []);

  if (locked === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (locked) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../assets/icon.png')} style={styles.logo} />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.lockRow} onPress={() => signOut()} activeOpacity={0.7}>
              <Icon name="right-from-bracket" iconStyle="solid" size={13} color={colors.danger} />
              <Text style={styles.lockText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome Back,</Text>
          <Text style={styles.nameText}>{user?.name ? user.name.toUpperCase() : (user?.username ? user.username.toUpperCase() : 'MEMBER')}</Text>
        </View>

        {/* Fingerprint Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Biometric Unlock</Text>
          <TouchableOpacity style={styles.fingerprintBox} onPress={unlock} activeOpacity={0.8}>
            <Icon name="fingerprint" iconStyle="solid" size={54} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Passcode Button */}
        <TouchableOpacity style={styles.passcodeBtn} onPress={unlock} activeOpacity={0.8}>
          <Text style={styles.passcodeBtnText}>Use Passcode / Biometrics</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Protected by secure device biometric encryption.
          </Text>
        </View>

      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 60,
    marginTop: 12,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 14,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
  },
  lockText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  welcomeContainer: {
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 40,
    alignItems: 'center',
    ...shadow.raised,
    elevation: 2,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 30,
  },
  fingerprintBox: {
    width: 100,
    height: 100,
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passcodeBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  passcodeBtnText: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  footerText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
});
