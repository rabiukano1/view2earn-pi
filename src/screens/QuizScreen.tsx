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
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { RootStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';

type Question = {
  _id: Id<'quizQuestions'>;
  question: string;
  options: string[];
};

type Answer = {
  questionId: Id<'quizQuestions'>;
  selectedIndex: number;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

export default function QuizScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();
  const { userId } = useAuth();
  const [localEcosystem] = useState<'PI' | 'SIDRA'>('SIDRA');

  const params = route.params;
  const ecosystem: 'PI' | 'SIDRA' = params?.ecosystem ?? localEcosystem;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    pointsEarned: number;
    review: {
      correctIndex: number;
      selected: number;
      explanation: string;
      courseKey: string | null;
      courseTitle: string | null;
      lessonNumber: number | null;
      lessonTitle: string | null;
    }[];
  } | null>(null);

  const [shuffledOptions, setShuffledOptions] = useState<Record<string, { opt: string; originalIndex: number }[]>>({});

  const questions = useQuery(
    api.quiz.getDailyQuiz,
    userId ? { userId, ecosystem, day: new Date().getDay() } : 'skip',
  );
  const submitQuiz = useMutation(api.quiz.submitQuiz);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers([]);
    setSubmitted(false);
    setResult(null);
    setShuffledOptions({});
  }, []);

  const loading = questions === undefined;
  const current = questions?.[currentIndex];

  useEffect(() => {
    if (questions) {
      setShuffledOptions((prev) => {
        const next = { ...prev };
        let changed = false;
        questions.forEach((q) => {
          if (!next[q._id]) {
            const arr = q.options.map((opt, i) => ({ opt, originalIndex: i }));
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            next[q._id] = arr;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [questions]);

  const handleSelect = (selectedIndex: number) => {
    if (!current || submitted) return;
    const existing = answers.findIndex((a) => a.questionId === current._id);
    if (existing >= 0) {
      setAnswers((prev) => {
        const next = [...prev];
        next[existing] = { questionId: current._id, selectedIndex };
        return next;
      });
    } else {
      setAnswers((prev) => [...prev, { questionId: current._id, selectedIndex }]);
    }
  };

  const executeSubmit = async () => {
    if (!userId || !questions || answers.length === 0) {
      Alert.alert('Answer at least one question to submit');
      return;
    }
    setSubmitted(true);
    try {
      const res = await submitQuiz({ userId, answers });
      setResult(res);
    } catch (e) {
      Alert.alert('Error submitting quiz', String(e));
      setSubmitted(false);
    }
  };

  const handleSubmit = () => {
    executeSubmit();
  };

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, dark && styles.textLight]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dark && styles.textLight]}>Daily Quiz</Text>
        <View style={styles.backButton} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : result ? (
        <ScrollView
          contentContainerStyle={[styles.center, { paddingVertical: 30, paddingHorizontal: 20 }]}>
          <Text style={styles.resultIcon}>{result.score > 0 ? '🎉' : '📚'}</Text>
          <Text style={[styles.resultTitle, dark && styles.textLight]}>
            {result.score > 0 ? 'Quiz Complete!' : 'Keep Learning!'}
          </Text>
          <Text style={styles.resultScore}>
            {result.score} / {result.total}
          </Text>
          {Boolean(result.pointsEarned > 0) ? (
            <Text style={styles.resultPoints}>+{result.pointsEarned} Points Earned!</Text>
          ) : null}

          {Boolean(result.review && result.review.length > 0) ? (
            <View style={styles.reviewWrap}>
              <Text style={[styles.reviewTitle, dark && styles.textLight]}>Review your answers</Text>
              {result.review.map((r, i) => {
                const q = questions?.[i];
                if (!q) return null;
                const isCorrect = r.selected === r.correctIndex;
                return (
                  <View key={i} style={styles.reviewItem}>
                    <Text style={[styles.reviewQuestion, dark && styles.textLight]}>
                      {isCorrect ? '✓ ' : '✕ '}
                      {q.question}
                    </Text>
                    {q.options.map((opt, oi) => {
                      const isRight = oi === r.correctIndex;
                      const isPicked = oi === r.selected;
                      return (
                        <View
                          key={oi}
                          style={[
                            styles.reviewOption,
                            isRight && styles.reviewOptionRight,
                            isPicked && !isRight && styles.reviewOptionPicked,
                          ]}>
                          <Text
                            style={[
                              styles.reviewOptionText,
                              dark && styles.textLight,
                              (isRight || (isPicked && !isRight)) && styles.reviewOptionTextStrong,
                            ]}>
                            {String.fromCharCode(65 + oi)}. {opt}
                          </Text>
                          {isRight ? (
                            <Text style={styles.reviewMarkRight}>✓</Text>
                          ) : isPicked ? (
                            <Text style={styles.reviewMarkWrong}>✕</Text>
                          ) : null}
                        </View>
                      );
                    })}
                    {r.explanation ? (
                      <Text style={[styles.reviewExplanation, dark && styles.textMuted]}>
                        <Text style={styles.reviewExplanationLabel}>Why? </Text>
                        {r.explanation}
                      </Text>
                    ) : null}
                    {Boolean(r.courseKey && r.lessonNumber) ? (
                      <TouchableOpacity
                        style={styles.learnMore}
                        onPress={() =>
                          navigation.navigate('Academy', {
                            ecosystem: ecosystem,
                          })
                        }>
                        <Text style={styles.learnMoreText}>
                          📚 Learn more: {r.courseTitle} → {r.lessonTitle ?? `Lesson ${r.lessonNumber}`}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : current ? (
        <View style={styles.quizContent}>
          <View style={styles.counterRow}>
            <Text style={styles.counter}>
              Question {currentIndex + 1} of {questions.length}
            </Text>
          </View>
          <Text style={[styles.question, dark && styles.textLight]}>
            {current.question}
          </Text>
          <View style={styles.optionsContainer}>
            {(shuffledOptions[current._id] ?? current.options.map((opt, i) => ({ opt, originalIndex: i }))).map((item) => {
              const selected =
                answers.find((a) => a.questionId === current._id)?.selectedIndex === item.originalIndex;
              return (
                <TouchableOpacity
                  key={item.originalIndex}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                    dark && styles.optionDark,
                  ]}
                  onPress={() => handleSelect(item.originalIndex)}>
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                      dark && styles.textLight,
                    ]}>
                    {item.opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.footer}>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setCurrentIndex((i) => i - 1)}>
                <Text style={styles.navButtonText}>← Prev</Text>
              </TouchableOpacity>
            )}
            {currentIndex < questions.length - 1 ? (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setCurrentIndex((i) => i + 1)}>
                <Text style={styles.navButtonText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Submit Answers</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  textLight: {
    color: colors.textDark,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  textMuted: { color: colors.textMuted },
  reviewWrap: { width: '100%', marginTop: 18, gap: 14 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  reviewItem: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.14)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  reviewQuestion: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10, lineHeight: 21 },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    padding: 9,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  reviewOptionRight: { borderColor: colors.success, backgroundColor: 'rgba(236,253,245,0.95)' },
  reviewOptionPicked: { borderColor: colors.danger, backgroundColor: 'rgba(254,242,242,0.95)' },
  reviewOptionText: { fontSize: 13, color: colors.textMuted, flex: 1 },
  reviewOptionTextStrong: { color: colors.text, fontWeight: '700' },
  reviewMarkRight: { color: colors.success, fontWeight: '900', marginLeft: 8 },
  reviewMarkWrong: { color: colors.danger, fontWeight: '900', marginLeft: 8 },
  reviewExplanation: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 6,
    padding: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: 'rgba(237,233,254,0.8)',
    borderRadius: radius.sm,
  },
  reviewExplanationLabel: { fontWeight: '800', color: colors.text },
  learnMore: { marginTop: 8, alignSelf: 'flex-start' },
  learnMoreText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  resultIcon: {
    fontSize: 52,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  resultScore: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  resultPoints: {
    fontSize: 18,
    color: colors.success,
    fontWeight: '700',
  },
  doneButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: radius.sm,
    ...shadow.raised,
  },
  doneButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  quizContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  counter: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700',
  },
  answeredCount: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  question: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 24,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    fontSize: 14,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: colors.primaryDeep,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 96,
  },
  navButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadow.raised,
  },
  navButtonDisabled: {
    backgroundColor: colors.textFaint,
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
});
