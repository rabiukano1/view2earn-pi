import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, getPalette, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import { reasonMeta } from './PointsHistoryScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Asset'>;

type Row = { key: string; label: string; delta: number; at: number };

const TX_LABEL: Record<string, string> = {
  swap_points_to_pipro: 'Swapped from points',
  swap_pipro_to_points: 'Swapped to points',
  deposit_pipro: 'Deposit',
  withdraw_pipro: 'Withdrawal',
  withdraw_vinta: 'Withdrawal',
};

function fmt(n: number, asset: string) {
  return asset === 'POINTS' ? n.toLocaleString() : n.toFixed(4);
}

// One screen for every asset: the balance, a "where it came from" breakdown
// (net per source), and the full movement list. Points read the ledger
// (reason-tagged); VINTA/PIPRO read wallet transactions.
export default function AssetScreen({ route }: Props) {
  const { asset } = route.params;
  const dark = useColorScheme() === 'dark';
  const p = getPalette(dark);
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const wallet = useQuery(api.wallets.getOrCreateWallet, userId ? { userId } : 'skip');
  const ledger = useQuery(api.points.history, userId && asset === 'POINTS' ? { userId, limit: 500 } : 'skip');
  const txs = useQuery(api.wallets.getWalletHistory, userId && asset !== 'POINTS' ? { userId, limit: 500 } : 'skip');

  const balance =
    !wallet ? null
    : asset === 'POINTS' ? wallet.pointsBalance
    : asset === 'PIPRO' ? wallet.piproBalance
    : wallet.vintaBalance ?? 100;

  const rows: Row[] | null =
    asset === 'POINTS'
      ? ledger?.map((l) => ({ key: l._id, label: reasonMeta(l.reason).label, delta: l.delta, at: l._creationTime })) ?? null
      : txs
          ?.map((t) => ({
            key: t._id,
            label: TX_LABEL[t.type] ?? t.type.replace(/_/g, ' '),
            // ponytail: VINTA has no delta column; its only movement is
            // withdrawal, whose amount lives in the note. Add a column if VINTA
            // ever gets earned/deposited.
            delta:
              asset === 'PIPRO' ? t.piproDelta
              : t.type === 'withdraw_vinta' ? -Number(t.note?.match(/of ([\d.]+) VINTA/)?.[1] ?? 0)
              : 0,
            at: t._creationTime,
          }))
          .filter((r) => r.delta !== 0) ?? null;

  const sources = rows
    ? Object.entries(
        rows.reduce<Record<string, number>>((acc, r) => {
          acc[r.label] = (acc[r.label] ?? 0) + r.delta;
          return acc;
        }, {}),
      ).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    : null;

  const code = asset === 'POINTS' ? 'PTS' : asset;

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <PageHeader title={asset === 'POINTS' ? 'Points' : `${asset} Token`} subtitle="Balance & where it came from" back />
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>BALANCE</Text>
              <Text style={styles.heroValue}>{balance === null ? '…' : fmt(balance, asset)} <Text style={styles.heroUnit}>{code}</Text></Text>
              {asset === 'VINTA' ? <Text style={styles.heroHint}>Includes your 100 VINTA welcome balance</Text> : null}
            </View>

            <Text style={[styles.section, { color: p.text }]}>Where it came from</Text>
            <View style={[styles.card, { backgroundColor: p.surface }, !dark && shadow.card]}>
              {!sources ? (
                <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
              ) : sources.length === 0 ? (
                <Text style={[styles.empty, { color: p.textMuted }]}>No movements yet</Text>
              ) : (
                sources.map(([label, net], i) => (
                  <View key={label} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                    <Text style={[styles.rowLabel, { color: p.text }]}>{label}</Text>
                    <Text style={[styles.rowValue, net >= 0 ? styles.pos : styles.neg]}>
                      {net > 0 ? '+' : ''}{fmt(net, asset)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <Text style={[styles.section, { color: p.text }]}>All movements</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.txRow,
              { backgroundColor: p.surface },
              index === 0 && styles.txFirst,
              index === (rows?.length ?? 0) - 1 && styles.txLast,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: p.text }]}>{item.label}</Text>
              <Text style={[styles.time, { color: p.textMuted }]}>{new Date(item.at).toLocaleString()}</Text>
            </View>
            <Text style={[styles.rowValue, item.delta >= 0 ? styles.pos : styles.neg]}>
              {item.delta > 0 ? '+' : ''}{fmt(item.delta, asset)} {code}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          rows ? <Text style={[styles.empty, { color: p.textMuted }]}>Nothing yet</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { backgroundColor: '#1E1B4B', borderRadius: 24, padding: 22, marginBottom: 20, ...shadow.float },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroValue: { color: '#FFF', fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  heroUnit: { fontSize: 16, color: '#FBBF24' },
  heroHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginTop: 6 },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  card: { borderRadius: 20, paddingHorizontal: 16, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  rowLabel: { fontSize: 14.5, fontWeight: '700' },
  rowValue: { fontSize: 14.5, fontWeight: '800' },
  pos: { color: colors.success },
  neg: { color: colors.danger },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  txFirst: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  txLast: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  time: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  empty: { textAlign: 'center', padding: 20, fontWeight: '600' },
});
