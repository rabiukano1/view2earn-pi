import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StatusBar,
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
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
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

// Entrance stagger for the level list — mirrors the pi-app rise animation.
const RISE = { toValue: 1, duration: 420, useNativeDriver: true };

export default function AcademyScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const route = useRoute();
  const params = (route.params ?? {}) as { userId?: string; ecosystem?: Ecosystem };

  const { userId } = useAuth();
  const [ecosystem, setEcosystem] = useState<Ecosystem>(params.ecosystem ?? 'PI');

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

  const passed = (lessons ?? []).filter((l) => l.passed).length;
  const total = (lessons ?? []).length;
  const progressPct = total > 0 ? passed / total : 0;

  // Level-card entrance stagger (re-keyed per lesson/ecosystem switch).
  const [entrance, setEntrance] = useState<Animated.Value[]>([]);
  useEffect(() => {
    const anims = (lessons ?? []).map(() => new Animated.Value(0));
    setEntrance(anims);
    Animated.stagger(45, anims.map((v) => Animated.timing(v, RISE))).start();
    return () => {
      anims.forEach((v) => v.stopAnimation());
    };
  }, [lessons]);

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
    <View style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={open ? (dark ? 'light-content' : 'dark-content') : 'light-content'} />

      {!open ? (
        <>
          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
            <View style={styles.heroTop}>
              <Text style={styles.heroTitle}>{ecosystem === 'PI' ? 'Learn Pi' : 'Learn Sidra'}</Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.heroBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.heroBackText}>← Home</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.heroHi}>Keep learning 🎓</Text>
            <Text style={styles.heroLabel}>Lessons passed</Text>
            <Text style={styles.heroCount}>{lessons === undefined ? '—' : `${passed}/${total}`}</Text>

            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMeta}>
                {progressPct === 0 ? 'Start level 1' : `${Math.round(progressPct * 100)}% complete`}
              </Text>
            </View>
            <View style={styles.heroTrack}>
              <View
                style={[styles.heroFill, { width: `${progressPct * 100}%` }]}
              />
            </View>
          </View>

          {/* Ecosystem toggle */}
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
        </>
      ) : null}

      {lessons === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : open ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.lessonHead}>
            <TouchableOpacity onPress={closeLesson} style={styles.backLink}>
              <Text style={styles.backLinkText}>← All lessons</Text>
            </TouchableOpacity>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Level {open.level}</Text>
            </View>
          </View>

          <Text style={[styles.lessonTitle, dark && styles.textLight]}>{open.title}</Text>
          <Text style={[styles.lessonBody, dark && styles.textMuted]}>{open.body}</Text>

          <Text style={[styles.sectionTitle, dark && styles.textLight]}>Quiz</Text>

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
                  const letterStyle = [
                    styles.optionLetter,
                    selected && !result && styles.optionLetterSelected,
                    isCorrect && styles.optionLetterCorrect,
                    isWrongPick && styles.optionLetterWrong,
                  ];
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
                      activeOpacity={0.85}
                      onPress={() => setAnswers((p) => ({ ...p, [qi]: oi }))}>
                      <View style={letterStyle}>
                        <Text style={styles.optionLetterText}>{String.fromCharCode(65 + oi)}</Text>
                      </View>
                      <Text style={[styles.optionText, dark && styles.textLight]}>{opt}</Text>
                      {(selected && !result) || isCorrect ? (
                        <Text style={[styles.optionCheck, isCorrect && styles.optionCheckCorrect]}>✓</Text>
                      ) : null}
                      {isWrongPick ? (
                        <Text style={styles.optionCheckWrong}>✕</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {rev && (
                  <View style={styles.explanation}>
                    <Text style={styles.explanationText}>
                      <Text style={styles.explanationLabel}>
                        {rev.selected === rev.correctIndex ? 'Correct — ' : 'Explanation — '}
                      </Text>
                      {rev.explanation}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {result ? (
            <View style={[styles.resultBox, result.passed && styles.resultBoxPass]}>
              <Text style={styles.resultIcon}>{result.passed ? '🎉' : '📖'}</Text>
              <Text style={[styles.resultTitle, dark && styles.textLight]}>
                {result.passed ? 'Level passed!' : 'Not quite — review and retry'}
              </Text>
              <Text style={[styles.resultScore, result.passed && styles.resultScorePass]}>
                {result.score} of {result.total} correct
              </Text>
              {result.pointsEarned > 0 && (
                <Text style={styles.resultPoints}>+{result.pointsEarned} pts</Text>
              )}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={result.passed ? closeLesson : () => setResult(null)}>
                <Text style={styles.primaryBtnText}>
                  {result.passed ? 'Back to lessons' : 'Try again'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
              <Text style={styles.primaryBtnText}>{busy ? 'Checking…' : 'Submit quiz'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}>
          {lessons.map((l, i) => {
            const anim = entrance[i];
            const scale = anim?.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            });
            return (
              <Animated.View
                key={l.level}
                style={{ opacity: anim ?? 1, transform: [{ translateY: anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) : 0 }, { scale: scale ?? 1 }] }}>
                <TouchableOpacity
                  disabled={l.locked}
                  style={[styles.levelCard, dark && styles.cardDark, l.locked && styles.levelLocked]}
                  activeOpacity={0.85}
                  onPress={() => startLesson(l.level)}>
                  <View style={[styles.levelNum, l.passed && styles.levelNumPass, l.locked && styles.levelNumLocked]}>
                    <Text style={[styles.levelNumText, l.passed && styles.levelNumTextPass, l.locked && styles.levelNumTextLocked]}>
                      {l.locked ? '🔒' : l.passed ? '✓' : l.level}
                    </Text>
                  </View>
                  <View style={styles.levelInfo}>
                    <Text style={[styles.levelTitle, dark && styles.textLight]}>{l.title}</Text>
                    <Text style={styles.levelMeta}>
                      {l.locked
                        ? 'Complete the previous lesson to unlock'
                        : l.passed
                          ? 'Completed · review anytime'
                          : 'Lesson ready · tap to start'}
                    </Text>
                  </View>
                  {l.passed ? (
                    <View style={styles.levelChevPass}>
                      <Text style={styles.levelChevPassText}>+10 pts</Text>
                    </View>
                  ) : l.locked ? null : (
                    <Text style={styles.levelChev}>→</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <View style={[styles.tip, dark && styles.tipDark]}>
            <Text style={styles.tipIcon}>💡</Text>
            <View style={styles.tipBody}>
              <Text style={[styles.tipTitle, dark && styles.textLight]}>Passing tip</Text>
              <Text style={styles.tipText}>
                Each lesson unlocks the next. Read the guide carefully — the quiz questions follow it closely.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.raised,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  heroTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  heroBack: {
    backgroundColor: '#FFFFFF22',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  heroBackText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  heroHi: { color: '#EDE9FE', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  heroLabel: { color: '#EDE9FE', fontSize: 12, fontWeight: '600', opacity: 0.9 },
  heroCount: {
    color: colors.white,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  heroMetaRow: { marginTop: 10 },
  heroMeta: { color: '#EDE9FE', fontSize: 13, fontWeight: '700' },
  heroTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF33',
    marginTop: 8,
    overflow: 'hidden',
  },
  heroFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.white },

  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
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

  scroll: { paddingHorizontal: 20, paddingTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },

  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  cardDark: { backgroundColor: colors.surfaceDark },
  levelLocked: { opacity: 0.55 },
  levelNum: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumPass: { backgroundColor: '#D1FAE5' },
  levelNumLocked: { backgroundColor: colors.surfaceAlt },
  levelNumText: { fontSize: 18, fontWeight: '800', color: colors.primaryDeep },
  levelNumTextPass: { color: '#047857' },
  levelNumTextLocked: { color: colors.textMuted },
  levelInfo: { flex: 1 },
  levelTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  levelMeta: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600', marginTop: 3 },
  levelChev: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  levelChevPass: {
    backgroundColor: '#D1FAE5',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  levelChevPassText: { color: '#047857', fontWeight: '800', fontSize: 12 },

  lessonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backLink: { paddingVertical: 4 },
  backLinkText: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  levelBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  levelBadgeText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 11, letterSpacing: 0.4 },

  lessonTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 12 },
  lessonBody: { fontSize: 15, lineHeight: 23, color: colors.textMuted, marginBottom: 18 },
  qBlock: { marginBottom: 20 },
  question: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 13,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 8,
  },
  optionDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCorrect: { borderColor: colors.success, backgroundColor: '#ECFDF5' },
  optionWrong: { borderColor: colors.danger, backgroundColor: '#FEF2F2' },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterSelected: { backgroundColor: colors.primary },
  optionLetterCorrect: { backgroundColor: colors.success },
  optionLetterWrong: { backgroundColor: colors.danger },
  optionLetterText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  optionCheck: { color: colors.primary, fontWeight: '900' },
  optionCheckCorrect: { color: colors.success },
  optionCheckWrong: { color: colors.danger, fontWeight: '900' },
  explanation: {
    marginTop: 2,
    marginBottom: 10,
    padding: 10,
    paddingLeft: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  explanationText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  explanationLabel: { fontWeight: '800', color: colors.text },

  resultBox: {
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 26,
    paddingHorizontal: 20,
    ...shadow.card,
  },
  resultBoxPass: { borderWidth: 2, borderColor: colors.success },
  resultIcon: { fontSize: 48 },
  resultTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  resultScore: { fontSize: 26, fontWeight: '800', color: colors.primary },
  resultScorePass: { color: colors.success },
  resultPoints: { fontSize: 16, color: colors.success, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
    ...shadow.raised,
  },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  tip: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: 16,
    marginTop: 6,
  },
  tipDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  tipIcon: { fontSize: 20 },
  tipBody: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 2 },
  tipText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textMuted },
});
