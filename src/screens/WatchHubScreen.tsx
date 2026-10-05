import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { colors, radius, spacing, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WatchHub'>;

export default function WatchHubScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const voiceCount = useQuery(api.voiceNotes.list)?.length ?? 0;
  // Admin panel -> Features. A missing flag means enabled, so nothing changes
  // until an admin explicitly turns a row off.
  const flags = useQuery(api.features.getFlags) || {};
  const on = (key: string) => flags[key] !== false;

  if (!on('feature:watch')) {
    return (
      <View style={[styles.container, dark && styles.containerDark]}>
        <PageHeader title="Watch" subtitle="Temporarily unavailable" back />
      </View>
    );
  }

  // Every destination in one list so they all render as identical tiles,
  // matching the "Explore Platform" grid on the home screen.
  const tiles = [
    ...(on('feature:watch.videos')
      ? [{
          key: 'videos',
          label: 'Videos',
          desc: 'Short tutorials from View2Earn',
          icon: 'video',
          brand: false,
          tint: '#EC4899',
          count: undefined as number | undefined,
          go: () => navigation.navigate('CommunityVideos'),
        }]
      : []),
    ...(on('feature:watch.voice')
      ? [{
          key: 'voice',
          label: 'Mentors',
          desc: 'Voice notes & episodes',
          icon: 'microphone',
          brand: false,
          tint: '#F59E0B',
          count: voiceCount,
          go: () => navigation.navigate('VoiceNotes'),
        }]
      : []),
  ];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Watch" subtitle="Short tutorials & mentors" back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {tiles.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tile, dark && styles.cardDark]}
              activeOpacity={0.85}
              onPress={t.go}>
              <View style={[styles.tileIcon, { backgroundColor: t.tint + '22' }]}>
                <Icon name={t.icon} iconStyle={t.brand ? 'brand' : 'solid'} size={22} color={t.tint} />
              </View>
              <Text style={[styles.tileLabel, dark && styles.textLight]}>{t.label}</Text>
              <Text style={styles.tileDesc} numberOfLines={1}>{t.desc}</Text>
              {t.count !== undefined && t.count > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{t.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  // Mirrors the Explore Platform grid in HomeScreen — keep the two in step.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileLabel: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  tileDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  countBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  countText: { fontSize: 11, fontWeight: '900', color: colors.primaryDeep },
  textLight: { color: colors.textDark },
});
