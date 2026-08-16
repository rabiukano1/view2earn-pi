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
import { openTaskLink } from '../services/TaskLinkService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { PolicyKey } from '@view2earn/core';
import { getPolicyDoc, type PolicyBlock } from '@view2earn/core';
import { colors, radius, shadow } from '../theme';
import Icon from '../components/Icon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Policy'>;

export default function PolicyScreen({ route }: { route: { params: { policy: PolicyKey } } }) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const doc = getPolicyDoc(route.params.policy);

  const textMain = dark ? colors.textDark : colors.text;
  const textSub = colors.textMuted;

  const renderBlock = (block: PolicyBlock, index: number) => {
    switch (block.t) {
      case 'h':
        return (
          <Text key={index} style={[styles.heading, { color: textMain }]}>
            {block.x}
          </Text>
        );
      case 's':
        return (
          <Text key={index} style={[styles.subheading, { color: textMain }]}>
            {block.x}
          </Text>
        );
      case 'p':
        return (
          <Text key={index} style={[styles.paragraph, { color: textSub }]}>
            {block.x}
          </Text>
        );
      case 'l':
        return (
          <View key={index} style={styles.bulletGroup}>
            {block.x.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={[styles.bulletText, { color: textSub }]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

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
          <Text style={[styles.headerTitle, { color: textMain }]}>{doc.title.toUpperCase()}</Text>
          <Text style={styles.headerSub}>Last Updated: {doc.lastUpdated}</Text>
        </View>
        <View style={[styles.iconBtn, styles.iconBtnGhost]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 40) }]}>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={styles.sectionBadge}>{doc.badge}</Text>
          {doc.blocks.map(renderBlock)}
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <Text style={[styles.heading, { color: textMain }]}>Contact Information</Text>
          <Text style={[styles.paragraph, { color: textSub }]}>
            For any questions, data requests, or legal notices regarding this document, contact our official channels:
          </Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openTaskLink(`mailto:privacy@view2earn.org?subject=${encodeURIComponent(`${doc.title} Inquiry`)}`)}>
            <Icon name="envelope" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>privacy@view2earn.org</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openTaskLink('https://view2earn.org/support')}>
            <Icon name="globe" iconStyle="solid" size={16} color={colors.primary} />
            <Text style={styles.linkText}>https://view2earn.org/support</Text>
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
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
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
    marginBottom: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 4,
  },
  bulletGroup: {
    marginTop: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
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
