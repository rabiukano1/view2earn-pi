import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { biometricAvailable, isLockEnabled, setLockEnabled, promptBiometric } from '../auth/biometric';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

export default function SecurityScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();
  const stackNav = useNavigation<StackNav>();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [lockOn, setLockOn] = useState(false);

  useEffect(() => {
    biometricAvailable().then(setBioAvailable);
    isLockEnabled().then(setLockOn);
  }, []);

  const toggleLock = async (on: boolean) => {
    if (on && !(await promptBiometric('Confirm to enable fingerprint lock'))) return;
    await setLockEnabled(on);
    setLockOn(on);
  };

  const policyRows = [
    {
      icon: 'shield-check',
      tint: colors.success,
      label: 'Privacy Policy',
      sub: 'How we collect, use & protect your data',
      onPress: () => stackNav.navigate('Policy', { policy: 'privacy' }),
    },
    {
      icon: 'shield-halved',
      tint: colors.danger,
      label: 'Anti-Fraud Policy',
      sub: 'Zero-tolerance fraud prevention rules',
      onPress: () => stackNav.navigate('Policy', { policy: 'anti-fraud' }),
    },
    {
      icon: 'cookie-bite',
      tint: '#F59E0B',
      label: 'Cookie Policy',
      sub: 'How cookies & similar tech are used',
      onPress: () => stackNav.navigate('Policy', { policy: 'cookies' }),
    },
    {
      icon: 'gift',
      tint: colors.primary,
      label: 'Rewards & Redemption',
      sub: 'How points are earned & redeemed',
      onPress: () => stackNav.navigate('Policy', { policy: 'rewards' }),
    },
    {
      icon: 'file-lines',
      tint: colors.textMuted,
      label: 'Terms & Conditions',
      sub: 'Official Terms of Service',
      onPress: () => stackNav.navigate('Terms'),
    },
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Security & Settings" subtitle="Lock, privacy and your account" back />
      <View style={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {bioAvailable && (
          <View style={[styles.settingRowCard, dark && styles.cardDark]}>
            <View style={[styles.settingIconBg, { backgroundColor: colors.primary + '1F' }]}>
              <Icon name="fingerprint" iconStyle="solid" size={18} color={colors.primary} />
            </View>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.settingTitle, dark && styles.textLight]}>Biometric Unlock</Text>
              <Text style={styles.settingSubtitle}>Require fingerprint on app launch</Text>
            </View>
            <Switch
              value={lockOn}
              onValueChange={toggleLock}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        )}

        <Text style={[styles.sectionLabel, dark && styles.textLight]}>Privacy & Policy</Text>
        {policyRows.map((row) => (
          <TouchableOpacity
            key={row.label}
            style={[styles.settingRowCard, dark && styles.cardDark]}
            onPress={row.onPress}
            activeOpacity={0.85}>
            <View style={[styles.settingIconBg, { backgroundColor: row.tint + '1F' }]}>
              <Icon name={row.icon} iconStyle="solid" size={18} color={row.tint} />
            </View>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.settingTitle, dark && styles.textLight]}>{row.label}</Text>
              <Text style={styles.settingSubtitle}>{row.sub}</Text>
            </View>
            <Icon name="chevron-right" iconStyle="solid" size={12} color={colors.textFaint} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()} activeOpacity={0.85}>
          <Icon name="right-from-bracket" iconStyle="solid" size={15} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out of Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  textLight: { color: colors.textDark },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 10, marginTop: 4 },
  settingRowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  settingIconBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingTextGroup: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  settingSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    paddingVertical: 14,
    marginTop: 14,
  },
  signOutText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
