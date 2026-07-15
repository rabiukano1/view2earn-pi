import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { RootStackParamList } from '../navigation/types';
import { deviceFingerprint } from '../lib/device';
import { colors, radius, shadow } from '../theme';

type Ecosystem = 'PI' | 'SIDRA';
type StackNav = NativeStackNavigationProp<RootStackParamList, 'Academy'>;

type SubmitResult = {
  score: number;
  total: number;
  passed: boolean;
  pointsEarned: number;
  review: { correctIndex: number; explanation: string; selected: number }[];
};

export default function AcademyScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const route = useRoute();
  const params = (route.params ?? {}) as { userId?: string; ecosystem?: Ecosystem };

  const [localUserId, setLocalUserId] = useState<Id<'users'> | null>(null);
  const [ecosystem, setEcosystem] = useState<Ecosystem>(params.ecosystem ?? 'PI');
  const getOrCreateDevUser = useMutation(api.users.getOrCreateDevUser);

  const userId = (params.userId ?? localUserId) as Id<'users'> | null;

  useEffect(() => {
    if (!params.userId) {
      getOrCreateDevUser({ deviceFingerprint: deviceFingerprint() })
        .then(setLocalUserId)
        .catch(() => {});
    }
  }, [params.userId, getOrCreateDevUser]);

  const lessons = useQuery(
    api.academy.getAcademy,
    userId ? { userId, ecosystem } : 'skip',
  );
  const submitLevel = useMutation(api.academy.submitLevel);

  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);

  const open = lessons?.find((l) => l.level === openLevel) ?? null;

  const closeLesson = () => {
    setOpenLevel(null);
    setAnswers({});
    setResult(null);
  };

  const startLesson = (level: number) => {
    setOpenLevel(level);
    setAnswers({});
    setResult(null);
  };

  const submit = async () => {
    if (!userId || !open) return;
    const ordered = open.quiz.map((_, i) => (answers[i] ?? -1));
    if (ordered.some((a) => a < 0)) {
      Alert.alert('Answer every question first');
      return;
    }
    setBusy(true);
    try {
      const res = await submitLevel({ userId, ecosystem, level: open.level, answers: ordered });
      setResult(res as SubmitResult);
    } catch (e) {
      Alert.alert('Could not submit', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (open ? closeLesson() : navigation.goBack())}
          style={styles.backButton}>
          <Text style={[styles.backText]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dark && styles.textLight]}>
          {ecosystem === 'PI' ? 'Learn Pi' : 'Learn Sidra'}
        </Text>
        <View style={styles.backButton} />
      </View>

      {!open && (
        <View style={styles.toggleRow}>
          {(['PI', 'SIDRA'] as Ecosystem[]).map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.toggle, ecosystem === e && styles.toggleActive]}
              onPress={() => setEcosystem(e)}>
              <Text style={[styles.toggleText, ecosystem === e && styles.toggleTextActive]}>
                {e === 'PI' ? 'Pi' : 'Sidra'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {lessons === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : open ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={[styles.lessonTitle, dark && styles.textLight]}>{open.title}</Text>
          <Text style={[styles.lessonBody, dark && styles.textMuted]}>{open.body}</Text>

          {open.quiz.map((q, qi) => {
            const rev = result?.review[qi];
            return (
              <View key={qi} style={styles.qBlock}>
                <Text style={[styles.question, dark && styles.textLight]}>
                  {qi + 1}. {q.question}
                </Text>
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = rev && rev.correctIndex === oi;
                  const isWrongPick = rev && rev.selected === oi && rev.selected !== rev.correctIndex;
                  return (
                    <TouchableOpacity
                      key={oi}
                      disabled={!!result}
                      style={[
                        styles.option,
                        dark && styles.optionDark,
                        selected && !result && styles.optionSelected,
                        isCorrect && styles.optionCorrect,
                        isWrongPick && styles.optionWrong,
                      ]}
                      onPress={() => setAnswers((p) => ({ ...p, [qi]: oi }))}>
                      <Text style={[styles.optionText, dark && styles.textLight]}>
                        {String.fromCharCode(65 + oi)}. {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {rev && (
                  <Text style={styles.explanation}>{rev.explanation}</Text>
                )}
              </View>
            );
          })}

          {result ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultIcon}>{result.passed ? '🎉' : '📖'}</Text>
              <Text style={[styles.resultTitle, dark && styles.textLight]}>
                {result.passed ? 'Level passed!' : 'Not quite — review and retry'}
              </Text>
              <Text style={styles.resultScore}>
                {result.score} of {result.total} correct
              </Text>
              {result.pointsEarned > 0 && (
                <Text style={styles.resultPoints}>+{result.pointsEarned} pts</Text>
              )}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={result.passed ? closeLesson : () => setResult(null)}>
                <Text style={styles.primaryBtnText}>
                  {result.passed ? 'Back to levels' : 'Try again'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
              <Text style={styles.primaryBtnText}>{busy ? 'Checking…' : 'Submit'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
          {lessons.map((l) => (
            <TouchableOpacity
              key={l.level}
              disabled={l.locked}
              style={[styles.levelCard, dark && styles.cardDark, l.locked && styles.levelLocked]}
              onPress={() => startLesson(l.level)}>
              <View style={styles.levelNum}>
                <Text style={styles.levelNumText}>{l.locked ? '🔒' : l.passed ? '✅' : l.level}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={[styles.levelTitle, dark && styles.textLight]}>{l.title}</Text>
                <Text style={styles.levelMeta}>
                  {l.locked ? 'Locked' : l.passed ? 'Completed' : 'Tap to start'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: { width: 60 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  toggleText: { fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.primaryDeep },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    ...shadow.raised,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  levelLocked: { opacity: 0.5 },
  levelNum: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumText: { fontSize: 18, fontWeight: '800', color: colors.primaryDeep },
  levelInfo: { flex: 1 },
  levelTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  levelMeta: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  lessonTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12 },
  lessonBody: { fontSize: 15, lineHeight: 23, color: colors.textMuted, marginBottom: 24 },
  qBlock: { marginBottom: 20 },
  question: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 8,
  },
  optionDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.primarySoft },
  optionWrong: { borderColor: colors.danger },
  optionText: { fontSize: 14, color: colors.text },
  explanation: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  resultBox: { alignItems: 'center', gap: 6, marginTop: 8 },
  resultIcon: { fontSize: 44 },
  resultTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  resultScore: { fontSize: 26, fontWeight: '800', color: colors.primary },
  resultPoints: { fontSize: 16, color: colors.success, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    ...shadow.raised,
  },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
