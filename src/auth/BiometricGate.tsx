import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
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
            <Text style={styles.headerRightText}>Lost your phone?</Text>
            <TouchableOpacity style={styles.lockRow}>
              <Icon name="lock" iconStyle="solid" size={12} color="#0052CC" />
              <Text style={styles.lockText}>Lock your account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome Back,</Text>
          <Text style={styles.nameText}>{user?.name ? user.name.toUpperCase() : 'USER'}</Text>
        </View>

        {/* Fingerprint Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fingerprint Unlock</Text>
          <TouchableOpacity style={styles.fingerprintBox} onPress={unlock} activeOpacity={0.8}>
            <Icon name="fingerprint" iconStyle="solid" size={54} color="#0052CC" />
          </TouchableOpacity>
        </View>

        {/* Passcode Button */}
        <TouchableOpacity style={styles.passcodeBtn} onPress={unlock} activeOpacity={0.8}>
          <Text style={styles.passcodeBtnText}>Use Passcode Instead</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Licensed by the <Text style={{fontWeight: '700'}}>Central Bank of Nigeria</Text> and insured by the <Text style={{fontWeight: '700'}}>NDIC</Text>. Read our <Text style={{fontWeight: '700'}}>Privacy Policy ↗</Text>
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
  headerRightText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockText: {
    color: '#0052CC',
    fontSize: 14,
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
    backgroundColor: '#EBF2FF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passcodeBtn: {
    backgroundColor: '#EBF2FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  passcodeBtnText: {
    color: '#0052CC',
    fontSize: 16,
    fontWeight: '600',
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
