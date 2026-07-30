import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';

const PIPRO_LOGO = require('../assets/pipro_logo.png');

type Filter = 'all' | 'swaps' | 'deposits' | 'earnings';

const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'swaps', label: 'Swaps', icon: 'arrow-right-arrow-left' },
  { key: 'deposits', label: 'Deposits', icon: 'arrow-down' },
  { key: 'earnings', label: 'Earnings', icon: 'plus' },
];

const txTypeIcon = (type: string) => {
  switch (type) {
    case 'swap_points_to_pipro': return { icon: 'arrow-right-arrow-left', color: '#8B5CF6', label: 'Points → PIPRO', isPipro: true };
    case 'swap_pipro_to_points': return { icon: 'arrow-right-arrow-left', color: '#3B82F6', label: 'PIPRO → Points', isPipro: true };
    case 'deposit_pipro': return { icon: 'arrow-down', color: colors.success, label: 'Deposit PIPRO', isPipro: true };
    case 'earn_points': return { icon: 'plus', color: colors.success, label: 'Earned Points', isPipro: false };
    case 'deduct_points': return { icon: 'minus', color: colors.danger, label: 'Deducted Points', isPipro: false };
    case 'admin_adjust': return { icon: 'shield-halved', color: colors.warn, label: 'Admin Adjustment', isPipro: false };
    default: return { icon: 'circle', color: colors.textMuted, label: type, isPipro: false };
  }
};

function filterMatch(type: string, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'swaps') return type.startsWith('swap_');
  if (filter === 'deposits') return type === 'deposit_pipro';
  if (filter === 'earnings') return type === 'earn_points';
  return true;
}

export default function WalletHistoryScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');

  const allTxs = useQuery(api.wallets.getWalletHistory, userId ? { userId, limit: 200 } : 'skip');
  const deposits = useQuery(api.wallets.getDepositHistory, userId ? { userId } : 'skip');

  const filteredTxs = allTxs?.filter((tx) => filterMatch(tx.type, filter)) ?? [];

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const renderTx = ({ item: tx }: { item: any }) => {
    const meta = txTypeIcon(tx.type);
    return (
      <View style={[styles.txRow, dark && styles.txRowDark]}>
        {meta.isPipro ? (
          <Image source={PIPRO_LOGO} style={styles.txCoinLogo} resizeMode="contain" />
        ) : (
          <View style={[styles.txIconBg, { backgroundColor: meta.color + '1E' }]}>
            <Icon name={meta.icon} iconStyle="solid" size={14} color={meta.color} />
          </View>
        )}
        <View style={styles.txContent}>
          <Text style={[styles.txLabel, dark && styles.textLight]}>{meta.label}</Text>
          {tx.note ? (
            <Text style={styles.txNote} numberOfLines={2}>{tx.note}</Text>
          ) : null}
          <Text style={styles.txDate}>{formatDate(tx._creationTime)}</Text>
        </View>
        <View style={styles.txAmounts}>
          {tx.piproDelta !== 0 && (
            <Text style={[styles.txDelta, tx.piproDelta > 0 ? styles.deltaPos : styles.deltaNeg]}>
              {tx.piproDelta > 0 ? '+' : ''}{tx.piproDelta.toFixed(4)} PIPRO
            </Text>
          )}
          {tx.pointsDelta !== 0 && (
            <Text style={[styles.txDelta, tx.pointsDelta > 0 ? styles.deltaPos : styles.deltaNeg]}>
              {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta.toLocaleString()} PTS
            </Text>
          )}
          <Text style={styles.txBalance}>
            Bal: {tx.pointsBalanceAfter.toLocaleString()} / {tx.piproBalanceAfter.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Wallet History" subtitle="All token & points transactions" />

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}>
            <Icon name={f.icon} iconStyle="solid" size={11} color={filter === f.key ? '#FFF' : colors.textMuted} />
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!allTxs ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredTxs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="inbox" iconStyle="solid" size={36} color={colors.textFaint} />
          <Text style={[styles.emptyTitle, dark && styles.textLight]}>No Transactions</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all' ? 'Your wallet activity will appear here.' : `No ${filter} transactions found.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTxs}
          keyExtractor={(item) => item._id}
          renderItem={renderTx}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Pending Deposits Section */}
      {deposits && deposits.filter((d) => d.status === 'pending').length > 0 && (
        <View style={[styles.pendingBanner, dark && styles.pendingBannerDark]}>
          <Icon name="hourglass-half" iconStyle="solid" size={14} color={colors.warn} />
          <Text style={styles.pendingText}>
            {deposits.filter((d) => d.status === 'pending').length} deposit(s) pending verification
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  filterTextActive: { color: '#FFF' },

  listContent: { paddingHorizontal: 16 },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 14,
    marginBottom: 8, ...shadow.card,
  },
  txRowDark: { backgroundColor: colors.surfaceDark },
  txCoinLogo: {
    width: 36, height: 36, borderRadius: 18,
    marginRight: 12,
  },
  txIconBg: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  txContent: { flex: 1 },
  txLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  textLight: { color: colors.textDark },
  txNote: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  txDate: { fontSize: 10, color: colors.textFaint, marginTop: 3 },
  txAmounts: { alignItems: 'flex-end' },
  txDelta: { fontSize: 13, fontWeight: '800' },
  deltaPos: { color: colors.success },
  deltaNeg: { color: colors.danger },
  txBalance: { fontSize: 10, color: colors.textFaint, marginTop: 3 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16, paddingVertical: 10,
    position: 'absolute', bottom: 80, left: 14, right: 14,
    borderRadius: radius.sm,
    ...shadow.card,
  },
  pendingBannerDark: { backgroundColor: '#78350F' },
  pendingText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
});
