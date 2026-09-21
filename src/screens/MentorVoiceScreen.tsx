import React, { useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useQuery } from 'convex/react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { api } from '../../convex/_generated/api';
import { CONVEX_SITE_URL } from '../config';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import VoiceNoteList, { TYPE_ICON, TYPE_LABEL, initials, type Note, type NoteType } from '../components/VoiceNoteList';
import { colors, radius, spacing, shadow } from '../theme';

type Route = RouteProp<RootStackParamList, 'MentorVoice'>;
type Filter = NoteType | 'all';
const FILTERS: Filter[] = ['all', 'episode', 'update', 'announcement'];
const label = (f: Filter) => (f === 'all' ? 'All voice notes' : `${TYPE_LABEL[f]}s`);

// One mentor, their notes only: type dropdown + search scoped to this mentor.
export default function MentorVoiceScreen() {
  const dark = useColorScheme() === 'dark';
  const { mentor } = useRoute<Route>().params;
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const all = useQuery(api.voiceNotes.list) as Note[] | undefined;
  const profile = useQuery(api.voiceNotes.mentors)?.find((m) => m.name === mentor);
  const found = useQuery(
    api.voiceNotes.search,
    q.trim() ? { q, mentor, type: filter === 'all' ? undefined : filter } : 'skip',
  ) as Note[] | undefined;

  const mine = useMemo(() => all?.filter((n) => n.mentor === mentor), [all, mentor]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: mine?.length ?? 0, episode: 0, update: 0, announcement: 0 };
    for (const n of mine ?? []) if (n.type) c[n.type] += 1;
    return c;
  }, [mine]);
  const notes = useMemo(() => {
    if (q.trim()) return found;
    return mine?.filter((n) => filter === 'all' || n.type === filter);
  }, [q, found, mine, filter]);

  const header = (
    <View style={styles.header}>
      <View style={styles.profile}>
        {profile?.photoUrl || profile?.hasPhoto ? (
          <Image source={{ uri: profile.photoUrl || `${CONVEX_SITE_URL}/mentor/photo?id=${profile._id}` }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(mentor)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, dark && styles.textLight]}>{mentor}</Text>
          {profile?.role ? <Text style={styles.role}>{profile.role}</Text> : null}
          <Text style={styles.meta}>
            {counts.all} voice note{counts.all === 1 ? '' : 's'}
            {counts.episode ? ` · ${counts.episode} episodes` : ''}
          </Text>
        </View>
        {profile?.telegram ? (
          <TouchableOpacity
            style={styles.tgBtn}
            onPress={() => Linking.openURL(`https://t.me/${profile.telegram}`).catch(() => {})}
            hitSlop={8}>
            <Icon name="telegram" iconStyle="brand" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
      {profile?.bio ? <Text style={[styles.bio, dark && styles.bioDark]}>{profile.bio}</Text> : null}

      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.dropdown, dark && styles.dropdownDark]} onPress={() => setOpen(true)} activeOpacity={0.85}>
          {filter !== 'all' ? <Icon name={TYPE_ICON[filter]} iconStyle="solid" size={13} color={colors.primary} /> : null}
          <Text style={[styles.dropdownText, dark && styles.textLight]} numberOfLines={1}>
            {label(filter)}
          </Text>
          <Icon name="chevron-down" iconStyle="solid" size={12} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={[styles.searchBox, dark && styles.searchBoxDark]}>
          <Icon name="magnifying-glass" iconStyle="solid" size={13} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, dark && styles.textLight]}
            placeholder="Search…"
            placeholderTextColor={colors.textMuted}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={10}>
              <Icon name="circle-xmark" iconStyle="solid" size={15} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );

  const emptyText = q.trim()
    ? `Nothing found for "${q}"`
    : filter === 'all'
    ? `${mentor} has no voice notes yet`
    : `${mentor} has no ${label(filter).toLowerCase()} yet`;

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader title="Mentor" back />
      <VoiceNoteList notes={notes} emptyText={emptyText} hideMentor ListHeaderComponent={header} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, dark && styles.menuDark]}>
            {FILTERS.map((f) => {
              const on = f === filter;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.menuItem, on && styles.menuItemOn]}
                  onPress={() => {
                    setFilter(f);
                    setOpen(false);
                  }}>
                  <View style={styles.menuIcon}>
                    {f === 'all' ? (
                      <Icon name="list" iconStyle="solid" size={14} color={on ? colors.primary : colors.textMuted} />
                    ) : (
                      <Icon name={TYPE_ICON[f]} iconStyle="solid" size={14} color={on ? colors.primary : colors.textMuted} />
                    )}
                  </View>
                  <Text style={[styles.menuText, dark && styles.textLight, on && { color: colors.primary }]}>{label(f)}</Text>
                  <Text style={styles.menuCount}>{counts[f]}</Text>
                  {on ? <Icon name="check" iconStyle="solid" size={14} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: { marginBottom: spacing.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '22' },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  role: { fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: 1 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  bio: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginBottom: spacing.md },
  bioDark: { color: colors.textDark },
  tgBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#229ED9', alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', gap: spacing.sm },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: '55%',
  },
  dropdownDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  dropdownText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchBoxDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: colors.text },
  textLight: { color: colors.textDark },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menu: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    ...shadow,
  },
  menuDark: { backgroundColor: colors.surfaceDark },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  menuItemOn: { backgroundColor: colors.primary + '14' },
  menuIcon: { width: 24, alignItems: 'center' },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  menuCount: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});
