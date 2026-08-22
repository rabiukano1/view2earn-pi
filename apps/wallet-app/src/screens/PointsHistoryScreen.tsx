import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';

const REASON_META: Record<string, { label: string; icon: string }> = {
  TASK_COMPLETED: { label: 'Task completed', icon: '✓' },
  QUIZ_CORRECT: { label: 'Quiz correct', icon: '🧠' },
  SURVEY_COMPLETED: { label: 'Survey completed', icon: '📝' },
  REDEEM: { label: 'Redeemed reward', icon: '🎁' },
  MARKETPLACE_LISTING: { label: 'Marketplace listing', icon: '🏪' },
  MARKETPLACE_REFUND: { label: 'Listing refund', icon: '↩' },
};

function reasonMeta(reason: string): { label: string; icon: string } {
  if (reason.startsWith('AD_REWARD_')) return { label: 'Ad reward', icon: '📺' };
  return REASON_META[reason] ?? { label: reason, icon: '●' };
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export default function PointsHistoryScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();

  const history = useQuery(api.points.history, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');


  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Points History"
        back
        right={
          <View style={styles.balancePill}>
            <Text style={styles.balanceText}>{balance === undefined ? '…' : balance} pts</Text>
          </View>
        }
      />
      {history === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, dark && styles.textLight]}>No activity yet</Text>
          <Text style={styles.emptySub}>Complete tasks to earn points.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const meta = reasonMeta(item.reason);
            const isCredit = item.delta > 0;
            return (
              <View style={[styles.row, dark && styles.rowDark]}>
                <View style={styles.iconCol}>
                  <View style={[styles.iconCircle, isCredit ? styles.iconCredit : styles.iconDebit]}>
                    <Text style={styles.iconText}>{meta.icon}</Text>
                  </View>
                </View>
                <View style={styles.infoCol}>
                  <Text style={[styles.reasonText, dark && styles.textLight]}>{meta.label}</Text>
                  <Text style={styles.timeText}>{formatTime(item._creationTime)}</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={[styles.amountText, isCredit ? styles.amountCredit : styles.amountDebit]}>
                    {isCredit ? '+' : ''}{item.delta}
                  </Text>
                  <Text style={styles.balanceSmall}>
                    {item.balanceAfter} pts
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F5' },
  containerDark: { backgroundColor: '#18181B' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#18181B' },
  textLight: { color: '#FAFAFA' },
  balancePill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  balanceText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#18181B' },
  emptySub: { fontSize: 14, color: '#71717A' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowDark: { backgroundColor: '#27272A' },
  iconCol: { width: 40, alignItems: 'center' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconCredit: { backgroundColor: '#DCFCE7' },
  iconDebit: { backgroundColor: '#FEE2E2' },
  iconText: { fontSize: 16 },
  infoCol: { flex: 1, marginLeft: 12 },
  reasonText: { fontSize: 15, fontWeight: '600', color: '#18181B' },
  timeText: { fontSize: 12, color: '#71717A', marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  amountText: { fontSize: 17, fontWeight: '800' },
  amountCredit: { color: '#16A34A' },
  amountDebit: { color: '#DC2626' },
  balanceSmall: { fontSize: 11, color: '#A1A1AA', marginTop: 1 },
});
