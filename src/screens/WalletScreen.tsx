import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { openTaskLink } from '../services/TaskLinkService';
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
const VINTA_LOGO = require('../assets/vinta_logo.png');

type AssetKey = 'POINTS' | 'VINTA' | 'PIPRO' | 'SIDRA';

const ASSETS: Record<AssetKey, { label: string; code: string; color: string; icon?: string }> = {
  POINTS: { label: 'Points Balance', code: 'PTS', color: '#FBBF24', icon: 'coins' },
  VINTA: { label: 'VINTA Token', code: 'VINTA', color: '#FBBF24' },
  PIPRO: { label: 'PIPRO Token', code: 'PIPRO', color: '#8B5CF6' },
  SIDRA: { label: 'Sidra Coin', code: 'SIDRA', color: '#34D399', icon: 'shield-halved' },
};

const ASSET_ORDER: AssetKey[] = ['VINTA', 'PIPRO', 'SIDRA', 'POINTS'];

export default function WalletScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const stackNav = useNavigation<StackNav>();

  // Wallet data
  const wallet = useQuery(api.wallets.getOrCreateWallet, userId ? { userId } : 'skip');
  const rate = useQuery(api.wallets.getExchangeRate);
  const platformAddr = useQuery(api.wallets.getPlatformDepositAddress);
  const recentTxs = useQuery(api.wallets.getWalletHistory, userId ? { userId, limit: 7 } : 'skip');

  // Mutations
  const swapPtsToPipro = useMutation(api.wallets.swapPointsToPipro);
  const swapPiproToPts = useMutation(api.wallets.swapPiproToPoints);
  const submitDeposit = useMutation(api.wallets.submitPiproDeposit);
  const requestWithdrawalMutation = useMutation(api.wallets.requestWithdrawal);

  // Modal states
  const [swapModal, setSwapModal] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);

  const [swapDir, setSwapDir] = useState<'pts_to_pipro' | 'pipro_to_pts'>('pts_to_pipro');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);

  const [depositMethod, setDepositMethod] = useState<'payNow' | 'manual'>('payNow');
  const [depositTxSig, setDepositTxSig] = useState('');
  const [depositFromAddr, setDepositFromAddr] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  // Withdrawal States
  const [withdrawAsset, setWithdrawAsset] = useState<'VINTA' | 'PIPRO' | 'SIDRA'>('VINTA');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDestAddr, setWithdrawDestAddr] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Hero balance switcher
  const [activeAsset, setActiveAsset] = useState<AssetKey>('POINTS');

  const getAvailableBalance = (asset: 'VINTA' | 'PIPRO' | 'SIDRA') => {
    if (!wallet) return 0;
    if (asset === 'VINTA') return wallet.vintaBalance ?? 100;
    if (asset === 'PIPRO') return wallet.piproBalance ?? 0;
    if (asset === 'SIDRA') return wallet.sidraBalance ?? 10;
    return 0;
  };

  const getAssetBalance = (key: AssetKey): { display: string; raw: number } => {
    if (!wallet) return { display: '…', raw: 0 };
    switch (key) {
      case 'POINTS': return { display: wallet.pointsBalance.toLocaleString(), raw: wallet.pointsBalance };
      case 'VINTA': return { display: (wallet.vintaBalance ?? 100).toFixed(2), raw: wallet.vintaBalance ?? 100 };
      case 'PIPRO': return { display: (wallet.piproBalance ?? 0).toFixed(4), raw: wallet.piproBalance ?? 0 };
      case 'SIDRA': return { display: (wallet.sidraBalance ?? 10).toFixed(2), raw: wallet.sidraBalance ?? 10 };
    }
  };

  const renderAssetLogo = (key: AssetKey, size: number, radiusStyle?: object) => {
    if (key === 'VINTA') {
      return (
        <Image source={VINTA_LOGO} style={[{ width: size, height: size }, radiusStyle]} resizeMode="cover" />
      );
    }
    if (key === 'PIPRO') {
      return (
        <Image source={PIPRO_LOGO} style={[{ width: size, height: size }, radiusStyle]} resizeMode="contain" />
      );
    }
    return (
      <View
        style={[{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ASSETS[key].color + '22',
        }, radiusStyle]}>
        <Icon name={ASSETS[key].icon!} iconStyle="solid" size={size * 0.42} color={ASSETS[key].color} />
      </View>
    );
  };

  const handleWithdrawal = async () => {
    const numAmount = parseFloat(withdrawAmount) || 0;
    if (!userId || numAmount <= 0 || !withdrawDestAddr.trim()) {
      Alert.alert('Error', 'Enter a valid amount and destination address');
      return;
    }
    const avail = getAvailableBalance(withdrawAsset);
    if (numAmount > avail) {
      Alert.alert('Insufficient Balance', `You only have ${avail} ${withdrawAsset} available.`);
      return;
    }
    setWithdrawLoading(true);
    try {
      await requestWithdrawalMutation({
        userId,
        asset: withdrawAsset,
        amount: numAmount,
        destinationAddress: withdrawDestAddr.trim(),
      });
      Alert.alert(
        'Withdrawal Request Submitted!',
        `Your request to withdraw ${numAmount} ${withdrawAsset} to ${withdrawDestAddr.trim().slice(0, 8)}… has been submitted and is processing.`,
      );
      setWithdrawAmount('');
      setWithdrawDestAddr('');
      setWithdrawModal(false);
    } catch (e: any) {
      Alert.alert('Withdrawal Failed', e.message?.replace('[CONVEX] ', '') ?? String(e));
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Data & Airtime Modal States
  const [vasModal, setVasModal] = useState(false);
  const [vasPaymentMethod, setVasPaymentMethod] = useState<'PIPRO' | 'POINTS'>('PIPRO');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [vasPhone, setVasPhone] = useState('');
  const [vasLoading, setVasLoading] = useState(false);

  const catalogItems = useQuery(api.rewards.listCatalog, userId ? { userId } : 'skip');
  const redeemMutation = useMutation(api.rewards.redeem);

  const handleBuyVas = async () => {
    if (!userId || !selectedCatalogId || !vasPhone.trim()) {
      Alert.alert('Missing Info', 'Select a bundle and enter your phone number.');
      return;
    }
    setVasLoading(true);
    try {
      await redeemMutation({
        userId,
        catalogId: selectedCatalogId as any,
        phoneNumber: vasPhone.trim(),
        paidWith: vasPaymentMethod,
      });
      Alert.alert('Order Submitted!', `Your request for ${vasPhone.trim()} has been submitted and is processing.`);
      setVasModal(false);
      setVasPhone('');
      setSelectedCatalogId('');
    } catch (e: any) {
      Alert.alert('Purchase Failed', e.message?.replace('[CONVEX] ', '') ?? String(e));
    } finally {
      setVasLoading(false);
    }
  };

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
    openTaskLink(solanaPayUrl).catch(() => {
      const phantomUrl = `https://phantom.app/ul/transfer/${platformAddr}?token=${PIPRO_MINT}&amount=${numAmount}`;
      openTaskLink(phantomUrl).catch(() => {
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

  // Activity bar chart derived from the last few wallet transactions.
  const chartBars = (recentTxs ?? []).slice(0, 7).map((tx) => {
    const net = tx.pointsDelta + tx.piproDelta;
    return { val: Math.abs(net), positive: net >= 0 };
  });
  const chartMax = Math.max(...chartBars.map((b) => b.val), 1);
  const active = ASSETS[activeAsset];
  const activeBalance = getAssetBalance(activeAsset);

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="App Wallet" subtitle="Manage your Points & Tokens" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero Gradient Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow1} />
          <View style={styles.heroGlow2} />

          <View style={styles.heroHeaderRow}>
            {renderAssetLogo(activeAsset, 46, styles.heroLogo)}
            <View style={styles.heroTitleCol}>
              <Text style={styles.heroTitle}>{active.label}</Text>
              <Text style={styles.heroSub}>View2Earn Wallet</Text>
            </View>
            {Boolean(rate) ? (
              <View style={styles.heroRateBadge}>
                <Text style={styles.heroRateText}>1 PIPRO = {pointsPerPipro.toLocaleString()} PTS</Text>
              </View>
            ) : null}
          </View>

          {/* Balance Switcher */}
          <View style={styles.switcherRow}>
            {(Object.keys(ASSETS) as AssetKey[]).map((key) => {
              const isActive = key === activeAsset;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.switcherItem, isActive && styles.switcherItemActive]}
                  onPress={() => setActiveAsset(key)}
                  activeOpacity={0.85}>
                  <Text style={[styles.switcherText, isActive && styles.switcherTextActive]}>
                    {ASSETS[key].code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Total Balance */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>TOTAL {active.code} BALANCE</Text>
            <View style={styles.balanceValRow}>
              <Text style={styles.balanceValue}>{activeBalance.display}</Text>
              <Text style={styles.balanceUnit}>{active.code}</Text>
            </View>
            {Boolean(activeAsset === 'POINTS' && pointsPerPipro > 0 && wallet) ? (
              <Text style={styles.balanceHint}>
                ≈ {(wallet!.pointsBalance / pointsPerPipro).toFixed(4)} PIPRO at current rate
              </Text>
            ) : null}
          </View>

          {/* Activity Bar Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartTitleRow}>
              <Icon name="chart-column" iconStyle="solid" size={13} color="#C4B5FD" />
              <Text style={styles.chartTitle}>Recent Activity</Text>
            </View>
            {chartBars.length === 0 ? (
              <Text style={styles.chartEmpty}>No activity yet — start earning!</Text>
            ) : (
              <View style={styles.chartRow}>
                {chartBars.map((bar, i) => {
                  const h = Math.max(6, Math.round((bar.val / chartMax) * 44));
                  return (
                    <View key={i} style={styles.chartCol}>
                      <View
                        style={[
                          styles.chartBar,
                          { height: h },
                          bar.positive ? styles.chartBarPos : styles.chartBarNeg,
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
              onPress={() => setWithdrawModal(true)}
              activeOpacity={0.85}>
              <Icon name="arrow-up-from-bracket" iconStyle="solid" size={14} color="#FFF" />
              <Text style={styles.actionBtnText}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
              onPress={() => { setSwapDir('pts_to_pipro'); setSwapModal(true); }}
              activeOpacity={0.85}>
              <Icon name="arrow-right-arrow-left" iconStyle="solid" size={14} color="#FFF" />
              <Text style={styles.actionBtnText}>Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669' }]}
              onPress={() => setDepositModal(true)}
              activeOpacity={0.85}>
              <Icon name="bolt" iconStyle="solid" size={14} color="#FFF" />
              <Text style={styles.actionBtnText}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
              onPress={() => setVasModal(true)}
              activeOpacity={0.85}>
              <Icon name="mobile" iconStyle="solid" size={14} color="#FFF" />
              <Text style={styles.actionBtnText}>Buy Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Your Assets (List Style) ── */}
        <View style={[styles.glassCard, dark && styles.glassCardDark]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Icon name="coins" iconStyle="solid" size={15} color={colors.primary} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Your Assets</Text>
            </View>
          </View>

          {!wallet ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            ASSET_ORDER.map((key) => {
              const bal = getAssetBalance(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.assetRow}
                  onPress={() => setActiveAsset(key)}
                  activeOpacity={0.7}>
                  {renderAssetLogo(key, 40, styles.assetLogo)}
                  <View style={styles.assetCol}>
                    <Text style={[styles.assetName, dark && styles.textLight]}>{ASSETS[key].label}</Text>
                    <Text style={styles.assetSub}>{key === 'VINTA' ? 'Original Platform Currency' : key === 'PIPRO' ? 'Solana Blockchain Powered' : key === 'SIDRA' ? 'Sidra Chain Coin' : 'Earn by watching ads & quizzes'}</Text>
                  </View>
                  <View style={styles.assetRight}>
                    <Text style={[styles.assetValue, dark && styles.textLight]}>{bal.display}</Text>
                    <Text style={styles.assetCode}>{ASSETS[key].code}</Text>
                  </View>
                  <Icon name="chevron-right" iconStyle="solid" size={13} color={colors.textFaint} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Recent Transactions ── */}
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

        {/* PIPRO Ecosystem Note */}
        <View style={[styles.glassCard, dark && styles.glassCardDark]}>
          <View style={styles.infoHeader}>
            {renderAssetLogo('PIPRO', 30, styles.infoCoinIcon)}
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, dark && styles.textLight]}>PIPRO Token Ecosystem</Text>
              <Text style={styles.infoSub}>Solana Blockchain Powered</Text>
            </View>
          </View>
          <Text style={[styles.infoText, dark && styles.infoTextDark]}>
            PIPRO is the native utility token of the View2Earn community on Solana. You can swap earned points to PIPRO instantly, or deposit PIPRO directly into your app wallet.
          </Text>
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

            {Boolean(rate) ? (
              <Text style={styles.swapRateHint}>
                Current Rate: 1 PIPRO = {pointsPerPipro.toLocaleString()} PTS
              </Text>
            ) : null}

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

      {/* ─── Buy Data & Airtime Modal ─── */}
      <Modal visible={vasModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dark && styles.modalCardDark, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="mobile-screen-button" iconStyle="solid" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, dark && styles.textLight]}>Buy Data &amp; Airtime</Text>
              </View>
              <TouchableOpacity onPress={() => setVasModal(false)}>
                <Icon name="xmark" iconStyle="solid" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Payment Method Switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, vasPaymentMethod === 'PIPRO' && styles.tabActive]}
                onPress={() => setVasPaymentMethod('PIPRO')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Image source={PIPRO_LOGO} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={[styles.tabText, vasPaymentMethod === 'PIPRO' && styles.tabTextActive]}>
                    Pay with PIPRO
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, vasPaymentMethod === 'POINTS' && styles.tabActive]}
                onPress={() => setVasPaymentMethod('POINTS')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="coins" iconStyle="solid" size={14} color="#FBBF24" />
                  <Text style={[styles.tabText, vasPaymentMethod === 'POINTS' && styles.tabTextActive]}>
                    Pay with Points
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240, marginVertical: 10 }}>
              <Text style={styles.depositLabel}>Select Bundle:</Text>
              {!catalogItems ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
              ) : catalogItems.length === 0 ? (
                <Text style={[styles.depositHint, { textAlign: 'center', marginVertical: 10 }]}>
                  No catalog bundles available.
                </Text>
              ) : (
                catalogItems.map((item) => {
                  const selected = selectedCatalogId === item._id;
                  const priceInPipro = item.coinPrice ?? ((item.pointsPrice ?? 500) / (pointsPerPipro || 1000));
                  const displayCost =
                    vasPaymentMethod === 'PIPRO'
                      ? `${priceInPipro.toFixed(4)} PIPRO`
                      : `${item.pointsPrice ?? 0} PTS`;

                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={[
                        styles.bundleItem,
                        dark && styles.bundleItemDark,
                        selected && styles.bundleItemSelected,
                      ]}
                      onPress={() => setSelectedCatalogId(item._id)}
                      activeOpacity={0.8}>
                      <View style={styles.bundleIconWrap}>
                        <Icon
                          name={item.itemType === 'DATA' ? 'wifi' : 'phone'}
                          iconStyle="solid"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bundleName, dark && styles.textLight]}>{item.name}</Text>
                        <Text style={styles.bundleType}>{item.itemType} Bundle</Text>
                      </View>
                      <View style={styles.bundleCostBadge}>
                        <Text style={styles.bundleCostText}>{displayCost}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={{ marginTop: 6 }}>
              <Text style={styles.depositLabel}>Enter Target Phone Number:</Text>
              <TextInput
                style={[styles.swapInput, dark && styles.swapInputDark]}
                value={vasPhone}
                onChangeText={setVasPhone}
                placeholder="e.g. +234 801 234 5678"
                placeholderTextColor={colors.textFaint}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.swapConfirmBtn,
                { backgroundColor: vasPaymentMethod === 'PIPRO' ? colors.primary : '#D97706', marginTop: 14 },
                (vasLoading || !selectedCatalogId || !vasPhone.trim()) && styles.btnDisabled,
              ]}
              onPress={handleBuyVas}
              disabled={vasLoading || !selectedCatalogId || !vasPhone.trim()}
              activeOpacity={0.85}>
              {vasLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon name="bolt" iconStyle="solid" size={15} color="#FFF" />
                  <Text style={styles.swapConfirmText}>Confirm Purchase</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Modern Withdrawal Modal ─── */}
      <Modal visible={withdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, dark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="arrow-up-from-bracket" iconStyle="solid" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, dark && styles.textLight]}>Withdraw Funds</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawModal(false)}>
                <Icon name="xmark" iconStyle="solid" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Asset Selection Tabs: VINTA, PIPRO, SIDRA */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, withdrawAsset === 'VINTA' && styles.tabActive]}
                onPress={() => setWithdrawAsset('VINTA')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {renderAssetLogo('VINTA', 18)}
                  <Text style={[styles.tabText, withdrawAsset === 'VINTA' && styles.tabTextActive]}>
                    VINTA
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, withdrawAsset === 'PIPRO' && styles.tabActive]}
                onPress={() => setWithdrawAsset('PIPRO')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Image source={PIPRO_LOGO} style={{ width: 18, height: 18 }} resizeMode="contain" />
                  <Text style={[styles.tabText, withdrawAsset === 'PIPRO' && styles.tabTextActive]}>
                    PIPRO
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, withdrawAsset === 'SIDRA' && styles.tabActive]}
                onPress={() => setWithdrawAsset('SIDRA')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="shield-halved" iconStyle="solid" size={14} color="#34D399" />
                  <Text style={[styles.tabText, withdrawAsset === 'SIDRA' && styles.tabTextActive]}>
                    SIDRA
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Available Balance Box */}
            <View style={styles.withdrawAvailBox}>
              <Text style={styles.withdrawAvailLabel}>AVAILABLE BALANCE:</Text>
              <Text style={styles.withdrawAvailVal}>
                {getAvailableBalance(withdrawAsset)} {withdrawAsset}
              </Text>
            </View>

            {/* Amount Input with MAX Button */}
            <View style={styles.swapInputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.swapLabel}>Amount to Withdraw</Text>
                <TouchableOpacity
                  onPress={() => setWithdrawAmount(String(getAvailableBalance(withdrawAsset)))}>
                  <Text style={styles.maxBtnText}>MAX</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.swapInput, dark && styles.swapInputDark]}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.textFaint}
              />
            </View>

            {/* Destination Address Input */}
            <View style={styles.swapInputGroup}>
              <Text style={styles.swapLabel}>
                Destination Address ({withdrawAsset === 'PIPRO' ? 'Solana SPL' : withdrawAsset === 'SIDRA' ? 'Sidra Chain EVM' : 'EVM or Solana'}):
              </Text>
              <TextInput
                style={[styles.swapInput, dark && styles.swapInputDark]}
                value={withdrawDestAddr}
                onChangeText={setWithdrawDestAddr}
                placeholder={withdrawAsset === 'PIPRO' ? 'Solana address...' : '0x... or Solana address'}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.feeInfoRow}>
              <Icon name="circle-info" iconStyle="solid" size={13} color={colors.textMuted} />
              <Text style={styles.feeInfoText}>Network Fee: <Text style={{ color: colors.success, fontWeight: '800' }}>0.00 FREE</Text> (Platform Sponsored)</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.swapConfirmBtn,
                (withdrawLoading || !withdrawAmount || !withdrawDestAddr.trim()) && styles.btnDisabled,
              ]}
              onPress={handleWithdrawal}
              disabled={withdrawLoading || !withdrawAmount || !withdrawDestAddr.trim()}
              activeOpacity={0.85}>
              {withdrawLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon name="paper-plane" iconStyle="solid" size={15} color="#FFF" />
                  <Text style={styles.swapConfirmText}>Submit Withdrawal Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Modern Glass & Gradient Styles ─────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // Hero Card (gradient simulated with radial glows over deep indigo)
  heroCard: {
    borderRadius: radius.xl,
    padding: 20,
    backgroundColor: '#1E1B4B',
    marginBottom: 16,
    overflow: 'hidden',
    ...shadow.float,
  },
  heroGlow1: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(139, 92, 246, 0.38)',
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  heroLogo: {
    borderRadius: 14,
    marginRight: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  heroTitleCol: { flex: 1 },
  heroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
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
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FBBF24',
  },

  // Balance Switcher
  switcherRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 16,
    zIndex: 1,
  },
  switcherItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  switcherItemActive: {
    backgroundColor: '#7C3AED',
    ...shadow.raised,
  },
  switcherText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 0.5,
  },
  switcherTextActive: { color: '#FFFFFF' },

  // Total Balance
  balanceRow: {
    zIndex: 1,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  balanceValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  balanceUnit: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FBBF24',
  },
  balanceHint: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '600',
    marginTop: 4,
  },

  // Activity Chart (glass)
  chartCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
    zIndex: 1,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#E9D5FF',
    letterSpacing: 0.3,
  },
  chartEmpty: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 48,
    gap: 8,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: {
    width: '100%',
    maxWidth: 22,
    borderRadius: 5,
  },
  chartBarPos: { backgroundColor: '#34D399' },
  chartBarNeg: { backgroundColor: '#F87171' },

  // Quick Actions
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 1,
  },
  actionBtn: {
    flex: 1,
    minWidth: '22%',
    height: 42,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
    ...shadow.raised,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Glass cards
  glassCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 16,
    ...shadow.card,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.08)',
  },
  glassCardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardDark: { backgroundColor: colors.surfaceDark },

  // Asset rows (list style)
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  assetLogo: {
    borderRadius: 20,
  },
  assetCol: { flex: 1 },
  assetName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
  },
  assetSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  assetRight: { alignItems: 'flex-end' },
  assetValue: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  assetCode: {
    fontSize: 10.5,
    color: colors.textFaint,
    fontWeight: '700',
    marginTop: 1,
  },

  // Info Card
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoCoinIcon: {
    borderRadius: 10,
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
  infoTextDark: { color: '#B7B7C4' },

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
    justifyContent: 'center',
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

  // Withdrawal Modal
  withdrawAvailBox: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  withdrawAvailLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.primary,
    marginBottom: 2,
  },
  withdrawAvailVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  maxBtnText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  feeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  feeInfoText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Bundle Items
  bundleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  bundleItemDark: {
    backgroundColor: colors.surfaceAltDark,
    borderColor: colors.borderDark,
  },
  bundleItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  bundleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  bundleType: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  bundleCostBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  bundleCostText: {
    color: colors.success,
    fontWeight: '800',
    fontSize: 12,
  },
});
