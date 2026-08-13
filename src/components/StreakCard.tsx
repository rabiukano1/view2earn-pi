import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { colors, radius, shadow } from '../theme';
import Icon from './Icon';
import RewardedAdModal from './RewardedAdModal';

export default function StreakCard({ userId }: { userId: Id<'users'> }) {
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const streak = useQuery(api.streaks.getStreak, { userId });
  const checkIn = useMutation(api.streaks.checkIn);

  if (!streak) return null;

  const doCheckIn = async () => {
    if (busy || !streak.canCheckIn) return;
    setBusy(true);
    try {
      const res = await checkIn({ userId });
      Alert.alert('Checked in! 🔥', `+${res.reward} pts · ${res.current} day streak`);
    } catch (e) {
      Alert.alert('Check-in', String(e).replace('[CONVEX] ', ''));
    } finally {
      setBusy(false);
    }
  };

  const onCheckInPress = () => {
    if (busy || !streak.canCheckIn) return;
    setAdVisible(true);
  };

  const handleAdSuccess = () => doCheckIn();

  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.top}>
        <View style={styles.flameWrap}>
          <Text style={styles.flame}>🔥</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.streakNum, dark && styles.textLight]}>
            {streak.current} day{streak.current === 1 ? '' : 's'}
          </Text>
          <Text style={styles.streakLabel}>
            {streak.checkedInToday
              ? 'Checked in today · come back tomorrow'
              : `Watch video to check in (+${streak.todayReward} pts)`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, (!streak.canCheckIn || busy) && styles.btnOff]}
          disabled={!streak.canCheckIn || busy}
          onPress={onCheckInPress}>
          <View style={styles.btnRow}>
            {Boolean(streak.canCheckIn && !busy && !streak.checkedInToday) ? (
              <Icon name="circle-play" iconStyle="solid" size={12} color={colors.white} />
            ) : null}
            <Text style={[styles.btnText, (!streak.canCheckIn || busy) && styles.btnTextOff]}>
              {streak.checkedInToday ? '✓ Done' : busy ? '…' : 'Check in'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.dots}>
        {streak.schedule.map((pts, i) => {
          const day = i + 1;
          const reached = day <= streak.cycleDay && streak.checkedInToday;
          const isToday = day === streak.cycleDay && !streak.checkedInToday;
          return (
            <View key={day} style={styles.dotCol}>
              <View
                style={[
                  styles.dot,
                  reached && styles.dotReached,
                  isToday && styles.dotToday,
                ]}>
                <Text
                  style={[
                    styles.dotDay,
                    isToday && styles.dotDayToday,
                    reached && styles.dotDayReached,
                  ]}>
                  {day}
                </Text>
              </View>
              <Text style={styles.dotPts}>{pts}</Text>
            </View>
          );
        })}
      </View>
      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  top: { flexDirection: 'row', alignItems: 'center' },
  flameWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: { fontSize: 24 },
  info: { flex: 1, marginHorizontal: 12 },
  streakNum: { fontSize: 18, fontWeight: '800', color: colors.text },
  streakLabel: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  textLight: { color: colors.textDark },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow.raised,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnOff: { backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  btnTextOff: { color: colors.textFaint },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  dotCol: { alignItems: 'center', gap: 4 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotReached: { backgroundColor: colors.primary },
  dotToday: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary },
  dotDay: { fontSize: 12, fontWeight: '800', color: colors.textFaint },
  dotDayToday: { color: colors.primaryDeep },
  dotDayReached: { color: colors.white },
  dotPts: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
});
