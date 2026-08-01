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

type Nav = NativeStackNavigationProp<RootStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen() {
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
          <Text style={[styles.headerTitle, { color: textMain }]}>PRIVACY POLICY</Text>
          <Text style={styles.headerSub}>Effective Date: August 1, 2026</Text>
        </View>
        <View style={[styles.iconBtn, styles.iconBtnGhost]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={styles.sectionBadge}>GDPR &amp; CCPA COMPLIANT</Text>
          <Text style={[styles.heading, { color: textMain }]}>1. Introduction &amp; Overview</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Welcome to View2Earn (&quot;Company,&quot; &quot;we,&quot; or &quot;us&quot;). We operate the View2Earn mobile application, website (https://view2aern.org), and associated backend services.
          </Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            This Privacy Policy explains how we collect, use, and protect your information when using our app. We comply strictly with Google AdMob policies, Google Play Developer terms, Apple iOS privacy guidelines (NSPrivacy), GDPR, CCPA, and partner survey terms.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>2. Information We Collect</Text>
          <Text style={[styles.subheading, { color: textMain }]}>A. Information You Provide</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Account Profile (Email address, OAuth display name, User ID){'\n'}
            • Public Payout Addresses (Voluntary EVM or Solana public wallet addresses). We NEVER ask for private keys or seed phrases.{'\n'}
            • Support &amp; Verification Submissions (Proof screenshots voluntarily uploaded).
          </Text>

          <Text style={[styles.subheading, { color: textMain }]}>B. Automated &amp; Anti-Fraud Signals</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Advertising Identifiers (Google GAID/AAID &amp; Apple IDFA){'\n'}
            • Device Attributes (Model, OS version, locale, network type){'\n'}
            • Anonymized Device Fingerprints (Boot time and time zone offsets used strictly to prevent bot traffic and click farming).
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>3. How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Maintaining your points ledger, streaks, and PIPRO swaps{'\n'}
            • Serving voluntary AdMob rewarded video ads upon your request{'\n'}
            • Routing survey offerwalls (CPX Research, BitLabs, etc.) and auto-crediting completed rewards{'\n'}
            • Protecting our advertising partners against automated bots or multi-account abuse.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>4. Third-Party Disclosures</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Google AdMob (Ad serving and UMP consent framework){'\n'}
            • Survey Networks (CPX Research, BitLabs, Pollfish){'\n'}
            • Cloud Infrastructure (Convex Cloud, Cloudflare, Vercel){'\n'}
            • Public Blockchains (Solana &amp; EVM public ledgers for payouts).
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>5. User Rights &amp; Account Deletion</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Under GDPR &amp; CCPA, you have the right to access, rectify, port, or request permanent deletion of your data at any time.
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => Linking.openURL('mailto:privacy@view2aern.org?subject=Account%20Deletion%20Request')}
            activeOpacity={0.85}>
            <Icon name="trash-can" iconStyle="solid" size={16} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Request Data / Account Deletion</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>6. Contact &amp; Legal DPO</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            For any privacy inquiries or DPO communications:
          </Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('mailto:privacy@view2aern.org')}>
            <Icon name="envelope" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>privacy@view2aern.org</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('https://view2aern.org/privacy')}>
            <Icon name="globe" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>https://view2aern.org/privacy</Text>
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: colors.success,
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
  subheading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: radius.pill,
    paddingVertical: 12,
    marginTop: 14,
  },
  actionBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
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
