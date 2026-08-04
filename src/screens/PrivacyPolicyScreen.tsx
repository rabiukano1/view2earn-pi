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
          <Text style={styles.headerSub}>Last Updated: August 2026</Text>
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
            Welcome to View2Earn ("View2Earn," "we," "our," or "us"). We are committed to protecting your privacy and safeguarding your personal information. We believe that privacy is a fundamental part of building a secure, transparent, and trustworthy platform.
          </Text>
          <Text style={[styles.paragraph, { color: textSub }, { marginTop: 8 }]}>
            This Privacy Policy explains how we collect, use, store, protect, disclose, and process your personal information when you access or use the View2Earn website, mobile applications, and related services (collectively, the "Service").
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>2. Information We Collect</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We collect only the minimum personal information reasonably necessary to operate, secure, and improve the platform.
          </Text>
          
          <Text style={[styles.subheading, { color: textMain }]}>A. Account Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Username and display name.{'\n'}
            • Registered email address, where applicable.{'\n'}
            • Selected blockchain ecosystem (Pi Network / Sidra Chain) and external user identifiers.{'\n'}
            • Account creation date and status.
          </Text>

          <Text style={[styles.subheading, { color: textMain }]}>B. Activity Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Completed tasks, reward points (earned, redeemed, forfeited).{'\n'}
            • Referral code relationships, survey participation, quiz results.{'\n'}
            • Wallet transactions and fraud prevention history.
          </Text>

          <Text style={[styles.subheading, { color: textMain }]}>C. Device &amp; Technical Signals</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Device model, OS, browser type, and version.{'\n'}
            • IP address, approximate geolocation, locale, and timezone.{'\n'}
            • Secure device/hardware fingerprints used strictly to detect clones, emulators, and bots.
          </Text>

          <Text style={[styles.subheading, { color: textMain }]}>D. Information We Do NOT Collect</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • We NEVER collect or store your Pi Network or Sidra Chain passphrase, seed phrases, or private keys.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>3. How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • **To Provide the Service**: Managing your profile, point balances, streaks, and PIPRO swaps.{'\n'}
            • **To Maintain Security**: Detecting fraud, multiple account farms, automated scripts, and bots.{'\n'}
            • **To Communicate**: Providing support responses and sending security notifications.{'\n'}
            • **Legal Obligations**: Complying with regulatory requirements or lawful legal subpoenas.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>4. Legal Basis &amp; Data Sharing</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • **Legal Basis**: We process data under the performance of a contract (Terms of Service), legitimate business interests (anti-fraud), compliance with legal rules, or user consent.{'\n'}
            • **No Selling**: We do not sell or trade your personal information. We share it only with cloud hosts, authentication platforms, survey providers (CPX, BitLabs), ad partners, and public blockchains solely to fulfill functions.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>5. Cookies &amp; Data Retention</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • We use essential identifiers to secure sessions.{'\n'}
            • We retain personal information only as long as necessary to fulfill purposes, prevent fraud, or satisfy audits.{'\n'}
            • Upon deletion request, we securely delete or anonymize your data, except where legally required to retain it.
          </Text>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>6. Data Security &amp; Rights</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • We enforce encryption, access limits, and monitoring to protect your information.{'\n'}
            • Users have the right to access, rectify, restrict, or request permanent deletion of their data at any time.
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => Linking.openURL('mailto:privacy@view2earn.org?subject=Account%20Deletion%20Request')}
            activeOpacity={0.85}>
            <Icon name="trash-can" iconStyle="solid" size={16} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Request Data / Account Deletion</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>7. Contact &amp; DPO</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            For any privacy inquiries, data deletion requests, or legal notices, contact our official channels:
          </Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('mailto:privacy@view2earn.org')}>
            <Icon name="envelope" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>privacy@view2earn.org</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('https://view2earn.org/privacy')}>
            <Icon name="globe" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>https://view2earn.org/privacy</Text>
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
