import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { colors, radius, shadow } from '../theme';

export default function ProgressToReward({
  userId,
  onPress,
}: {
  userId: Id<'users'>;
  onPress?: () => void;
}) {
  const dark = useColorScheme() === 'dark';
  const data = useQuery(api.rewards.progressToNext, { userId });

  if (!data || !data.target) return null;

  const price = data.target.pointsPrice || 1;
  const pct = Math.max(0, Math.min(1, data.balance / price));
  const remaining = Math.max(0, price - data.balance);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.row}>
        <Text style={styles.gift}>🎁</Text>
        <Text style={[styles.label, dark && styles.textLight]} numberOfLines={1}>
          {data.ready
            ? `You can redeem ${data.target.name}! 🎉`
            : `${remaining} pts from ${data.target.name}`}
        </Text>
        <Text style={styles.count}>
          {data.balance}/{price}
        </Text>
      </View>
      <View style={[styles.track, dark && styles.trackDark]}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%` },
            data.ready && styles.fillReady,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
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
  row: { flexDirection: 'row', alignItems: 'center' },
  gift: { fontSize: 16 },
  label: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
  },
  textLight: { color: colors.textDark },
  count: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginTop: 10,
    overflow: 'hidden',
  },
  trackDark: { backgroundColor: colors.surfaceAltDark },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  fillReady: { backgroundColor: colors.success },
});
