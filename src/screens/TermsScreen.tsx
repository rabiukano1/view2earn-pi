import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { smartOpenUrl } from '../lib/openUrl';
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
          <Text style={styles.headerSub}>Last Updated: August 2026</Text>
        </View>
        <View style={[styles.iconBtn, styles.iconBtnGhost]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}>

        {/* Section 0: About View2Earn */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={styles.sectionBadge}>OFFICIAL TERMS OF SERVICE</Text>
          <Text style={[styles.heading, { color: textMain }]}>About View2Earn</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Welcome to View2Earn ("View2Earn", "we", "our", or "us"). View2Earn is a digital engagement and rewards platform that enables eligible users to participate in supported activities, interact with approved content, and earn reward points that may be redeemed for available rewards in accordance with these Terms.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            These Terms of Service ("Terms") govern your access to and use of the View2Earn website, mobile applications, APIs, and all related products, features, content, and services (collectively, the "Service").
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            By accessing, registering for, or using the Service, you confirm that you have read, understood, and agree to be legally bound by these Terms, as well as our Privacy Policy and any other policies referenced within them. If you do not agree with any part of these Terms, you must not access or use the Service.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            View2Earn is committed to providing a secure, transparent, and fair platform for users, advertisers, and business partners. To protect the integrity of our ecosystem, all users are expected to comply with these Terms, applicable laws and regulations, and any additional rules or guidelines published by View2Earn from time to time.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Certain features of the Service may be provided through trusted third-party partners. Your use of those features may also be subject to the applicable terms and policies of those third-party providers. Where such terms apply, users are responsible for complying with both these Terms and the relevant third-party requirements.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            These Terms apply to every visitor, registered user, advertiser, partner, developer, and any other person or organization accessing or using the Service.
          </Text>
        </View>

        {/* Section 1: Eligibility */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>1. Eligibility</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            To use the Service, you must meet all of the following requirements:{'\n'}
            • You must be at least 18 years of age, or the minimum legal age required to enter into a binding agreement in your country or jurisdiction.{'\n'}
            • You must have the legal capacity to accept and comply with these Terms.{'\n'}
            • You must provide accurate, complete, and up-to-date information when creating and maintaining your account.{'\n'}
            • You may maintain only one (1) personal account unless we have provided written authorization for additional accounts.{'\n'}
            • You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.{'\n'}
            • You must not create or use an account on behalf of another person without their explicit authorization.{'\n'}
            • You must comply with all applicable laws, regulations, and the rules of any third-party platforms or reward providers integrated with the Service.{'\n'}
            • Where applicable, you must also comply with the terms, policies, and account requirements of supported blockchain ecosystems, including Pi Network and Sidra Chain.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            View2Earn reserves the right to verify your identity or eligibility at any time. We may request additional information or documentation to confirm your identity, ownership of your account, or compliance with these Terms.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            We may refuse registration, suspend access, restrict certain features, or permanently terminate any account that does not meet these eligibility requirements or that is suspected of violating these Terms, applicable laws, or our security and anti-fraud policies.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            You are solely responsible for ensuring that your use of the Service is lawful in your country or jurisdiction. If access to the Service is prohibited where you reside, you must not use the Service.
          </Text>
        </View>

        {/* Section 2: Points and Rewards */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>2. Points and Rewards</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn rewards eligible users with reward points for successfully completing qualifying activities made available through the Service. These activities may include, but are not limited to, engaging with approved content, participating in surveys, completing promotional tasks, referring eligible users, or other opportunities offered by View2Earn or its authorized partners.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>2.1 Reward Points</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Reward points are a promotional incentive provided by View2Earn and are not legal tender, electronic money, cryptocurrency, securities, or bank deposits.{'\n'}
            • Reward points have no cash value and may only be redeemed through the redemption methods and reward options made available within the Service.{'\n'}
            • Reward points may not be sold, transferred, exchanged, gifted, pledged, or traded between users unless expressly authorized by View2Earn.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>2.2 Earning Rewards</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Successfully complete eligible activities in accordance with all applicable instructions.{'\n'}
            • Comply with these Terms, our policies, and any requirements imposed by our advertising, survey, or reward partners.{'\n'}
            • Provide genuine, accurate, and honest participation at all times.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Completion of an activity does not guarantee that reward points will be credited. Activities may be reviewed and validated before rewards are issued.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>2.3 Verification and Approval</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            All reward points and redemption requests are subject to verification. View2Earn reserves the right to delay, review, reject, adjust, or cancel any reward, redemption request, or account balance where we reasonably believe that fraudulent activity has occurred; automated tools, bots, scripts, or emulators have been used; duplicate or multiple accounts exist; false or misleading information has been provided; an advertising or reward partner has rejected or reversed the activity; or these Terms or any applicable policies have been violated.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            To protect the integrity of the platform, rewards may be subject to a verification or holding period before becoming available for redemption.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>2.4 Redemption</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Reward points may only be redeemed through redemption options offered within the Service. Available rewards, redemption requirements, processing times, minimum redemption thresholds, and exchange rates may change at any time without prior notice.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            View2Earn reserves the right to refuse or reverse any redemption request that is determined to be fraudulent, unauthorized, or made in violation of these Terms.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>2.5 Changes to the Reward Program</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We may introduce, modify, suspend, or discontinue any reward program, campaign, earning opportunity, redemption option, or point value at our sole discretion. Such changes may occur without prior notice where necessary for operational, security, legal, or business reasons.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>2.6 Separate Ecosystems</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Where the Service supports multiple blockchain ecosystems, including Pi Network and Sidra Chain, each ecosystem operates independently. Reward points, balances, assets, and redemption options associated with one ecosystem cannot be transferred, exchanged, merged, or redeemed within another ecosystem unless View2Earn expressly announces support for such functionality.
          </Text>
        </View>

        {/* Section 3: Acceptable Use */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>3. Acceptable Use</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            To maintain a secure, fair, and trustworthy platform for all users, advertisers, and business partners, you agree to use the Service responsibly and in accordance with these Terms, our policies, and all applicable laws. You agree that you will NOT, directly or indirectly:
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>3.1 Account Abuse</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Create or operate multiple accounts without our prior written authorization.{'\n'}
            • Share, sell, rent, transfer, or allow another person to use your account.{'\n'}
            • Create accounts using false, misleading, or stolen information.{'\n'}
            • Impersonate another individual, organization, or entity.{'\n'}
            • Circumvent account restrictions, suspensions, or permanent bans by creating new accounts.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>3.2 Fraudulent Activity</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Use bots, automation tools, scripts, macros, click farms, emulators, or artificial intelligence systems to perform activities intended for genuine human participation.{'\n'}
            • Submit false, manipulated, duplicated, or fabricated screenshots, survey responses, or proof of task completion.{'\n'}
            • Attempt to earn rewards through deceptive, dishonest, or unauthorized methods.{'\n'}
            • Manipulate referral programs, promotional campaigns, or reward systems.{'\n'}
            • Generate fake traffic, fake engagements, or invalid activity intended to mislead advertisers or partners.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>3.3 Platform Security</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Attempt to hack, exploit, probe, scan, or interfere with the security of the Service.{'\n'}
            • Reverse engineer, decompile, modify, copy, or attempt to extract the source code of any part of the Service, except where permitted by applicable law.{'\n'}
            • Upload malicious software, viruses, worms, ransomware, spyware, or other harmful code.{'\n'}
            • Interfere with the operation, performance, or availability of the Service or any connected systems.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>3.4 Abuse of Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Where the Service integrates with third-party providers, including survey companies, advertisers, blockchain networks, payment providers, or social media platforms, you agree to comply with their applicable terms and policies. You must not engage in any activity that could result in fraud, invalid traffic, policy violations, or financial loss for View2Earn or its partners.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>3.5 Prohibited Conduct</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            • Engage in illegal, fraudulent, deceptive, or misleading activities.{'\n'}
            • Harass, threaten, intimidate, or abuse other users or members of the View2Earn community.{'\n'}
            • Upload or distribute unlawful, defamatory, hateful, obscene, or infringing content.{'\n'}
            • Violate the intellectual property rights, privacy rights, or other legal rights of any person or organization.{'\n'}
            • Use the Service in any manner that could damage the reputation, integrity, or security of View2Earn or its partners.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>3.6 Monitoring and Enforcement</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            To protect the integrity of the Service, View2Earn may monitor platform activity and investigate suspected violations of these Terms. Where we reasonably determine that a user has violated these Terms or engaged in suspicious, fraudulent, or abusive behavior, we may, without prior notice: suspend or permanently terminate the account; remove or reverse reward points and pending redemptions; cancel rewards or transactions associated with prohibited activity; restrict access to certain features of the Service; report unlawful activity to the appropriate authorities where required by law; and take any other action reasonably necessary to protect the Service, our users, advertisers, and business partners.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Our decisions regarding fraud detection, platform security, and enforcement are made in good faith to maintain a safe and reliable ecosystem for all participants.
          </Text>
        </View>

        {/* Section 4: Third-Party Services */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>4. Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn integrates with various third-party services to provide features, rewards, advertising opportunities, surveys, blockchain connectivity, payment processing, analytics, authentication, and other functionality. These third-party services are operated independently and are not owned or controlled by View2Earn unless expressly stated.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>4.1 Independent Third-Party Providers</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Certain features of the Service may be provided by independent third-party providers, including but not limited to: survey providers; offerwall providers; advertising partners; reward and redemption providers; payment processors; authentication providers; analytics and security services; social media platforms; and blockchain networks, including Pi Network and Sidra Chain.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Your use of these services may be subject to their own terms of service, privacy policies, and other applicable agreements. You are responsible for reviewing and complying with those terms where applicable.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>4.2 No Responsibility for Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn does not own, operate, or control third-party platforms and therefore does not guarantee: the availability or uninterrupted operation of third-party services; approval or rejection of surveys or offers; the accuracy, quality, legality, or security of third-party content; rewards, payments, or services provided directly by third parties; or the continued availability of any specific third-party integration.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Third-party providers may modify, suspend, or discontinue their services at any time without notice, and View2Earn is not responsible for such changes.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>4.3 Third-Party Decisions</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Some rewards, surveys, campaigns, and offers require validation by third-party providers before reward points can be credited. View2Earn has no control over a third-party provider's decisions regarding eligibility, qualification, validation, rejection, chargebacks, fraud detection, or reward approval. Where a third-party provider rejects, reverses, or invalidates an activity, View2Earn reserves the right to decline, reverse, or remove any associated reward points or redemption requests.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>4.4 Blockchain Networks</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Where the Service supports blockchain ecosystems such as Pi Network or Sidra Chain, each network operates independently under its own rules, policies, technical standards, and governance. View2Earn is not responsible for network outages or maintenance; blockchain delays or congestion; wallet issues; transaction failures caused by the blockchain; changes made by the blockchain's governing organization; or decisions made by the operators or administrators of any blockchain network.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Users are solely responsible for complying with the applicable rules of each supported blockchain ecosystem.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>4.5 External Links</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            The Service may contain links to third-party websites, applications, or services for your convenience. View2Earn does not endorse, monitor, or assume responsibility for the content, security, products, services, or practices of any external website or platform. Accessing third-party websites is entirely at your own risk.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>4.6 Future Integrations</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn may add, remove, replace, or discontinue third-party integrations at any time to improve the Service, enhance security, comply with legal requirements, or support business operations. The availability of any specific third-party provider should not be considered permanent or guaranteed.
          </Text>
        </View>

        {/* Section 5: Suspension and Termination */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>5. Suspension and Termination</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn is committed to maintaining a secure, fair, and trustworthy environment for all users, advertisers, partners, and service providers. To protect the integrity of the Service, we reserve the right to suspend, restrict, or terminate access to the Service under the circumstances described below.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>5.1 Suspension of Accounts</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We may temporarily suspend your account, with or without prior notice, if we reasonably believe that you have violated these Terms or any other View2Earn policy; your account has been involved in suspicious, fraudulent, deceptive, or unauthorized activity; we detect unusual login behavior, account compromise, or other security risks; verification of your identity or account ownership is required; we are required to do so by law, regulation, court order, or a request from a competent authority; or suspension is necessary to protect the security, integrity, or operation of the Service.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            During a suspension, certain features of the Service, including earning rewards, redeeming points, or accessing account information, may be restricted until our review is complete.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>5.2 Permanent Termination</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We may permanently terminate your account if you repeatedly violate these Terms or our policies; engage in fraud, deception, abuse, or other prohibited activities; use bots, automation tools, scripts, emulators, or any method intended to manipulate the Service; create or operate multiple unauthorized accounts; submit false information or fraudulent proof of completed activities; attempt to interfere with the security, functionality, or reliability of the Service; or cause financial, legal, operational, or reputational harm to View2Earn, its users, advertisers, or business partners.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Termination of your account may result in the permanent loss of access to the Service, including any unredeemed reward points, pending rewards, referrals, promotions, or other account benefits where permitted by applicable law.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>5.3 User-Initiated Termination</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            You may stop using the Service at any time. You may also request the closure of your account by contacting our support team through the official communication channels provided by View2Earn. Please note that closing your account does not automatically entitle you to receive pending rewards, restore expired points, or reverse any previous enforcement action taken under these Terms.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>5.4 Effect of Termination</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Upon suspension or termination: your right to access and use the Service immediately ends; any pending investigations may continue; reward points or redemption requests that are under review may be delayed, cancelled, or forfeited where fraud or policy violations are identified; and we may retain certain information where required for legal, regulatory, fraud prevention, accounting, audit, or security purposes, in accordance with our Privacy Policy and applicable laws.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>5.5 Survival</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Any provisions of these Terms that by their nature should continue after termination — including those relating to intellectual property, fraud prevention, limitation of liability, indemnification, dispute resolution, governing law, and any outstanding obligations — will remain in full force and effect after your account has been suspended or terminated.
          </Text>
        </View>

        {/* Section 6: Disclaimer of Warranties */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>6. Disclaimer of Warranties</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn is committed to providing a reliable, secure, and high-quality Service. However, the Service is provided on an "AS IS" and "AS AVAILABLE" basis, to the fullest extent permitted by applicable law.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>6.1 No Guarantee of Availability</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We do not guarantee that the Service will be available without interruption, delay, or downtime; all features, campaigns, surveys, offers, or reward opportunities will remain available indefinitely; errors, bugs, or technical issues will never occur; or the Service will always be compatible with every device, browser, operating system, or blockchain ecosystem.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Temporary interruptions may occur due to maintenance, software updates, security measures, third-party service outages, internet failures, or circumstances beyond our reasonable control.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>6.2 No Guarantee of Rewards or Earnings</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Participation in the Service does NOT guarantee eligibility for every campaign, survey, offer, or activity; approval of completed activities; a specific number of reward points; a particular reward value; continuous earning opportunities; or any minimum level of income or financial benefit. Rewards are always subject to eligibility requirements, verification procedures, fraud prevention measures, partner approval where applicable, and these Terms.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>6.3 Accuracy of Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Although we strive to keep all information accurate and up to date, we do not warrant that all content, statistics, descriptions, documentation, or other materials provided through the Service will always be complete, accurate, or free from errors. Users are responsible for verifying information before relying on it for important decisions.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>6.4 Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn makes no warranties regarding any products, services, software, websites, blockchain networks, payment providers, survey providers, advertisers, or other third-party services integrated with or accessible through the Service. Any interactions with third-party providers are governed by their own terms and policies.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>6.5 User Responsibility</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            You acknowledge that your use of the Service is entirely at your own discretion and risk. You are solely responsible for maintaining the security of your account and devices; protecting your login credentials; ensuring compliance with applicable laws and regulations; and reviewing the terms and policies of any third-party services you choose to use through the Service.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            To the fullest extent permitted by law, View2Earn expressly disclaims all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted availability.
          </Text>
        </View>

        {/* Section 7: Limitation of Liability */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>7. Limitation of Liability</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            To the fullest extent permitted by applicable law, View2Earn, its owners, directors, officers, employees, contractors, affiliates, licensors, business partners, and service providers shall not be liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages arising out of or relating to your access to or use of the Service. This limitation applies regardless of the legal theory on which a claim is based, including contract, tort (including negligence), strict liability, or any other legal basis.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>7.1 Events Beyond Our Control</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn shall not be responsible for any loss, damage, delay, or interruption resulting from circumstances beyond our reasonable control, including but not limited to internet or telecommunications failures; power outages; cyberattacks or malicious third-party activities; natural disasters or other force majeure events; government actions or regulatory restrictions; failures or interruptions of third-party services; and blockchain network congestion, outages, forks, or technical failures.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>7.2 Loss of Rewards or Opportunities</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn shall not be liable for any loss resulting from delayed or rejected reward verification; expired or forfeited reward points; suspended or cancelled campaigns; changes to reward values or redemption options; ineligibility for surveys, offers, or promotional activities; or decisions made by third-party partners regarding eligibility, fraud detection, or campaign participation.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>7.3 User Responsibility</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            You acknowledge and agree that you are solely responsible for maintaining the security of your account credentials; ensuring that the information you provide is accurate and up to date; backing up any information that is important to you; and using the Service in compliance with applicable laws and these Terms.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            View2Earn shall not be responsible for losses resulting from unauthorized access to your account caused by your failure to protect your login credentials or devices.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>7.4 Maximum Liability</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            To the fullest extent permitted by law, if View2Earn is found liable for any claim arising out of or relating to the Service, our total aggregate liability shall not exceed the amount, if any, that you paid directly to View2Earn for the specific Service giving rise to the claim during the twelve (12) months preceding the event. Where you have not paid any fees directly to View2Earn, our maximum liability shall be limited to the minimum amount permitted under applicable law.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>7.5 Jurisdictional Limitations</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities. Where such laws apply, some of the limitations contained in this section may not apply to you. In such cases, the limitations shall apply only to the maximum extent permitted by applicable law.
          </Text>
        </View>

        {/* Section 8: Intellectual Property Rights */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>8. Intellectual Property Rights</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn and its licensors own and retain all rights, title, and interest in the Service, including all intellectual property rights associated with the platform. Nothing in these Terms transfers ownership of any intellectual property from View2Earn to you.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>8.1 Ownership</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Unless otherwise stated, all content and materials available through the Service are the exclusive property of View2Earn or its licensors, including but not limited to the View2Earn name, logo, trademarks, and branding; website and mobile application designs; software, source code, object code, and system architecture; user interface (UI) and user experience (UX) designs; graphics, illustrations, icons, animations, and visual assets; text, documentation, guides, and educational materials; databases, algorithms, APIs, and proprietary technologies; and audio, video, images, and other multimedia content.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            These materials are protected by applicable copyright, trademark, patent, trade secret, and other intellectual property laws.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>8.2 Limited License</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Subject to your compliance with these Terms, View2Earn grants you a limited, non-exclusive, non-transferable, non-sublicensable, and revocable license to access and use the Service solely for your personal and lawful use. This license does not transfer ownership of any intellectual property rights.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>8.3 Restrictions</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Except as expressly permitted by View2Earn in writing, you may not copy, reproduce, distribute, or publicly display any part of the Service; modify, adapt, translate, or create derivative works from the Service; reverse engineer, decompile, disassemble, or attempt to discover the source code of the Service; remove, alter, or obscure any copyright, trademark, or proprietary notices; use the View2Earn name, logo, or branding in a manner that suggests sponsorship, endorsement, or affiliation without our prior written permission; or use automated tools to extract, scrape, or harvest data from the Service without authorization.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>8.4 Feedback</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            If you submit ideas, suggestions, feature requests, bug reports, or other feedback regarding the Service, you grant View2Earn a worldwide, perpetual, irrevocable, royalty-free, and transferable right to use, modify, reproduce, publish, distribute, and incorporate such feedback into the Service without compensation or obligation to you.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>8.5 Third-Party Intellectual Property</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            The Service may include trademarks, logos, software, or other intellectual property owned by third parties. All such intellectual property remains the property of its respective owners. Nothing in these Terms grants you any rights to use third-party intellectual property except as expressly permitted by its owner.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>8.6 Reporting Infringement</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            If you believe that content available through the Service infringes your intellectual property rights, please notify us through our official support channels (ip@view2earn.org). Your notice should include sufficient information to identify the alleged infringement and establish your ownership or authorization.
          </Text>
        </View>

        {/* Section 9: Privacy and Data Protection */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>9. Privacy and Data Protection</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Your privacy is important to View2Earn. We are committed to handling your personal information responsibly, transparently, and in accordance with applicable data protection laws. By accessing or using the Service, you acknowledge that View2Earn may collect, use, store, process, and disclose certain information as described in our Privacy Policy and as necessary to provide, secure, and improve the Service.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>9.1 Information We Collect</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Depending on how you use the Service, we may collect information including account registration information; profile and account preferences; device and browser information; IP address and approximate location information; activity and engagement history; reward and redemption records; communications with our support team; and technical logs, diagnostics, and security-related information.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            We collect only the information reasonably necessary to operate, maintain, secure, and improve the Service.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>9.2 How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Your information may be used to create and manage your account; deliver rewards and platform features; verify completed activities; detect, investigate, and prevent fraud or abuse; improve platform performance and user experience; respond to customer support requests; comply with legal and regulatory obligations; and communicate important service updates and security notices.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>9.3 Sharing of Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn does NOT sell your personal information. We may share limited information only where necessary with trusted service providers; reward and survey partners; payment processors; security and fraud prevention providers; analytics providers; and legal or regulatory authorities where required by applicable law.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>9.4 Data Security</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn implements reasonable administrative, technical, and organizational measures designed to protect personal information against unauthorized access, disclosure, alteration, or destruction.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>9.5 Data Retention</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We retain personal information only for as long as necessary to provide the Service, meet legal obligations, resolve disputes, prevent fraud, and enforce these Terms.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>9.6 Privacy Policy</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Our Privacy Policy forms an important part of your relationship with View2Earn and explains in greater detail how we collect, use, protect, and process your personal information.
          </Text>
        </View>

        {/* Section 10: Communications and Electronic Notices */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>10. Communications and Electronic Notices</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            By creating an account, accessing, or using the Service, you agree to receive communications from View2Earn electronically. These communications are an essential part of providing and operating the Service and may be delivered through email, in-app notifications, push notifications, SMS (where applicable), or other electronic methods that we make available.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>10.1 Types of Communications</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn may send communications relating to account registration and verification; security alerts and account protection; password resets and login notifications; reward confirmations and redemption updates; changes to the Service or its features; updates to these Terms, our Privacy Policy, or other legal documents; customer support responses; technical notices and maintenance announcements; fraud prevention and compliance matters; and other information necessary for the operation of the Service.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>10.2 Electronic Consent</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            You acknowledge and agree that electronic communications satisfy any legal requirement that communications be provided in writing. Where permitted by applicable law, electronic records and electronic signatures shall have the same legal effect as paper documents and handwritten signatures.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>10.3 Marketing Communications</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            With your consent where required by applicable law, View2Earn may occasionally send promotional communications regarding new features, services, campaigns, rewards, partnerships, or other business updates. You may unsubscribe from marketing communications at any time by using the unsubscribe link provided in the communication or by updating your account preferences.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>10.4 Accurate Contact Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            You are responsible for providing and maintaining a valid and up-to-date email address and any other contact information associated with your account. View2Earn is not responsible for missed communications resulting from inaccurate, outdated, or inaccessible contact information provided by you.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>10.5 Language of Communications</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Unless otherwise required by applicable law or expressly stated by View2Earn, all official communications, legal notices, and contractual documents shall be provided in the English language.
          </Text>
        </View>

        {/* Section 11: Dispute Resolution */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>11. Dispute Resolution</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn values fair, transparent, and efficient resolution of disputes. If a disagreement arises between you and View2Earn regarding the Service or these Terms, both parties agree to make reasonable efforts to resolve the matter in good faith before pursuing formal legal proceedings.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>11.1 Informal Resolution</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            If you believe that View2Earn has not fulfilled its obligations or if you have a complaint regarding the Service, you should first contact our support team through our official communication channels. Your notice should include your full name and registered account information; a clear description of the issue; relevant dates, screenshots, or supporting documentation, where available; and the outcome or resolution you are seeking.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>11.2 Good Faith Cooperation</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Both you and View2Earn agree to cooperate in good faith to resolve disputes efficiently and respectfully.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>11.3 Continued Compliance</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Unless prohibited by applicable law or unless the dispute makes continued use of the Service impossible, you agree to continue complying with these Terms while a dispute is being reviewed.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>11.4 Legal Remedies</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Nothing in this section prevents either party from seeking emergency legal relief, injunctive relief, or any other remedy available under applicable law where immediate action is necessary to prevent fraud, unauthorized access, intellectual property infringement, or other significant harm.
          </Text>
        </View>

        {/* Section 12: Governing Law and Jurisdiction */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>12. Governing Law and Jurisdiction</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            These Terms shall be governed by and interpreted in accordance with the laws of the jurisdiction in which View2Earn is legally established, without regard to any conflict of law principles. Until View2Earn formally designates its principal place of business or legal jurisdiction, these Terms shall be interpreted in a manner consistent with applicable international principles of contract law and mandatory consumer protection laws that apply to users in their respective jurisdictions.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>12.1 Compliance with Local Laws</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Users are solely responsible for ensuring that their access to and use of the Service complies with the laws, regulations, and legal requirements applicable in their country or jurisdiction.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>12.2 Jurisdiction</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Subject to any mandatory legal rights available under applicable law, disputes arising out of or relating to these Terms or the Service shall be submitted to the competent courts of the jurisdiction where View2Earn is legally established.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>12.3 International Users</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn may make the Service available to users in multiple countries and jurisdictions. Access to the Service from outside the country in which View2Earn is established is undertaken at the user's own initiative and risk.
          </Text>
        </View>

        {/* Section 13: Force Majeure */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>13. Force Majeure</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn shall not be liable for any failure, delay, interruption, or inability to perform its obligations under these Terms where such failure results from events beyond our reasonable control.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>13.1 Force Majeure Events</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            Force majeure events include, but are not limited to: natural disasters, including earthquakes, floods, hurricanes, storms, wildfires, or other severe weather events; acts of war, terrorism, civil unrest, riots, or armed conflict; pandemics, epidemics, or public health emergencies; government actions, sanctions, embargoes, legal restrictions, or regulatory changes; power outages, utility failures, or telecommunications disruptions; internet infrastructure failures or widespread network outages; cybersecurity incidents, including distributed denial-of-service (DDoS) attacks, ransomware attacks, or other malicious cyber events beyond our reasonable control; labor disputes, strikes, lockouts, or shortages of essential personnel or services; and failures, interruptions, or outages affecting third-party providers, cloud infrastructure, payment processors, blockchain networks, hosting providers, or other critical service providers.
          </Text>
        </View>

        {/* Sections 14-18 */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>14. Severability</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court or other competent legal authority, that provision shall be interpreted or modified, where possible, to reflect its original purpose while complying with applicable law. If the provision cannot be enforced, it shall be removed from these Terms only to the extent necessary. The remaining provisions will continue to be valid, enforceable, and in full force and effect.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>15. Entire Agreement</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            These Terms, together with our Privacy Policy and any other policies or legal documents expressly incorporated by reference, constitute the complete and entire agreement between you and View2Earn regarding your access to and use of the Service. These Terms supersede and replace all prior or contemporaneous communications, discussions, proposals, representations, understandings, or agreements relating to the Service, whether oral, written, or electronic.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>16. Changes to These Terms</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            As View2Earn continues to grow and improve, we may update these Terms from time to time to reflect changes to our Services, technology, business operations, legal requirements, security practices, or partnerships. When we make material changes to these Terms, we will make reasonable efforts to notify users through publishing the updated Terms on the View2Earn website or application, in-app notifications, or email.
          </Text>
          <Text style={[styles.paragraph, { color: textSub, marginTop: 8 }]}>
            Revised Terms become effective immediately upon publication. By continuing to access or use the Service after updated Terms become effective, you acknowledge and agree to be bound by the revised Terms.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>17. Assignment</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            You may not assign, transfer, delegate, sell, or otherwise dispose of any of your rights or obligations under these Terms without the prior written consent of View2Earn. View2Earn may assign, transfer, or delegate its rights and obligations under these Terms, in whole or in part, to an affiliate, successor, or another entity in connection with a merger, acquisition, corporate restructuring, sale of assets, or other business transaction.
          </Text>
          <Text style={[styles.subHeading, { color: textMain }]}>18. Ongoing Updates &amp; Acceptance</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            We reserve the right to modify, amend, replace, or update these Terms at any time when reasonably necessary. The latest version of these Terms will always display a "Last Updated" date at the top of the document. Continued use of the Service following published updates constitutes full acceptance of the updated Terms.
          </Text>
        </View>

        {/* Section 19: Contact Information */}
        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>19. Contact &amp; Support</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            View2Earn welcomes your questions, feedback, and legal inquiries. If you need assistance or wish to contact us regarding the Service or these Terms, please use the appropriate communication channel below:
          </Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => smartOpenUrl('mailto:support@view2earn.org')}>
            <Icon name="envelope" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>General Support: support@view2earn.org</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => smartOpenUrl('mailto:partners@view2earn.org')}>
            <Icon name="handshake" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>Business Partnerships: partners@view2earn.org</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => smartOpenUrl('mailto:legal@view2earn.org')}>
            <Icon name="gavel" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>Legal Notices: legal@view2earn.org</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => smartOpenUrl('mailto:ip@view2earn.org')}>
            <Icon name="copyright" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>Intellectual Property: ip@view2earn.org</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => smartOpenUrl('mailto:security@view2earn.org')}>
            <Icon name="shield-halved" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>Security Reports: security@view2earn.org</Text>
          </TouchableOpacity>

          <Text style={[styles.paragraph, { color: textSub, marginTop: 12 }]}>
            Official communications from View2Earn will be sent through our website, mobile application, or official email addresses ending with @view2earn.org.
          </Text>
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
  subHeading: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
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
