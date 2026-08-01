import React from 'react';
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow } from '../theme';
import Icon from '../components/Icon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Terms'>;

export default function TermsScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const textMain = dark ? colors.textDark : colors.text;
  const textSub = colors.textMuted;

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.iconBtn, dark && styles.iconBtnDark]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}>
          <Icon name="arrow-left" iconStyle="solid" size={16} color={dark ? '#F5F5F7' : colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textMain }]}>TERMS &amp; CONDITIONS</Text>
          <Text style={styles.headerSub}>Effective Date: August 1, 2026</Text>
        </View>
        <View style={[styles.iconBtn, styles.iconBtnGhost]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={styles.sectionBadge}>USER AGREEMENT &amp; PLATFORM RULES</Text>
          <Text style={[styles.heading, { color: textMain }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            By creating an account, accessing, or using View2Earn (https://view2aern.org), you agree to be bound by these Terms &amp; Conditions, our Privacy Policy, and all applicable global laws and ad network regulations.
          </Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            If you do not agree to these terms, you must not create an account or use our mobile applications or web portals.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>2. Eligibility &amp; Account Rules</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • You must be at least 18 years of age (or the age of legal majority in your country) to create an account.{'\n'}
            • You may maintain only ONE active View2Earn account per individual and per physical mobile device.{'\n'}
            • Account sharing, multi-accounting, emulator farms, and automated scripts/bots are strictly prohibited.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>3. In-App Economy &amp; Reward Redemptions</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Points earned via social tasks, rewarded ads, daily check-ins, and quizzes are virtual in-app utility rewards.{'\n'}
            • Points may be swapped for PIPRO tokens or redeemed for rewards according to current platform exchange rates.{'\n'}
            • Points are non-transferable between users and hold zero legal cash value until successfully converted or redeemed.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>4. Prohibited Conduct &amp; Account Termination</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Violation of any of the following rules will result in immediate permanent account suspension and forfeiture of unredeemed points:{'\n'}
            • Using VPNs, proxies, or IP spoofs to manipulate survey offerwalls or task availability{'\n'}
            • Attempting automated or artificial clicks on Google AdMob ads{'\n'}
            • Submitting fake or altered screenshot proofs for promotional tasks{'\n'}
            • Exploiting system glitches or reverse-engineering application APIs.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>5. Non-Custodial Cryptocurrency Notice</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Token distributions (PIPRO, Solana SPL, EVM tokens) are executed to public wallet addresses provided voluntarily by the user.{'\n'}
            • View2Earn is non-custodial. We never store or access your private keys. You are solely responsible for managing your receiving wallet credentials.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>6. Contact &amp; Legal Support</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            For legal inquiries or terms clarification, contact our legal team:
          </Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('mailto:support@view2aern.org')}>
            <Icon name="envelope" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>support@view2aern.org</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('https://view2aern.org/terms')}>
            <Icon name="globe" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>https://view2aern.org/terms</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  iconBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconBtnGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 10,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
