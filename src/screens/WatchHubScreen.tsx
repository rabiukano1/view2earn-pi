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

const SECTIONS = [
  {
    key: 'football' as const,
    title: 'Live Football',
    subtitle: 'Licensed football & sports streams',
    icon: 'futbol',
    tint: '#10B981',
  },
  {
    key: 'youtube' as const,
    title: 'YouTube Videos',
    subtitle: 'YouTube watch & live videos',
    icon: 'youtube',
    tint: '#EF4444',
  },
  {
    key: 'other' as const,
    title: 'Live Streams',
    subtitle: 'Other live channels & broadcasts',
    icon: 'tv',
    tint: '#3B82F6',
  },
  {
    key: 'movies' as const,
    title: 'Movies',
    subtitle: 'Full-length movies & shows',
    icon: 'film',
    tint: '#A855F7',
  },
] as const;

export default function WatchHubScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const docs = useQuery(api.iptv.list);
  const voiceCount = useQuery(api.voiceNotes.list)?.length ?? 0;

  const counts = {
    football: docs?.filter((d) => d.type === 'football').length ?? 0,
    youtube: docs?.filter((d) => d.type === 'youtube').length ?? 0,
    other: docs?.filter((d) => d.type === 'other').length ?? 0,
    movies: docs?.filter((d) => d.type === 'movies').length ?? 0,
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Watch" subtitle="Football, YouTube & other live streams" back />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.card, dark && styles.cardDark]}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('LiveStreams', { kind: s.key })}>
            <View style={[styles.iconWrap, { backgroundColor: s.tint + '22' }]}>
              <Icon name={s.icon} iconStyle={s.key === 'youtube' ? 'brand' : 'solid'} size={24} color={s.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, dark && styles.textLight]}>{s.title}</Text>
              <Text style={styles.subtitle}>{s.subtitle}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{counts[s.key]}</Text>
            </View>
            <Icon name="chevron-right" iconStyle="solid" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.card, dark && styles.cardDark]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('VoiceNotes')}>
          <View style={[styles.iconWrap, { backgroundColor: '#F59E0B22' }]}>
            <Icon name="microphone" iconStyle="solid" size={24} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, dark && styles.textLight]}>Mentors</Text>
            <Text style={styles.subtitle}>Voice notes, episodes & announcements</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{voiceCount}</Text>
          </View>
          <Icon name="chevron-right" iconStyle="solid" size={18} color={colors.textFaint} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  countBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  countText: { fontSize: 12, fontWeight: '900', color: colors.primaryDeep },
  textLight: { color: colors.textDark },
});
