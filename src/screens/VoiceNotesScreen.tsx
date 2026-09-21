import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { CONVEX_SITE_URL } from '../config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { initials, type Note } from '../components/VoiceNoteList';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VoiceNotes'>;

// Mentor directory — one card per mentor; tapping opens that mentor's own screen.
export default function VoiceNotesScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [q, setQ] = useState('');

  const mentors = useQuery(api.voiceNotes.mentors);
  const notes = useQuery(api.voiceNotes.list) as Note[] | undefined;

  const cards = useMemo(() => {
    if (!mentors) return undefined;
    const stats: Record<string, { count: number; latest: number }> = {};
    for (const n of notes ?? []) {
      if (!n.mentor) continue;
      const s = (stats[n.mentor] ??= { count: 0, latest: 0 });
      s.count += 1;
      s.latest = Math.max(s.latest, n.createdAt);
    }
    return mentors
      .map((m) => ({ ...m, ...(stats[m.name] ?? { count: 0, latest: 0 }) }))
      .filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => b.latest - a.latest || a.name.localeCompare(b.name));
  }, [mentors, notes, q]);

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Mentors" subtitle="Voice notes, episodes & announcements" back />
      <View style={[styles.searchBox, dark && styles.searchBoxDark]}>
        <Icon name="magnifying-glass" iconStyle="solid" size={14} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, dark && styles.textLight]}
          placeholder="Find a mentor…"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
        />
        {q ? (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={10}>
            <Icon name="circle-xmark" iconStyle="solid" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!cards ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>{q ? `No mentor matches "${q}"` : 'No mentors yet'}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, dark && styles.cardDark]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MentorVoice', { mentor: item.name })}>
              {item.photoUrl || item.hasPhoto ? (
                <Image source={{ uri: item.photoUrl || `${CONVEX_SITE_URL}/mentor/photo?id=${item._id}` }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, dark && styles.textLight]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.role ? (
                  <Text style={styles.role} numberOfLines={1}>
                    {item.role}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {item.count} voice note{item.count === 1 ? '' : 's'}
                  {item.latest ? ` · latest ${new Date(item.latest).toLocaleDateString()}` : ''}
                </Text>
              </View>
              <Icon name="chevron-right" iconStyle="solid" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchBoxDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '22' },
  avatarText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  role: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 1 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  textLight: { color: colors.textDark },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});
