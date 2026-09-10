import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { colors, radius, shadow } from '../theme';
import Icon from './Icon';
import RewardedAdModal from './RewardedAdModal';

export default function DailyBox({ userId }: { userId: Id<'users'> }) {
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const [adVisible, setAdVisible] = useState(false);
  const status = useQuery(api.bonus.getBoxStatus, { userId });
  const openBox = useMutation(api.bonus.openBox);

  if (!status) return null;

  const doOpenBox = async () => {
    if (busy || !status.eligible) return;
    setBusy(true);
    try {
      const res = await openBox({ userId });
      setWon(res.reward);
    } catch {
      // eligibility changed underfoot — the query will refresh the card
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPress = () => {
    if (busy || !status.eligible) return;
    setAdVisible(true);
  };

  const handleAdSuccess = () => doOpenBox();

  // Just opened this session — show the prize.
  if (won !== null) {
    return (
      <View style={[styles.card, styles.cardWon, dark && styles.cardDark]}>
        <Text style={styles.emoji}>🎉</Text>
        <View style={styles.info}>
          <Text style={[styles.title, dark && styles.textLight]}>Mystery box opened!</Text>
          <Text style={styles.sub}>You won +{won} pts</Text>
        </View>
      </View>
    );
  }

  if (status.openedToday) {
    return (
      <View style={[styles.card, dark && styles.cardDark]}>
        <Text style={[styles.emoji, styles.dim]}>📦</Text>
        <View style={styles.info}>
          <Text style={[styles.title, dark && styles.textLight]}>Box opened today</Text>
          <Text style={styles.sub}>Come back tomorrow for another</Text>
        </View>
      </View>
    );
  }

  const pct = status.tasksToday / status.needed;

  return (
    <>
      <TouchableOpacity
        activeOpacity={status.eligible ? 0.85 : 1}
        onPress={handleOpenPress}
        style={[styles.card, status.eligible && styles.cardReady, dark && styles.cardDark]}>
        <Text style={styles.emoji}>{status.eligible ? '🎁' : '📦'}</Text>
        <View style={styles.info}>
          <Text style={[styles.title, dark && styles.textLight]}>
            {status.eligible ? 'Daily box ready!' : 'Daily mystery box'}
          </Text>
          {status.eligible ? (
            <Text style={styles.subReady}>Watch video to open · win up to 250 pts</Text>
          ) : (
            <>
              <Text style={styles.sub}>
                {status.tasksToday}/{status.needed} tasks today to unlock
              </Text>
              <View style={[styles.track, dark && styles.trackDark]}>
                <View style={[styles.fill, { width: `${pct * 100}%` }]} />
              </View>
            </>
          )}
        </View>
        {Boolean(status.eligible) ? (
          <View style={styles.openBtn}>
            {!busy ? (
              <Icon name="circle-play" iconStyle="solid" size={12} color={colors.white} />
            ) : null}
            <Text style={styles.openBtnText}>{busy ? '…' : 'Watch Video'}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
      />
    </>
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
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  cardReady: { borderColor: colors.primary, borderWidth: 2 },
  cardWon: { borderColor: colors.success, borderWidth: 2 },
  emoji: { fontSize: 28 },
  dim: { opacity: 0.5 },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  textLight: { color: colors.textDark },
  sub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  subReady: { fontSize: 12.5, color: colors.primaryDeep, marginTop: 2, fontWeight: '700' },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginTop: 8,
    overflow: 'hidden',
  },
  trackDark: { backgroundColor: colors.surfaceAltDark },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.raised,
  },
  openBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
