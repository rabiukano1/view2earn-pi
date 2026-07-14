import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { deviceFingerprint } from '../lib/device';
import PageHeader from '../components/PageHeader';
import { colors, radius, shadow } from '../theme';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<Id<'users'> | null>(null);

  const getOrCreateDevUser = useMutation(api.users.getOrCreateDevUser);
  const top = useQuery(api.leaderboard.topEarners, {});
  const myRank = useQuery(api.leaderboard.myRank, userId ? { userId } : 'skip');

  useEffect(() => {
    getOrCreateDevUser({ deviceFingerprint: deviceFingerprint() })
      .then((id) => setUserId(id))
      .catch(() => {});
  }, [getOrCreateDevUser]);

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Leaderboard"
        subtitle="Top earners this week"
        right={
          myRank ? (
            <View style={styles.myRankBadge}>
              <Text style={styles.myRankText}>
                #{myRank.rank ?? '-'} of {myRank.total} · {myRank.balance} pts
              </Text>
            </View>
          ) : undefined
        }
      />
      {top === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={top}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <View style={[styles.row, dark && styles.rowDark, item._id === userId && styles.rowMe]}>
              <View style={styles.rankCol}>
                {index < 3 ? (
                  <Text style={styles.medal}>{MEDAL[index]}</Text>
                ) : (
                  <Text style={styles.rankNum}>#{index + 1}</Text>
                )}
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.name, dark && styles.textLight]}>{item.username}</Text>
                <Text style={styles.ecosystem}>{item.ecosystem}</Text>
              </View>
              <Text style={styles.balance}>{item.balance} pts</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, dark && styles.textMuted]}>No data yet</Text>
            </View>
          }
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  headerSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textFaint },
  myRankBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  myRankText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: colors.textMuted },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  rowDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  rowMe: { borderWidth: 2, borderColor: colors.primary },
  rankCol: { width: 40, alignItems: 'center' },
  medal: { fontSize: 24 },
  rankNum: { fontSize: 16, fontWeight: '800', color: colors.textMuted },
  infoCol: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  ecosystem: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  balance: { fontSize: 16, fontWeight: '800', color: colors.primary },
});
