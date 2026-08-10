import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { colors, radius, shadow } from '../theme';
import RewardedAdModal from './RewardedAdModal';

const LEGS = [
  { key: 'social', icon: '🔗', label: 'Follow' },
  { key: 'telegram', icon: '✈️', label: 'Telegram' },
  { key: 'quiz', icon: '🧠', label: 'Quiz' },
] as const;

export default function ComboTracker({ userId }: { userId: Id<'users'> }) {
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const status = useQuery(api.combos.getComboStatus, { userId });
  const claimCombo = useMutation(api.combos.claimCombo);

  // Hidden until the user starts a leg (and after it's claimed) to avoid clutter.
  if (!status || status.claimedToday || legDoneCount(status) === 0) return null;

  const doClaim = async () => {
    if (busy || !status.canClaim) return;
    setBusy(true);
    try {
      const res = await claimCombo({ userId });
      Alert.alert('Combo Bonus! ⚡', `+${res.reward} pts earned for completing the daily combo!`);
    } catch (e) {
      Alert.alert('Combo', String(e).replace('[CONVEX] ', ''));
    } finally {
      setBusy(false);
    }
  };

  const onClaimPress = () => {
    if (busy || !status.canClaim) return;
    setAdVisible(true);
  };

  const handleAdSuccess = () => doClaim();

  return (
    <>
      <View style={[styles.card, dark && styles.cardDark]}>
        <View style={styles.head}>
          <Text style={[styles.title, dark && styles.textLight]}>⚡ Daily Combo</Text>
          <Text style={styles.reward}>+{status.reward} pts</Text>
        </View>
        <View style={styles.legs}>
          {LEGS.map((leg) => {
            const done = status[leg.key];
            return (
              <View key={leg.key} style={styles.leg}>
                <View style={[styles.legDot, done && styles.legDotDone]}>
                  <Text style={styles.legIcon}>{done ? '✓' : leg.icon}</Text>
                </View>
                <Text style={[styles.legLabel, done && styles.legLabelDone]}>{leg.label}</Text>
              </View>
            );
          })}
          <TouchableOpacity
            style={[styles.claimBtn, !status.canClaim && styles.claimBtnOff]}
            disabled={!status.canClaim || busy}
            onPress={onClaimPress}>
            <Text style={[styles.claimText, !status.canClaim && styles.claimTextOff]}>
              {busy ? '…' : status.canClaim ? 'Claim' : `${legDoneCount(status)}/3`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
      />
    </>
  );
}

function legDoneCount(s: { social: boolean; telegram: boolean; quiz: boolean }): number {
  return [s.social, s.telegram, s.quiz].filter(Boolean).length;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '800', color: colors.text },
  textLight: { color: colors.textDark },
  reward: { fontSize: 13, fontWeight: '800', color: colors.primary },
  legs: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  leg: { alignItems: 'center', flex: 1, gap: 4 },
  legDot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legDotDone: { backgroundColor: colors.success },
  legIcon: { fontSize: 16, color: colors.white },
  legLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaint },
  legLabelDone: { color: colors.success },
  claimBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow.raised,
  },
  claimBtnOff: { backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0 },
  claimText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  claimTextOff: { color: colors.textFaint },
});
