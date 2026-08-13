import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import PageHeader from '../components/PageHeader';
import { openInPiBrowser } from '../lib/openUrl';
import { PI_APP_URL } from '../config';

type CatalogItem = {
  _id: Id<'catalog'>;
  name: string;
  itemType: string;
  pointsPrice?: number;
};

const STATUS_COLORS: Record<string, string> = {
  processing: '#F59E0B',
  fulfilled: '#10B981',
  failed: '#EF4444',
  refunded: '#6B7280',
};

export default function RewardsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const me = useQuery(api.users.me);
  const isPiLinked = me?.ecosystem === 'PI';
  const redeem = useMutation(api.rewards.redeem);
  const createLinkToken = useMutation(api.piLink.createLinkToken);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const catalog = useQuery(api.rewards.listCatalog, userId ? { userId } : 'skip');
  const redemptions = useQuery(
    api.rewards.listMyRedemptions,
    userId ? { userId } : 'skip',
  );


  const openRedeem = (item: CatalogItem) => {
    setSelected(item);
    setPhone('');
  };

  const confirmRedeem = async () => {
    if (!userId || !selected) return;
    setSubmitting(true);
    try {
      await redeem({ userId, catalogId: selected._id, phoneNumber: phone });
      setSelected(null);
      Alert.alert('Redeemed', `${selected.name} is being processed.`);
    } catch (e) {
      Alert.alert('Could not redeem', String(e).replace('[CONVEX] ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  const linkPi = async () => {
    try {
      const token = await createLinkToken();
      const url = `${PI_APP_URL}/link?token=${encodeURIComponent(token)}`;
      await openInPiBrowser(url);
    } catch (e) {
      Alert.alert('Could not start verification', String(e).replace('[CONVEX] ', ''));
    }
  };

  const bal = balance ?? 0;

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Rewards"
        subtitle="Redeem your points"
        right={
          <View style={styles.balancePill}>
            <Text style={styles.balanceText}>
              {balance === undefined ? '…' : bal} pts
            </Text>
          </View>
        }
      />

      {!isPiLinked && (
        <View style={styles.linkBanner}>
          <Text style={styles.linkBannerTitle}>Link Pi to redeem</Text>
          <Text style={styles.linkBannerText}>
            Airtime & data redemptions require a verified Pi account. Sign in
            with Pi inside the Pi Browser to unlock the redeemable balance.
          </Text>
          <TouchableOpacity style={styles.linkBtn} onPress={linkPi} activeOpacity={0.85}>
            <Text style={styles.linkBtnText}>Open Pi Browser to verify</Text>
          </TouchableOpacity>
        </View>
      )}

      {catalog === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyTitle, dark && styles.textLight]}>
                No rewards available
              </Text>
              <Text style={styles.headerSubtitle}>Check back soon.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const price = item.pointsPrice ?? 0;
            const affordable = bal >= price;
            return (
              <View style={[styles.card, dark && styles.cardDark]}>
                <View style={styles.cardLeft}>
                  <View
                    style={[
                      styles.iconBox,
                      item.itemType === 'DATA' ? styles.dataIcon : styles.airtimeIcon,
                    ]}>
                    <Text style={styles.iconText}>
                      {item.itemType === 'DATA' ? 'D' : 'A'}
                    </Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, dark && styles.textLight]}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardType}>
                      {item.itemType === 'DATA' ? 'Data Bundle' : 'Airtime Top-up'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.redeemBtn, !affordable && styles.redeemBtnOff]}
                  disabled={!affordable}
                  onPress={() => (isPiLinked ? openRedeem(item) : linkPi())}>
                  <Text style={[styles.redeemBtnText, !affordable && styles.redeemBtnTextOff]}>
                    {affordable ? `${price} pts` : `${price} pts`}
                  </Text>
                  <Text style={[styles.redeemBtnSub, !affordable && styles.redeemBtnTextOff]}>
                    {isPiLinked ? (affordable ? 'Redeem' : 'Locked') : 'Link Pi'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={
            redemptions && redemptions.length > 0 ? (
              <View style={styles.historySection}>
                <Text style={[styles.sectionTitle, dark && styles.textLight]}>
                  Your redemptions
                </Text>
                {redemptions.map((r) => (
                  <View key={r._id} style={[styles.historyRow, dark && styles.cardDark]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyName, dark && styles.textLight]}>
                        {r.name}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {r.phoneNumber} · {r.amount} pts
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: (STATUS_COLORS[r.status] ?? '#6B7280') + '22' },
                      ]}>
                      <Text
                        style={[
                          styles.statusText,
                          { color: STATUS_COLORS[r.status] ?? '#6B7280' },
                        ]}>
                        {r.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        />
      )}

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, dark && styles.cardDark]}>
            <Text style={[styles.modalTitle, dark && styles.textLight]}>
              Redeem {selected?.name}
            </Text>
            <Text style={styles.modalSub}>
              {selected?.pointsPrice} pts will be deducted. Enter the phone number to top up.
            </Text>
            <TextInput
              style={[styles.input, dark && styles.inputDark]}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 08012345678"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setSelected(null)}
                disabled={submitting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmRedeem}
                disabled={submitting}>
                <Text style={styles.modalConfirmText}>
                  {submitting ? 'Redeeming…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  headerSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  balancePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  balanceText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  textLight: { color: colors.textDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataIcon: { backgroundColor: '#3B82F6' },
  airtimeIcon: { backgroundColor: colors.success },
  iconText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  cardBody: { marginLeft: 12, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardType: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  redeemBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    minWidth: 80,
  },
  redeemBtnOff: { backgroundColor: colors.surfaceAlt },
  redeemBtnText: { color: colors.primaryDeep, fontSize: 15, fontWeight: '800' },
  redeemBtnSub: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  redeemBtnTextOff: { color: colors.textFaint },
  historySection: { marginTop: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  historyRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyName: { fontSize: 14, fontWeight: '700', color: colors.text },
  historyMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    ...shadow.float,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, marginBottom: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  inputDark: { borderColor: colors.borderDark, color: colors.textDark, backgroundColor: colors.surfaceAltDark },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  modalCancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  modalConfirm: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  modalConfirmText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  linkBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#2A2210',
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A3A20',
  },
  linkBannerTitle: { color: '#F59E0B', fontWeight: '800', fontSize: 15 },
  linkBannerText: { color: '#8A8A9E', fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  linkBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    ...shadow.raised,
  },
  linkBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
