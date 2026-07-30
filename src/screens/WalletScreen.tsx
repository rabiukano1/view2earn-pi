import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Linking,
  Modal,
  ScrollView,
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
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

const PIPRO_MINT = '7hU4hrLtr2dxGDBy56HQo6NF2u19FA1k4rM8nJQ5ceFk';
const PIPRO_LOGO = require('../assets/pipro_logo.png');

export default function WalletScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const stackNav = useNavigation<StackNav>();

  // Wallet data
  const wallet = useQuery(api.wallets.getOrCreateWallet, userId ? { userId } : 'skip');
  const rate = useQuery(api.wallets.getExchangeRate);
  const platformAddr = useQuery(api.wallets.getPlatformDepositAddress);
  const recentTxs = useQuery(api.wallets.getWalletHistory, userId ? { userId, limit: 5 } : 'skip');

  // Mutations
  const swapPtsToPipro = useMutation(api.wallets.swapPointsToPipro);
  const swapPiproToPts = useMutation(api.wallets.swapPiproToPoints);
  const submitDeposit = useMutation(api.wallets.submitPiproDeposit);

  // Modal states
  const [swapModal, setSwapModal] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [swapDir, setSwapDir] = useState<'pts_to_pipro' | 'pipro_to_pts'>('pts_to_pipro');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);

  const [depositMethod, setDepositMethod] = useState<'payNow' | 'manual'>('payNow');
  const [depositTxSig, setDepositTxSig] = useState('');
  const [depositFromAddr, setDepositFromAddr] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const pointsPerPipro = rate?.pointsPerPipro ?? 0;

  // Swap calculation
  const swapNumericAmount = parseFloat(swapAmount) || 0;
  const swapReceive =
    swapDir === 'pts_to_pipro'
      ? pointsPerPipro > 0 ? (swapNumericAmount / pointsPerPipro).toFixed(4) : '0'
      : (swapNumericAmount * pointsPerPipro).toFixed(0);

  const handleSwap = async () => {
    if (!userId || swapNumericAmount <= 0) return;
    setSwapLoading(true);
    try {
      if (swapDir === 'pts_to_pipro') {
        await swapPtsToPipro({ userId, pointsAmount: swapNumericAmount });
      } else {
        await swapPiproToPts({ userId, piproAmount: swapNumericAmount });
      }
      Alert.alert('Swap Complete', `Successfully swapped!`);
      setSwapAmount('');
      setSwapModal(false);
    } catch (e: any) {
      Alert.alert('Swap Failed', e.message?.replace('[CONVEX] ', '') ?? String(e));
    } finally {
      setSwapLoading(false);
    }
  };

  const handlePayNow = () => {
    if (!platformAddr) {
      Alert.alert('Error', 'Platform deposit address not configured. Contact admin.');
      return;
    }
    const numAmount = parseFloat(depositAmount) || 0;
    if (numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    const solanaPayUrl = `solana:${platformAddr}?spl-token=${PIPRO_MINT}&amount=${numAmount}&label=PIPRO%20Deposit&message=View2Earn%20Deposit`;
    Linking.openURL(solanaPayUrl).catch(() => {
      const phantomUrl = `https://phantom.app/ul/transfer/${platformAddr}?token=${PIPRO_MINT}&amount=${numAmount}`;
      Linking.openURL(phantomUrl).catch(() => {
        Alert.alert('No Wallet Found', 'Install Phantom, Solflare, or another Solana wallet app.');
      });
    });
  };

  const handleManualDeposit = async () => {
    if (!userId || !depositTxSig.trim()) {
      Alert.alert('Error', 'Paste your transaction signature');
      return;
    }
    setDepositLoading(true);
    try {
      await submitDeposit({
        userId,
        txSignature: depositTxSig.trim(),
        fromAddress: depositFromAddr.trim() || 'unknown',
      });
      Alert.alert(
        'Deposit Submitted',
        'Your deposit is being verified on-chain. You will be credited once confirmed.',
      );
      setDepositTxSig('');
      setDepositFromAddr('');
      setDepositModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message?.replace('[CONVEX] ', '') ?? String(e));
    } finally {
      setDepositLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', text);
  };

  const txTypeMeta = (type: string) => {
    switch (type) {
      case 'swap_points_to_pipro': return { icon: 'arrow-right-arrow-left', color: '#8B5CF6', isPipro: true };
      case 'swap_pipro_to_points': return { icon: 'arrow-right-arrow-left', color: '#3B82F6', isPipro: true };
      case 'deposit_pipro': return { icon: 'arrow-down', color: colors.success, isPipro: true };
      case 'earn_points': return { icon: 'plus', color: colors.success, isPipro: false };
      case 'deduct_points': return { icon: 'minus', color: colors.danger, isPipro: false };
      case 'admin_adjust': return { icon: 'shield-halved', color: colors.warn, isPipro: false };
      default: return { icon: 'circle', color: colors.textMuted, isPipro: false };
    }
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="App Wallet" subtitle="Manage your Points & PIPRO Tokens" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}>

        {/* Hero PIPRO Showcase Card */}
        <View style={styles.heroPiproCard}>
          <View style={styles.heroCardHeader}>
            <Image source={PIPRO_LOGO} style={styles.heroPiproLogo} resizeMode="contain" />
            <View style={styles.heroPiproTitleCol}>
              <Text style={styles.heroPiproTag}>PIPRO TOKEN</Text>
              <Text style={styles.heroPiproSub}>P2P Community Currency</Text>
            </View>
            {rate && (
              <View style={styles.heroRateBadge}>
                <Text style={styles.heroRateText}>1 PIPRO = {pointsPerPipro.toLocaleString()} PTS</Text>
              </View>
            )}
          </View>

          <View style={styles.heroBalanceContainer}>
            <View style={styles.heroBalCol}>
              <Text style={styles.heroBalLabel}>PIPRO BALANCE</Text>
              <View style={styles.heroBalValRow}>
                <Image source={PIPRO_LOGO} style={styles.miniCoinIcon} resizeMode="contain" />
                <Text style={styles.heroBalValue}>
                  {wallet === undefined ? '…' : wallet.piproBalance.toFixed(4)}
                </Text>
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroBalCol}>
              <Text style={styles.heroBalLabel}>POINTS BALANCE</Text>
              <View style={styles.heroBalValRow}>
                <Icon name="coins" iconStyle="solid" size={16} color="#FBBF24" />
                <Text style={styles.heroBalValue}>
                  {wallet === undefined ? '…' : wallet.pointsBalance.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Action Buttons Inside Hero */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={[styles.heroBtn, styles.heroSwapBtn]}
              onPress={() => { setSwapDir('pts_to_pipro'); setSwapModal(true); }}
              activeOpacity={0.85}>
              <Icon name="arrow-right-arrow-left" iconStyle="solid" size={15} color="#FFF" />
              <Text style={styles.heroBtnText}>Instant Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroBtn, styles.heroDepositBtn]}
              onPress={() => setDepositModal(true)}
              activeOpacity={0.85}>
              <Icon name="bolt" iconStyle="solid" size={15} color="#FFF" />
              <Text style={styles.heroBtnText}>Deposit PIPRO</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PIPRO Token Features Showcase */}
        <View style={[styles.infoCard, dark && styles.cardDark]}>
          <View style={styles.infoHeader}>
            <Image source={PIPRO_LOGO} style={styles.infoCoinIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, dark && styles.textLight]}>PIPRO Token Ecosystem</Text>
              <Text style={styles.infoSub}>Solana Blockchain Powered</Text>
            </View>
          </View>
          <Text style={styles.infoText}>
            PIPRO is the native utility token of the View2Earn community on Solana. You can swap earned points to PIPRO instantly, or deposit PIPRO directly into your app wallet.
          </Text>
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Icon name="clock-rotate-left" iconStyle="solid" size={15} color={colors.primary} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Recent Transactions</Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => stackNav.navigate('WalletHistory')}
              activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="chevron-right" iconStyle="solid" size={11} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {!recentTxs ? (
            <View style={[styles.emptyCard, dark && styles.cardDark]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recentTxs.length === 0 ? (
            <View style={[styles.emptyCard, dark && styles.cardDark]}>
              <Icon name="inbox" iconStyle="solid" size={24} color={colors.textFaint} />
              <Text style={styles.emptyText}>No wallet activity yet</Text>
            </View>
          ) : (
            recentTxs.map((tx) => {
              const meta = txTypeMeta(tx.type);
              return (
                <View key={tx._id} style={[styles.txRow, dark && styles.cardDark]}>
                  {meta.isPipro ? (
                    <Image source={PIPRO_LOGO} style={styles.txCoinLogo} resizeMode="contain" />
                  ) : (
                    <View style={[styles.txIconBg, { backgroundColor: meta.color + '1E' }]}>
                      <Icon name={meta.icon} iconStyle="solid" size={14} color={meta.color} />
                    </View>
                  )}
                  <View style={styles.txContent}>
                    <Text style={[styles.txType, dark && styles.textLight]}>
                      {tx.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                    <Text style={styles.txNote} numberOfLines={1}>
                      {tx.note ?? ''}
                    </Text>
                  </View>
                  <View style={styles.txAmounts}>
                    {tx.piproDelta !== 0 && (
                      <Text style={[styles.txDelta, tx.piproDelta > 0 ? styles.deltaPos : styles.deltaNeg]}>
                        {tx.piproDelta > 0 ? '+' : ''}{tx.piproDelta.toFixed(4)} PIPRO
                      </Text>
                    )}
                    {tx.pointsDelta !== 0 && (
                      <Text style={[styles.txDelta, tx.pointsDelta > 0 ? styles.deltaPos : styles.deltaNeg]}>
                        {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta} PTS
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─── Swap Modal ─── */}
      <Modal visible={swapModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Image source={PIPRO_LOGO} style={{ width: 28, height: 28 }} resizeMode="contain" />
                <Text style={[styles.modalTitle, dark && styles.textLight]}>Instant Swap</Text>
              </View>
              <TouchableOpacity onPress={() => setSwapModal(false)}>
                <Icon name="xmark" iconStyle="solid" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Direction Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, swapDir === 'pts_to_pipro' && styles.tabActive]}
                onPress={() => { setSwapDir('pts_to_pipro'); setSwapAmount(''); }}>
                <Text style={[styles.tabText, swapDir === 'pts_to_pipro' && styles.tabTextActive]}>
                  Points → PIPRO
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, swapDir === 'pipro_to_pts' && styles.tabActive]}
                onPress={() => { setSwapDir('pipro_to_pts'); setSwapAmount(''); }}>
                <Text style={[styles.tabText, swapDir === 'pipro_to_pts' && styles.tabTextActive]}>
                  PIPRO → Points
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.swapInputGroup}>
              <Text style={styles.swapLabel}>
                {swapDir === 'pts_to_pipro' ? 'Points to swap' : 'PIPRO to swap'}
              </Text>
              <TextInput
                style={[styles.swapInput, dark && styles.swapInputDark]}
                value={swapAmount}
                onChangeText={setSwapAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
              />
            </View>

            <View style={styles.swapReceiveRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {swapDir === 'pts_to_pipro' ? (
                  <Image source={PIPRO_LOGO} style={{ width: 20, height: 20 }} resizeMode="contain" />
                ) : (
                  <Icon name="coins" iconStyle="solid" size={16} color="#FBBF24" />
                )}
                <Text style={styles.swapReceiveLabel}>You receive:</Text>
              </View>
              <Text style={styles.swapReceiveValue}>
                {swapReceive} {swapDir === 'pts_to_pipro' ? 'PIPRO' : 'PTS'}
              </Text>
            </View>

            {rate && (
              <Text style={styles.swapRateHint}>
                Current Rate: 1 PIPRO = {pointsPerPipro.toLocaleString()} PTS
              </Text>
            )}

            <TouchableOpacity
              style={[styles.swapConfirmBtn, swapLoading && styles.btnDisabled]}
              onPress={handleSwap}
              disabled={swapLoading || swapNumericAmount <= 0}
              activeOpacity={0.85}>
              {swapLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon name="arrow-right-arrow-left" iconStyle="solid" size={15} color="#FFF" />
                  <Text style={styles.swapConfirmText}>Swap Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Deposit Modal ─── */}
      <Modal visible={depositModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Image source={PIPRO_LOGO} style={{ width: 32, height: 32 }} resizeMode="contain" />
                <Text style={[styles.modalTitle, dark && styles.textLight]}>Deposit PIPRO</Text>
              </View>
              <TouchableOpacity onPress={() => setDepositModal(false)}>
                <Icon name="xmark" iconStyle="solid" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Method Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, depositMethod === 'payNow' && styles.tabActive]}
                onPress={() => setDepositMethod('payNow')}>
                <Text style={[styles.tabText, depositMethod === 'payNow' && styles.tabTextActive]}>
                  ⚡ Pay Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, depositMethod === 'manual' && styles.tabActive]}
                onPress={() => setDepositMethod('manual')}>
                <Text style={[styles.tabText, depositMethod === 'manual' && styles.tabTextActive]}>
                  📋 Manual
                </Text>
              </TouchableOpacity>
            </View>

            {depositMethod === 'payNow' ? (
              <View style={styles.depositSection}>
                <Text style={styles.depositHint}>
                  Enter the amount of PIPRO to deposit, then tap "Pay Now" to open your Solana wallet app (Phantom, Solflare, etc.).
                </Text>
                <TextInput
                  style={[styles.swapInput, dark && styles.swapInputDark]}
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  keyboardType="numeric"
                  placeholder="Amount of PIPRO"
                  placeholderTextColor={colors.textFaint}
                />
                <TouchableOpacity
                  style={styles.payNowBtn}
                  onPress={handlePayNow}
                  activeOpacity={0.85}>
                  <Image source={PIPRO_LOGO} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  <Text style={styles.payNowText}>Pay Now with Wallet</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.depositLabel}>Paste transaction signature after payment:</Text>
                <TextInput
                  style={[styles.swapInput, dark && styles.swapInputDark]}
                  value={depositTxSig}
                  onChangeText={setDepositTxSig}
                  placeholder="Transaction signature..."
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.submitDepositBtn, depositLoading && styles.btnDisabled]}
                  onPress={handleManualDeposit}
                  disabled={depositLoading}
                  activeOpacity={0.85}>
                  {depositLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Icon name="paper-plane" iconStyle="solid" size={14} color="#FFF" />
                      <Text style={styles.submitDepositText}>Submit for Verification</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.depositSection}>
                <Text style={styles.depositHint}>
                  Send PIPRO tokens to the platform deposit address below. Then paste your transaction signature.
                </Text>

                {platformAddr ? (
                  <TouchableOpacity
                    style={[styles.addrCard, dark && styles.addrCardDark]}
                    onPress={() => copyToClipboard(platformAddr)}
                    activeOpacity={0.7}>
                    <Text style={styles.addrLabel}>Platform Deposit Address (Solana):</Text>
                    <Text style={[styles.addrValue, dark && styles.textLight]} numberOfLines={2}>
                      {platformAddr}
                    </Text>
                    <View style={styles.copyRow}>
                      <Icon name="copy" iconStyle="solid" size={12} color={colors.primary} />
                      <Text style={styles.copyText}>Tap to copy address</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.warningBox}>
                    <Icon name="triangle-exclamation" iconStyle="solid" size={14} color={colors.warn} />
                    <Text style={styles.warningText}>
                      Platform deposit address not configured. Contact admin.
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.depositLabel}>Your Solana sender address (optional):</Text>
                <TextInput
                  style={[styles.swapInput, dark && styles.swapInputDark]}
                  value={depositFromAddr}
                  onChangeText={setDepositFromAddr}
                  placeholder="Sender wallet address"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.depositLabel}>Transaction signature:</Text>
                <TextInput
                  style={[styles.swapInput, dark && styles.swapInputDark]}
                  value={depositTxSig}
                  onChangeText={setDepositTxSig}
                  placeholder="Paste tx signature..."
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[styles.submitDepositBtn, depositLoading && styles.btnDisabled]}
                  onPress={handleManualDeposit}
                  disabled={depositLoading}
                  activeOpacity={0.85}>
                  {depositLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Icon name="paper-plane" iconStyle="solid" size={14} color="#FFF" />
                      <Text style={styles.submitDepositText}>Submit for Verification</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Modern Futuristic Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // Hero Card
  heroPiproCard: {
    borderRadius: radius.xl,
    padding: 20,
    backgroundColor: '#1E1B4B',
    marginBottom: 16,
    ...shadow.float,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroPiproLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  heroPiproTitleCol: { flex: 1 },
  heroPiproTag: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  heroPiproSub: {
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '600',
    marginTop: 2,
  },
  heroRateBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  heroRateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },

  heroBalanceContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroBalCol: { flex: 1 },
  heroBalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroBalValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniCoinIcon: {
    width: 20,
    height: 20,
  },
  heroBalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 14,
  },

  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.raised,
  },
  heroSwapBtn: {
    backgroundColor: '#7C3AED',
  },
  heroDepositBtn: {
    backgroundColor: '#059669',
  },
  heroBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 18,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoCoinIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  infoSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
  },

  // Section
  sectionContainer: { marginBottom: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  textLight: { color: colors.textDark },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  // Transaction rows
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    ...shadow.card,
  },
  txCoinLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 12,
  },
  txIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justify: 'center',
    marginRight: 12,
  },
  txContent: { flex: 1 },
  txType: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  txNote: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txAmounts: { alignItems: 'flex-end' },
  txDelta: { fontSize: 13, fontWeight: '800' },
  deltaPos: { color: colors.success },
  deltaNeg: { color: colors.danger },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    ...shadow.card,
  },
  emptyText: { fontSize: 13, color: colors.textMuted },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalCardDark: { backgroundColor: colors.surfaceDark },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 19, fontWeight: '900', color: colors.text },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, ...shadow.raised },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: '#FFF' },

  // Swap
  swapInputGroup: { marginBottom: 14 },
  swapLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  swapInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  swapInputDark: { backgroundColor: colors.surfaceAltDark, color: colors.textDark },
  swapReceiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: 14,
  },
  swapReceiveLabel: { fontSize: 13, fontWeight: '700', color: colors.success },
  swapReceiveValue: { fontSize: 17, fontWeight: '900', color: colors.success },
  swapRateHint: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  swapConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  swapConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },

  // Deposit
  depositSection: { marginTop: 4 },
  depositHint: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginBottom: 14 },
  depositLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6, marginTop: 8 },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: '#D97706',
    ...shadow.raised,
  },
  payNowText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  submitDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    ...shadow.raised,
    marginTop: 12,
  },
  submitDepositText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },

  // Address card
  addrCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  addrCardDark: { backgroundColor: colors.surfaceAltDark },
  addrLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  addrValue: { fontSize: 13, fontFamily: 'monospace', color: colors.text, marginBottom: 8 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

  // Warning
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  warningText: { fontSize: 12, color: '#92400E', flex: 1, fontWeight: '600' },
});
