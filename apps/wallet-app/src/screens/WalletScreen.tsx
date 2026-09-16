import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { openTaskLink } from '../services/TaskLinkService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, getPalette, radius, shadow } from '../theme';
import type { Palette } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import Icon from '../components/Icon';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

const PIPRO_MINT = '7hU4hrLtr2dxGDBy56HQo6NF2u19FA1k4rM8nJQ5ceFk';
const PIPRO_LOGO = require('../assets/pipro_logo.png');
const VINTA_LOGO = require('../assets/vinta_logo.png');
const SIDRA_LOGO = require('../assets/sidra_logo.png');

// Storable balances only. SIDRA is deliberately NOT one: deposits convert to
// points and withdrawals are funded from points, both at the live rate, so the
// wallet never holds an asset whose price users could time.
type AssetKey = 'POINTS' | 'VINTA' | 'PIPRO';

const ASSETS: Record<AssetKey, { label: string; code: string; color: string; icon?: string; sub: string }> = {
  POINTS: { label: 'Points Balance', code: 'PTS', color: '#FBBF24', icon: 'coins', sub: 'Earned from tasks, quizzes & rewards' },
  VINTA: { label: 'VINTA Token', code: 'VINTA', color: '#FBBF24', sub: 'Original platform currency' },
  PIPRO: { label: 'PIPRO Token', code: 'PIPRO', color: '#8B5CF6', sub: 'Solana blockchain powered' },
};

const ASSET_ORDER: AssetKey[] = ['VINTA', 'PIPRO', 'POINTS'];

function sidraLogo(size: number) {
  return <Image source={SIDRA_LOGO} style={{ width: size, height: size }} resizeMode="contain" />;
}

// Shared chrome for the four bottom sheets. Kept at module level so its
// identity is stable across renders — defining it inside the screen would
// remount every TextInput (and drop the keyboard) on each keystroke.
function Sheet({
  visible,
  onClose,
  title,
  icon,
  children,
  p,
  bottomInset,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  p: Palette;
  bottomInset: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: Math.max(bottomInset, 16) + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: p.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              {icon}
              <Text style={[styles.sheetTitle, { color: p.text }]}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.sheetClose, { backgroundColor: p.surfaceAlt }]} hitSlop={8}>
              <Icon name="xmark" iconStyle="solid" size={15} color={p.textMuted} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Segment({
  options,
  value,
  onChange,
  p,
}: {
  options: { key: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (key: string) => void;
  p: Palette;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: p.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.segmentItem, on && { backgroundColor: p.surface, ...shadow.card }]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.85}>
            {o.icon}
            <Text style={[styles.segmentText, { color: on ? p.text : p.textMuted }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  color = colors.primary,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, { backgroundColor: color }, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}>
      {loading ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <>
          <Icon name={icon} iconStyle="solid" size={15} color="#FFF" />
          <Text style={styles.primaryBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function WalletScreen() {
  const dark = useColorScheme() === 'dark';
  const p = getPalette(dark);
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const stackNav = useNavigation<StackNav>();

  // Wallet data
  const wallet = useQuery(api.wallets.getOrCreateWallet, userId ? { userId } : 'skip');
  const rate = useQuery(api.wallets.getExchangeRate);
  const platformAddr = useQuery(api.wallets.getPlatformDepositAddress);
  const platformSidraAddr = useQuery(api.sidra.getPlatformSidraAddress);
  const sidraRate = useQuery(api.sidra.getSidraRate);
  const me = useQuery(api.users.me, userId ? {} : 'skip');
  const recentTxs = useQuery(api.wallets.getWalletHistory, userId ? { userId, limit: 7 } : 'skip');

  // Mutations
  const swapPtsToPipro = useMutation(api.wallets.swapPointsToPipro);
  const swapPiproToPts = useMutation(api.wallets.swapPiproToPoints);
  const submitDeposit = useMutation(api.wallets.submitPiproDeposit);
  const submitSidra = useMutation(api.sidra.submitSidraDeposit);
  const requestWithdrawalMutation = useMutation(api.wallets.requestWithdrawal);

  // Modal states
  const [swapModal, setSwapModal] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);

  const [swapDir, setSwapDir] = useState<'pts_to_pipro' | 'pipro_to_pts'>('pts_to_pipro');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);

  const [depositAsset, setDepositAsset] = useState<'PIPRO' | 'SIDRA'>('PIPRO');
  const [depositMethod, setDepositMethod] = useState<'payNow' | 'manual'>('payNow');
  const [depositTxSig, setDepositTxSig] = useState('');
  const [depositFromAddr, setDepositFromAddr] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [sidraTxHash, setSidraTxHash] = useState('');
  const [sidraLoading, setSidraLoading] = useState(false);

  // Withdrawal States
  const [withdrawAsset, setWithdrawAsset] = useState<'VINTA' | 'PIPRO' | 'SIDRA'>('VINTA');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDestAddr, setWithdrawDestAddr] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Hero balance switcher
  const [activeAsset, setActiveAsset] = useState<AssetKey>('POINTS');

  const pointsPerSidra = sidraRate?.pointsPerSidra ?? 0;

  // For VINTA/PIPRO this is the stored balance. For SIDRA there is no balance:
  // it's how much SIDRA the user's points can buy at the current rate.
  const getAvailableBalance = (asset: 'VINTA' | 'PIPRO' | 'SIDRA') => {
    if (!wallet) return 0;
    if (asset === 'VINTA') return wallet.vintaBalance ?? 100;
    if (asset === 'PIPRO') return wallet.piproBalance ?? 0;
    if (asset === 'SIDRA') return pointsPerSidra > 0 ? Math.floor((wallet.pointsBalance / pointsPerSidra) * 10000) / 10000 : 0;
    return 0;
  };

  const getAssetBalance = (key: AssetKey): { display: string; raw: number } => {
    if (!wallet) return { display: '…', raw: 0 };
    switch (key) {
      case 'POINTS': return { display: wallet.pointsBalance.toLocaleString(), raw: wallet.pointsBalance };
      case 'VINTA': return { display: (wallet.vintaBalance ?? 100).toFixed(2), raw: wallet.vintaBalance ?? 100 };
      case 'PIPRO': return { display: (wallet.piproBalance ?? 0).toFixed(4), raw: wallet.piproBalance ?? 0 };
    }
  };

  const withdrawSidraAmount = parseFloat(withdrawAmount) || 0;
  const withdrawSidraPointsCost = Math.ceil(withdrawSidraAmount * pointsPerSidra);

  const handleSidraDeposit = async () => {
    if (!userId || !sidraTxHash.trim()) {
      Alert.alert('Error', 'Paste the transaction hash of your SIDRA transfer');
      return;
    }
    setSidraLoading(true);
    try {
      await submitSidra({ userId, txHash: sidraTxHash.trim() });
      Alert.alert(
        'Deposit Submitted',
        "We're verifying it on Sidra Chain now. Your SIDRA balance updates automatically once the transaction is confirmed — usually within a minute or two.",
      );
      setSidraTxHash('');
      setDepositModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message?.replace('[CONVEX] ', '') ?? String(e));
    } finally {
      setSidraLoading(false);
    }
  };

  const renderAssetLogo = (key: AssetKey, size: number, radiusStyle?: object) => {
    if (key === 'VINTA') {
      return (
        <Image source={VINTA_LOGO} style={[{ width: size, height: size, borderRadius: size / 2 }, radiusStyle]} resizeMode="cover" />
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
          backgroundColor: ASSETS[key].color + '26',
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
    if (withdrawAsset === 'SIDRA' && pointsPerSidra <= 0) {
      Alert.alert('Not available', "SIDRA withdrawals aren't available right now. Please try again later.");
      return;
    }
    const avail = getAvailableBalance(withdrawAsset);
    if (numAmount > avail) {
      Alert.alert(
        'Insufficient Balance',
        withdrawAsset === 'SIDRA'
          ? `${numAmount} SIDRA costs ${Math.ceil(numAmount * pointsPerSidra)} PTS at the current rate. Your points cover up to ${avail} SIDRA.`
          : `You only have ${avail} ${withdrawAsset} available.`,
      );
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
        withdrawAsset === 'SIDRA'
          ? `${Math.ceil(numAmount * pointsPerSidra)} PTS were converted at today's rate. ${numAmount} SIDRA will be sent to ${withdrawDestAddr.trim().slice(0, 8)}… once processed.`
          : `Your request to withdraw ${numAmount} ${withdrawAsset} to ${withdrawDestAddr.trim().slice(0, 8)}… has been submitted and is processing.`,
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
      case 'deposit_sidra': return { icon: 'arrow-down', color: '#34D399', isPipro: false };
      case 'withdraw_sidra': return { icon: 'arrow-up-from-bracket', color: '#34D399', isPipro: false };
      case 'withdraw_pipro': return { icon: 'arrow-up-from-bracket', color: '#8B5CF6', isPipro: true };
      case 'withdraw_vinta': return { icon: 'arrow-up-from-bracket', color: '#FBBF24', isPipro: false };
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

  const topInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : insets.top;

  const inputStyle = [styles.input, { backgroundColor: p.surfaceAlt, color: p.text }];
  const labelStyle = [styles.fieldLabel, { color: p.textMuted }];

  const quickActions = [
    { key: 'withdraw', label: 'Withdraw', icon: 'arrow-up-from-bracket', onPress: () => setWithdrawModal(true) },
    { key: 'swap', label: 'Swap', icon: 'arrow-right-arrow-left', onPress: () => { setSwapDir('pts_to_pipro'); setSwapModal(true); } },
    { key: 'deposit', label: 'Deposit', icon: 'arrow-down', onPress: () => setDepositModal(true) },
    { key: 'data', label: 'Buy Data', icon: 'mobile-screen-button', onPress: () => setVasModal(true) },
  ];

  const sheetProps = { p, bottomInset: insets.bottom };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topInset + 12, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Title row ── */}
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: p.text }]}>Wallet</Text>
            <Text style={[styles.titleSub, { color: p.textMuted }]}>Points & tokens in one place</Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: p.iconBtn }, !dark && shadow.card]}
            onPress={() => stackNav.navigate('WalletHistory')}
            activeOpacity={0.8}
            accessibilityLabel="Transaction history">
            <Icon name="clock-rotate-left" iconStyle="solid" size={16} color={p.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero balance card ── */}
        <View style={styles.hero}>
          <View style={styles.heroGlow1} />
          <View style={styles.heroGlow2} />

          <View style={styles.heroTop}>
            <View style={styles.heroAssetRow}>
              {renderAssetLogo(activeAsset, 32)}
              <Text style={styles.heroAssetLabel}>{active.label}</Text>
            </View>
            {Boolean(rate) ? (
              <View style={styles.rateChip}>
                <Icon name="arrow-right-arrow-left" iconStyle="solid" size={9} color="#FBBF24" />
                <Text style={styles.rateChipText}>1 PIPRO = {pointsPerPipro.toLocaleString()} PTS</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
              {activeBalance.display}
            </Text>
            <Text style={styles.balanceUnit}>{active.code}</Text>
          </View>
          {Boolean(activeAsset === 'POINTS' && pointsPerPipro > 0 && wallet) ? (
            <Text style={styles.balanceHint}>
              ≈ {(wallet!.pointsBalance / pointsPerPipro).toFixed(4)} PIPRO at current rate
            </Text>
          ) : (
            <Text style={styles.balanceHint}>Available balance</Text>
          )}

          {/* Asset switcher */}
          <View style={styles.switcher}>
            {(Object.keys(ASSETS) as AssetKey[]).map((key) => {
              const on = key === activeAsset;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.switcherItem, on && styles.switcherItemOn]}
                  onPress={() => setActiveAsset(key)}
                  activeOpacity={0.85}>
                  <Text style={[styles.switcherText, on && styles.switcherTextOn]}>{ASSETS[key].code}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sparkline */}
          <View style={styles.chart}>
            <View style={styles.chartHead}>
              <Text style={styles.chartTitle}>Recent activity</Text>
              <Text style={styles.chartMeta}>{chartBars.length ? `last ${chartBars.length}` : ''}</Text>
            </View>
            {chartBars.length === 0 ? (
              <Text style={styles.chartEmpty}>No activity yet — start earning</Text>
            ) : (
              <View style={styles.chartRow}>
                {chartBars.map((bar, i) => {
                  const h = Math.max(6, Math.round((bar.val / chartMax) * 40));
                  return (
                    <View key={i} style={styles.chartCol}>
                      <View style={[styles.chartBar, { height: h }, bar.positive ? styles.chartBarPos : styles.chartBarNeg]} />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.actions}>
          {quickActions.map((a) => (
            <TouchableOpacity key={a.key} style={styles.action} onPress={a.onPress} activeOpacity={0.8}>
              <View style={[styles.actionCircle, { backgroundColor: p.primarySoft }]}>
                <Icon name={a.icon} iconStyle="solid" size={20} color={dark ? '#C4B5FD' : colors.primaryDeep} />
              </View>
              <Text style={[styles.actionLabel, { color: p.text }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Assets ── */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: p.text }]}>Your assets</Text>
        </View>
        <View style={[styles.card, { backgroundColor: p.surface }, !dark && shadow.card]}>
          {!wallet ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            ASSET_ORDER.map((key, i) => {
              const bal = getAssetBalance(key);
              const on = key === activeAsset;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}
                  onPress={() => setActiveAsset(key)}
                  activeOpacity={0.7}>
                  {renderAssetLogo(key, 42)}
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: p.text }]}>{ASSETS[key].label}</Text>
                    <Text style={[styles.rowSub, { color: p.textMuted }]} numberOfLines={1}>{ASSETS[key].sub}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: p.text }]}>{bal.display}</Text>
                    <Text style={[styles.rowCode, { color: on ? colors.primary : p.textFaint }]}>{ASSETS[key].code}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Transactions ── */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: p.text }]}>Recent transactions</Text>
          <TouchableOpacity onPress={() => stackNav.navigate('WalletHistory')} activeOpacity={0.7} hitSlop={8}>
            <Text style={styles.link}>View all</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { backgroundColor: p.surface }, !dark && shadow.card]}>
          {!recentTxs ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recentTxs.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: p.surfaceAlt }]}>
                <Icon name="inbox" iconStyle="solid" size={20} color={p.textFaint} />
              </View>
              <Text style={[styles.emptyText, { color: p.textMuted }]}>No wallet activity yet</Text>
            </View>
          ) : (
            recentTxs.map((tx, i) => {
              const meta = txTypeMeta(tx.type);
              return (
                <View
                  key={tx._id}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                  {meta.isPipro ? (
                    <Image source={PIPRO_LOGO} style={styles.txLogo} resizeMode="contain" />
                  ) : (
                    <View style={[styles.txIcon, { backgroundColor: meta.color + '1F' }]}>
                      <Icon name={meta.icon} iconStyle="solid" size={15} color={meta.color} />
                    </View>
                  )}
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
                      {tx.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                    {tx.note ? (
                      <Text style={[styles.rowSub, { color: p.textMuted }]} numberOfLines={1}>{tx.note}</Text>
                    ) : null}
                  </View>
                  <View style={styles.rowRight}>
                    {tx.piproDelta !== 0 && (
                      <Text style={[styles.rowValue, tx.piproDelta > 0 ? styles.pos : styles.neg]}>
                        {tx.piproDelta > 0 ? '+' : ''}{tx.piproDelta.toFixed(4)} PIPRO
                      </Text>
                    )}
                    {tx.pointsDelta !== 0 && (
                      <Text style={[styles.rowValue, tx.pointsDelta > 0 ? styles.pos : styles.neg]}>
                        {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta} PTS
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── PIPRO note ── */}
        <View style={[styles.infoCard, { backgroundColor: p.primarySoft }]}>
          {renderAssetLogo('PIPRO', 34)}
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: dark ? '#E9D5FF' : colors.primaryDeep }]}>PIPRO token ecosystem</Text>
            <Text style={[styles.infoText, { color: dark ? '#C4B5FD' : colors.primaryDeep }]}>
              Swap earned points to PIPRO instantly, or deposit PIPRO from any Solana wallet.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ─── Swap ─── */}
      <Sheet
        {...sheetProps}
        visible={swapModal}
        onClose={() => setSwapModal(false)}
        title="Instant swap"
        icon={<Image source={PIPRO_LOGO} style={styles.sheetIconImg} resizeMode="contain" />}>
        <Segment
          p={p}
          value={swapDir}
          onChange={(k) => { setSwapDir(k as typeof swapDir); setSwapAmount(''); }}
          options={[
            { key: 'pts_to_pipro', label: 'Points → PIPRO' },
            { key: 'pipro_to_pts', label: 'PIPRO → Points' },
          ]}
        />

        <Text style={labelStyle}>{swapDir === 'pts_to_pipro' ? 'Points to swap' : 'PIPRO to swap'}</Text>
        <View style={[styles.amountBox, { backgroundColor: p.surfaceAlt }]}>
          <TextInput
            style={[styles.amountInput, { color: p.text }]}
            value={swapAmount}
            onChangeText={setSwapAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={p.textFaint}
          />
          <Text style={[styles.amountUnit, { color: p.textMuted }]}>{swapDir === 'pts_to_pipro' ? 'PTS' : 'PIPRO'}</Text>
        </View>

        <View style={styles.receiveRow}>
          <View style={styles.receiveLeft}>
            {swapDir === 'pts_to_pipro' ? (
              <Image source={PIPRO_LOGO} style={{ width: 20, height: 20 }} resizeMode="contain" />
            ) : (
              <Icon name="coins" iconStyle="solid" size={16} color="#FBBF24" />
            )}
            <Text style={styles.receiveLabel}>You receive</Text>
          </View>
          <Text style={styles.receiveValue}>
            {swapReceive} {swapDir === 'pts_to_pipro' ? 'PIPRO' : 'PTS'}
          </Text>
        </View>
        {Boolean(rate) ? (
          <Text style={[styles.rateHint, { color: p.textFaint }]}>1 PIPRO = {pointsPerPipro.toLocaleString()} PTS</Text>
        ) : null}

        <PrimaryButton
          label="Swap now"
          icon="arrow-right-arrow-left"
          onPress={handleSwap}
          loading={swapLoading}
          disabled={swapNumericAmount <= 0}
        />
      </Sheet>

      {/* ─── Deposit ─── */}
      <Sheet
        {...sheetProps}
        visible={depositModal}
        onClose={() => setDepositModal(false)}
        title={depositAsset === 'SIDRA' ? 'Deposit SIDRA' : 'Deposit PIPRO'}
        icon={
          depositAsset === 'SIDRA'
            ? sidraLogo(26)
            : <Image source={PIPRO_LOGO} style={styles.sheetIconImg} resizeMode="contain" />
        }>
        <Segment
          p={p}
          value={depositAsset}
          onChange={(k) => setDepositAsset(k as typeof depositAsset)}
          options={[
            { key: 'PIPRO', label: 'PIPRO', icon: <Image source={PIPRO_LOGO} style={{ width: 16, height: 16 }} resizeMode="contain" /> },
            { key: 'SIDRA', label: 'SIDRA', icon: sidraLogo(16) },
          ]}
        />

        {depositAsset === 'SIDRA' ? (
          !me?.payoutEvm ? (
            <>
              <View style={[styles.availBox, { backgroundColor: p.primarySoft, alignItems: 'flex-start' }]}>
                <Text style={[styles.rowTitle, { color: dark ? '#E9D5FF' : colors.primaryDeep }]}>Add your Sidra address first</Text>
                <Text style={[styles.hint, { color: dark ? '#C4B5FD' : colors.primaryDeep, marginTop: 4, marginBottom: 0 }]}>
                  Deposits are credited to the account whose registered address sent them. Save the Sidra Chain address you'll be sending from, then come back.
                </Text>
              </View>
              <PrimaryButton
                label="Add Sidra address"
                icon="gear"
                onPress={() => { setDepositModal(false); stackNav.navigate('PayoutSettings'); }}
              />
            </>
          ) : (
            <>
              <Text style={[styles.hint, { color: p.textMuted }]}>
                Send SIDRA from your registered address to the platform address below. Once confirmed on Sidra Chain it's converted to points at that moment's rate
                {pointsPerSidra > 0 ? ` (1 SIDRA = ${pointsPerSidra.toLocaleString()} PTS)` : ''} and added to your balance automatically — paste the transaction hash to speed it up.
              </Text>

              {platformSidraAddr ? (
                <TouchableOpacity
                  style={[styles.addrCard, { backgroundColor: p.surfaceAlt }]}
                  onPress={() => copyToClipboard(platformSidraAddr)}
                  activeOpacity={0.7}>
                  <Text style={[styles.addrLabel, { color: p.textMuted }]}>Platform deposit address · Sidra Chain</Text>
                  <Text style={[styles.addrValue, { color: p.text }]} numberOfLines={2}>{platformSidraAddr}</Text>
                  <View style={styles.copyRow}>
                    <Icon name="copy" iconStyle="solid" size={12} color={colors.primary} />
                    <Text style={styles.copyText}>Tap to copy</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.warn}>
                  <Icon name="triangle-exclamation" iconStyle="solid" size={14} color={colors.warn} />
                  <Text style={styles.warnText}>Sidra deposits aren't available yet. Please check back soon.</Text>
                </View>
              )}

              <View style={[styles.addrCard, { backgroundColor: p.surfaceAlt }]}>
                <Text style={[styles.addrLabel, { color: p.textMuted }]}>Send only from your registered address</Text>
                <Text style={[styles.addrValue, { color: p.text }]} numberOfLines={1}>{me.payoutEvm}</Text>
              </View>

              <Text style={labelStyle}>Transaction hash (optional, speeds it up)</Text>
              <TextInput
                style={inputStyle}
                value={sidraTxHash}
                onChangeText={setSidraTxHash}
                placeholder="0x…"
                placeholderTextColor={p.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <PrimaryButton
                label="Submit for verification"
                icon="paper-plane"
                onPress={handleSidraDeposit}
                loading={sidraLoading}
                disabled={!sidraTxHash.trim() || !platformSidraAddr}
                color="#059669"
              />
            </>
          )
        ) : null}

        {depositAsset === 'PIPRO' ? (
        <Segment
          p={p}
          value={depositMethod}
          onChange={(k) => setDepositMethod(k as typeof depositMethod)}
          options={[
            { key: 'payNow', label: 'Pay now' },
            { key: 'manual', label: 'Manual' },
          ]}
        />
        ) : null}

        {depositAsset === 'PIPRO' && depositMethod === 'payNow' ? (
          <>
            <Text style={[styles.hint, { color: p.textMuted }]}>
              Enter the amount, then open your Solana wallet (Phantom, Solflare…) to pay.
            </Text>
            <View style={[styles.amountBox, { backgroundColor: p.surfaceAlt }]}>
              <TextInput
                style={[styles.amountInput, { color: p.text }]}
                value={depositAmount}
                onChangeText={setDepositAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={p.textFaint}
              />
              <Text style={[styles.amountUnit, { color: p.textMuted }]}>PIPRO</Text>
            </View>
            <PrimaryButton label="Pay with wallet" icon="wallet" onPress={handlePayNow} color="#D97706" />

            <View style={[styles.divider, { backgroundColor: p.border }]} />

            <Text style={labelStyle}>Transaction signature after payment</Text>
            <TextInput
              style={inputStyle}
              value={depositTxSig}
              onChangeText={setDepositTxSig}
              placeholder="Paste signature…"
              placeholderTextColor={p.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PrimaryButton
              label="Submit for verification"
              icon="paper-plane"
              onPress={handleManualDeposit}
              loading={depositLoading}
              color={colors.success}
            />
          </>
        ) : depositAsset === 'PIPRO' ? (
          <>
            <Text style={[styles.hint, { color: p.textMuted }]}>
              Send PIPRO to the platform address below, then paste your transaction signature.
            </Text>

            {platformAddr ? (
              <TouchableOpacity
                style={[styles.addrCard, { backgroundColor: p.surfaceAlt }]}
                onPress={() => copyToClipboard(platformAddr)}
                activeOpacity={0.7}>
                <Text style={[styles.addrLabel, { color: p.textMuted }]}>Platform deposit address · Solana</Text>
                <Text style={[styles.addrValue, { color: p.text }]} numberOfLines={2}>{platformAddr}</Text>
                <View style={styles.copyRow}>
                  <Icon name="copy" iconStyle="solid" size={12} color={colors.primary} />
                  <Text style={styles.copyText}>Tap to copy</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.warn}>
                <Icon name="triangle-exclamation" iconStyle="solid" size={14} color={colors.warn} />
                <Text style={styles.warnText}>Platform deposit address not configured. Contact admin.</Text>
              </View>
            )}

            <Text style={labelStyle}>Your sender address (optional)</Text>
            <TextInput
              style={inputStyle}
              value={depositFromAddr}
              onChangeText={setDepositFromAddr}
              placeholder="Sender wallet address"
              placeholderTextColor={p.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={labelStyle}>Transaction signature</Text>
            <TextInput
              style={inputStyle}
              value={depositTxSig}
              onChangeText={setDepositTxSig}
              placeholder="Paste signature…"
              placeholderTextColor={p.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PrimaryButton
              label="Submit for verification"
              icon="paper-plane"
              onPress={handleManualDeposit}
              loading={depositLoading}
              color={colors.success}
            />
          </>
        ) : null}
      </Sheet>

      {/* ─── Buy data & airtime ─── */}
      <Sheet
        {...sheetProps}
        visible={vasModal}
        onClose={() => setVasModal(false)}
        title="Buy data & airtime"
        icon={<Icon name="mobile-screen-button" iconStyle="solid" size={20} color={colors.primary} />}>
        <Segment
          p={p}
          value={vasPaymentMethod}
          onChange={(k) => setVasPaymentMethod(k as typeof vasPaymentMethod)}
          options={[
            { key: 'PIPRO', label: 'Pay with PIPRO', icon: <Image source={PIPRO_LOGO} style={{ width: 14, height: 14 }} resizeMode="contain" /> },
            { key: 'POINTS', label: 'Pay with points', icon: <Icon name="coins" iconStyle="solid" size={12} color="#FBBF24" /> },
          ]}
        />

        <Text style={labelStyle}>Select a bundle</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 230 }}>
          {!catalogItems ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
          ) : catalogItems.length === 0 ? (
            <Text style={[styles.hint, { color: p.textMuted, textAlign: 'center' }]}>No bundles available.</Text>
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
                    styles.bundle,
                    { backgroundColor: p.surfaceAlt, borderColor: selected ? colors.primary : 'transparent' },
                  ]}
                  onPress={() => setSelectedCatalogId(item._id)}
                  activeOpacity={0.8}>
                  <View style={[styles.bundleIcon, { backgroundColor: p.primarySoft }]}>
                    <Icon name={item.itemType === 'DATA' ? 'wifi' : 'phone'} iconStyle="solid" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: p.text }]}>{item.name}</Text>
                    <Text style={[styles.rowSub, { color: p.textMuted }]}>{item.itemType} bundle</Text>
                  </View>
                  <View style={styles.costChip}>
                    <Text style={styles.costText}>{displayCost}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <Text style={labelStyle}>Phone number</Text>
        <TextInput
          style={inputStyle}
          value={vasPhone}
          onChangeText={setVasPhone}
          placeholder="e.g. +234 801 234 5678"
          placeholderTextColor={p.textFaint}
          keyboardType="phone-pad"
        />
        <PrimaryButton
          label="Confirm purchase"
          icon="bolt"
          onPress={handleBuyVas}
          loading={vasLoading}
          disabled={!selectedCatalogId || !vasPhone.trim()}
          color={vasPaymentMethod === 'PIPRO' ? colors.primary : '#D97706'}
        />
      </Sheet>

      {/* ─── Withdraw ─── */}
      <Sheet
        {...sheetProps}
        visible={withdrawModal}
        onClose={() => setWithdrawModal(false)}
        title="Withdraw"
        icon={<Icon name="arrow-up-from-bracket" iconStyle="solid" size={20} color={colors.primary} />}>
        <Segment
          p={p}
          value={withdrawAsset}
          onChange={(k) => setWithdrawAsset(k as typeof withdrawAsset)}
          options={[
            { key: 'VINTA', label: 'VINTA', icon: renderAssetLogo('VINTA', 16) },
            { key: 'PIPRO', label: 'PIPRO', icon: <Image source={PIPRO_LOGO} style={{ width: 16, height: 16 }} resizeMode="contain" /> },
            { key: 'SIDRA', label: 'SIDRA', icon: sidraLogo(16) },
          ]}
        />

        {withdrawAsset === 'SIDRA' ? (
          <View style={[styles.availBox, { backgroundColor: p.primarySoft }]}>
            <Text style={[styles.availLabel, { color: dark ? '#C4B5FD' : colors.primaryDeep }]}>Paid from your points</Text>
            <Text style={[styles.availValue, { color: dark ? '#E9D5FF' : colors.primaryDeep }]}>
              {wallet ? wallet.pointsBalance.toLocaleString() : '…'} PTS
            </Text>
            <Text style={[styles.hint, { color: dark ? '#C4B5FD' : colors.primaryDeep, marginTop: 6, marginBottom: 0, textAlign: 'center' }]}>
              {pointsPerSidra > 0
                ? `≈ ${getAvailableBalance('SIDRA')} SIDRA at today's rate · 1 SIDRA = ${pointsPerSidra.toLocaleString()} PTS`
                : 'SIDRA withdrawals are not available right now.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.availBox, { backgroundColor: p.primarySoft }]}>
            <Text style={[styles.availLabel, { color: dark ? '#C4B5FD' : colors.primaryDeep }]}>Available</Text>
            <Text style={[styles.availValue, { color: dark ? '#E9D5FF' : colors.primaryDeep }]}>
              {getAvailableBalance(withdrawAsset)} {withdrawAsset}
            </Text>
          </View>
        )}

        <View style={styles.labelRow}>
          <Text style={labelStyle}>{withdrawAsset === 'SIDRA' ? 'SIDRA to receive' : 'Amount'}</Text>
          <TouchableOpacity onPress={() => setWithdrawAmount(String(getAvailableBalance(withdrawAsset)))} hitSlop={8}>
            <Text style={styles.maxBtn}>MAX</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.amountBox, { backgroundColor: p.surfaceAlt }]}>
          <TextInput
            style={[styles.amountInput, { color: p.text }]}
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={p.textFaint}
          />
          <Text style={[styles.amountUnit, { color: p.textMuted }]}>{withdrawAsset}</Text>
        </View>
        {withdrawAsset === 'SIDRA' && withdrawSidraAmount > 0 && pointsPerSidra > 0 ? (
          <View style={styles.receiveRow}>
            <View style={styles.receiveLeft}>
              <Icon name="coins" iconStyle="solid" size={16} color="#FBBF24" />
              <Text style={styles.receiveLabel}>Points converted now</Text>
            </View>
            <Text style={styles.receiveValue}>−{withdrawSidraPointsCost.toLocaleString()} PTS</Text>
          </View>
        ) : null}

        <Text style={labelStyle}>
          Destination · {withdrawAsset === 'PIPRO' ? 'Solana SPL' : withdrawAsset === 'SIDRA' ? 'Sidra Chain EVM' : 'EVM or Solana'}
        </Text>
        <TextInput
          style={inputStyle}
          value={withdrawDestAddr}
          onChangeText={setWithdrawDestAddr}
          placeholder={withdrawAsset === 'PIPRO' ? 'Solana address…' : '0x… or Solana address'}
          placeholderTextColor={p.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.feeRow}>
          <Icon name="circle-info" iconStyle="solid" size={12} color={p.textFaint} />
          <Text style={[styles.feeText, { color: p.textMuted }]}>
            Network fee <Text style={{ color: colors.success, fontWeight: '800' }}>FREE</Text> · platform sponsored
          </Text>
        </View>

        <PrimaryButton
          label={withdrawAsset === 'SIDRA' ? 'Convert & withdraw' : 'Submit withdrawal'}
          icon="paper-plane"
          onPress={handleWithdrawal}
          loading={withdrawLoading}
          disabled={!withdrawAmount || !withdrawDestAddr.trim() || (withdrawAsset === 'SIDRA' && pointsPerSidra <= 0)}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 18 },

  // Title row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  titleSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#1E1B4B',
    overflow: 'hidden',
    marginBottom: 18,
    ...shadow.float,
  },
  heroGlow1: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(139, 92, 246, 0.42)',
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heroAssetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroAssetLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '700' },
  rateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.32)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  rateChipText: { color: '#FBBF24', fontSize: 10.5, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balanceValue: { color: '#FFFFFF', fontSize: 46, fontWeight: '900', letterSpacing: -1.8, flexShrink: 1 },
  balanceUnit: { color: '#FBBF24', fontSize: 16, fontWeight: '800' },
  balanceHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: '600', marginTop: 4, marginBottom: 18 },

  switcher: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 16,
  },
  switcherItem: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  switcherItemOn: { backgroundColor: '#FFFFFF' },
  switcherText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.4 },
  switcherTextOn: { color: '#1E1B4B' },

  chart: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 14,
  },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  chartTitle: { color: '#E9D5FF', fontSize: 12.5, fontWeight: '800' },
  chartMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  chartEmpty: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 44, gap: 8 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '100%', maxWidth: 20, borderRadius: 6 },
  chartBarPos: { backgroundColor: '#34D399' },
  chartBarNeg: { backgroundColor: '#F87171' },

  // Quick actions
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, paddingHorizontal: 4 },
  action: { alignItems: 'center', gap: 8, width: 72 },
  actionCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700' },

  // Sections & cards
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  card: { borderRadius: 22, paddingHorizontal: 16, marginBottom: 20 },
  loadingRow: { paddingVertical: 28, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '700' },
  rowSub: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: { fontSize: 14.5, fontWeight: '800' },
  rowCode: { fontSize: 10.5, fontWeight: '800', marginTop: 2, letterSpacing: 0.3 },
  pos: { color: colors.success },
  neg: { color: colors.danger },
  txLogo: { width: 42, height: 42, borderRadius: 21 },
  txIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    padding: 16,
    marginBottom: 8,
  },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  infoText: { fontSize: 12.5, lineHeight: 18, marginTop: 3, opacity: 0.85 },

  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(8, 8, 20, 0.6)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sheetIconImg: { width: 26, height: 26 },
  sheetClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  segment: { flexDirection: 'row', gap: 4, borderRadius: 14, padding: 4, marginBottom: 16 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentText: { fontSize: 12.5, fontWeight: '800' },

  fieldLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 7, marginTop: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, padding: 0 },
  amountUnit: { fontSize: 14, fontWeight: '800' },
  maxBtn: { color: colors.primary, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },

  receiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  receiveLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  receiveLabel: { fontSize: 13, fontWeight: '700', color: colors.success },
  receiveValue: { fontSize: 17, fontWeight: '900', color: colors.success },
  rateHint: { fontSize: 11.5, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  hint: { fontSize: 13, lineHeight: 19, fontWeight: '500', marginBottom: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 18 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    marginTop: 4,
    ...shadow.raised,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },

  addrCard: { borderRadius: 14, padding: 14, marginBottom: 12 },
  addrLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  addrValue: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 8 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  warnText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' },

  availBox: { borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  availLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  availValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14, paddingHorizontal: 2 },
  feeText: { fontSize: 12, fontWeight: '600' },

  bundle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  bundleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  costChip: { backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  costText: { color: colors.success, fontWeight: '800', fontSize: 12 },
});
