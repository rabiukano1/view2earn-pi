import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isLockEnabled, promptBiometric } from './biometric';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

// Gates its children behind a biometric prompt when the lock is enabled.
export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null); // null = still checking

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
      <View style={styles.center}>
        <Text style={styles.brand}>View2Earn</Text>
        <Text style={styles.hint}>Locked — tap to unlock</Text>
        <TouchableOpacity style={styles.fingerprint} onPress={unlock} activeOpacity={0.8}>
          <Icon name="fingerprint" iconStyle="solid" size={64} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.sub}>Use your fingerprint or Face ID</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  brand: { fontSize: 32, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  hint: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  fingerprint: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    ...shadow.raised,
  },
  sub: { fontSize: 13, color: colors.textFaint, fontWeight: '600' },
});
