import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useQuery } from 'convex/react';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow, spacing } from '../theme';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { useLanguage } from '../i18n/LanguageContext';
import { openTaskLink } from '../services/TaskLinkService';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Settings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type SettingsRowProps = {
  icon: string;
  tint: string;
  label: string;
  sub?: string;
  badge?: string;
  onPress: () => void;
  isLast?: boolean;
};

function SettingsRow({ icon, tint, label, sub, badge, onPress, isLast }: SettingsRowProps) {
  const dark = useColorScheme() === 'dark';
  return (
    <>
      <TouchableOpacity
        style={[styles.row, dark && styles.rowDark]}
        onPress={onPress}
        activeOpacity={0.7}>
        <View style={[styles.iconBox, { backgroundColor: tint + '18' }]}>
          <Icon name={icon} iconStyle="solid" size={16} color={tint} />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, dark && styles.textLight]}>{label}</Text>
          {sub ? (
            <Text style={styles.rowSub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: tint + '1E' }]}>
            <Text style={[styles.badgeText, { color: tint }]}>{badge}</Text>
          </View>
        ) : null}
        <Icon name="chevron-right" iconStyle="solid" size={12} color={colors.textFaint} />
      </TouchableOpacity>
      {!isLast && <View style={[styles.divider, dark && styles.dividerDark]} />}
    </>
  );
}

export default function SettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { userId } = useAuth();
  const { signOut } = useAuthActions();
  const { language, setLanguage, t } = useLanguage();

  const user = useQuery(api.users.me);
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const flags = useQuery(api.features.getFlags) || {};
  const generatePdf = useAction(api.reports.generatePdf);

  const handleDownloadReport = async () => {
    if (!userId) return;
    try {
      const result = await generatePdf({ userId });
      if (result?.url) await openTaskLink(result.url);
    } catch {
      Alert.alert('Report', 'Could not generate activity report.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('signOut'), t('signOutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {}
        },
      },
    ]);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ha' : 'en');
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Member';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title={t('dashboardSettings')} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}>
        {/* Account Header Card */}
        <View style={[styles.accountCard, dark && styles.cardDark]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={[styles.accountName, dark && styles.textLight]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {user?.email || 'View2Earn Community Member'}
            </Text>
          </View>
          <View style={styles.balanceTag}>
            <Icon name="coins" iconStyle="solid" size={13} color="#F59E0B" />
            <Text style={styles.balanceTagText}>
              {balance === undefined ? '…' : balance.toLocaleString()} PTS
            </Text>
          </View>
        </View>

        {/* Section 1: Preferences */}
        <Text style={styles.sectionTitle}>{t('preferences')}</Text>
        <View style={[styles.groupCard, dark && styles.cardDark]}>
          <SettingsRow
            icon="globe"
            tint="#8B5CF6"
            label={t('languageSetting')}
            sub={t('languageSettingSub')}
            badge={language === 'ha' ? '🇳🇬 Hausa' : '🇬🇧 English'}
            onPress={toggleLanguage}
            isLast
          />
        </View>

        {/* Section 2: Community & Growth */}
        <Text style={styles.sectionTitle}>{t('communityAndGrowth')}</Text>
        <View style={[styles.groupCard, dark && styles.cardDark]}>
          {flags['feature:donate'] !== false && (
            <SettingsRow
              icon="heart"
              tint="#EC4899"
              label={t('communityPool')}
              sub={t('communityPoolDesc')}
              onPress={() => nav.navigate('Donate')}
            />
          )}
          <SettingsRow
            icon="gift"
            tint="#10B981"
            label={t('referralProgram')}
            sub={t('referralProgramSub')}
            onPress={() => nav.navigate('Referral')}
          />
          <SettingsRow
            icon="trophy"
            tint="#F59E0B"
            label={t('globalRanks')}
            sub={t('globalRanksSub')}
            onPress={() => nav.navigate('Leaderboard')}
          />
          <SettingsRow
            icon="link"
            tint="#6366F1"
            label={t('linkedAccounts')}
            sub={t('linkedAccountsSub')}
            onPress={() => nav.navigate('LinkedAccounts')}
            isLast
          />
        </View>

        {/* Section 3: Security & Privacy */}
        <Text style={styles.sectionTitle}>{t('securityAndData')}</Text>
        <View style={[styles.groupCard, dark && styles.cardDark]}>
          <SettingsRow
            icon="shield-halved"
            tint={colors.primary}
            label={t('securitySettings')}
            sub={t('securitySettingsSub')}
            onPress={() => nav.navigate('Security')}
          />
          <SettingsRow
            icon="file-pdf"
            tint="#EF4444"
            label={t('downloadReport')}
            sub={t('downloadReportSub')}
            onPress={handleDownloadReport}
            isLast
          />
        </View>

        {/* Section 4: Sign Out */}
        <View style={[styles.groupCard, dark && styles.cardDark, { marginTop: spacing.sm }]}>
          <TouchableOpacity
            style={[styles.row, styles.signOutRow]}
            onPress={handleSignOut}
            activeOpacity={0.7}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Icon name="right-from-bracket" iconStyle="solid" size={16} color="#EF4444" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.signOutText}>{t('signOut')}</Text>
            </View>
            <Icon name="chevron-right" iconStyle="solid" size={12} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* App Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>View2Earn • Community Engagement & Growth</Text>
          <Text style={styles.footerSub}>v2.1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  containerDark: {
    backgroundColor: colors.bgDark,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  textLight: {
    color: colors.textDark,
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  accountEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  balanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 5,
  },
  balanceTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
    marginTop: 4,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowDark: {
    backgroundColor: colors.surfaceDark,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 66,
  },
  dividerDark: {
    backgroundColor: colors.borderDark,
  },

  signOutRow: {
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },

  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  footerSub: {
    fontSize: 11,
    color: colors.textFaint,
  },
});
