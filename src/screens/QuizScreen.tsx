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
import { useLanguage } from '../i18n/LanguageContext';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

type Question = {
  _id: Id<'quizQuestions'>;
  question: string;
  questionHa?: string | null;
  options: string[];
  optionsHa?: string[] | null;
  topic?: string | null;
  courseTitle?: string | null;
  lessonTitle?: string | null;
  difficultyLabel?: string | null;
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
  const { language, setLanguage, t } = useLanguage();
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
      explanationHa?: string;
      courseKey: string | null;
      courseTitle: string | null;
      lessonNumber: number | null;
      lessonTitle: string | null;
    }[];
  } | null>(null);

  const [shuffledOptions, setShuffledOptions] = useState<
    Record<string, { opt: string; optHa: string; originalIndex: number }[]>
  >({});

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
  const current = questions?.[currentIndex] as Question | undefined;

  useEffect(() => {
    if (questions) {
      setShuffledOptions((prev) => {
        const next = { ...prev };
        let changed = false;
        questions.forEach((q: any) => {
          if (!next[q._id]) {
            const arr = q.options.map((opt: string, i: number) => ({
              opt,
              optHa: q.optionsHa?.[i] || opt,
              originalIndex: i,
            }));
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
      Alert.alert(language === 'ha' ? 'Da fatan a amsa akalla tambaya daya' : 'Answer at least one question to submit');
      return;
    }
    setSubmitted(true);
    try {
      const res = await submitQuiz({ userId, answers: answers as any });
      setResult(res as any);
    } catch (e) {
      Alert.alert(language === 'ha' ? 'Kuskure wajen aika amsoshi' : 'Error submitting quiz', String(e));
      setSubmitted(false);
    }
  };

  const handleSubmit = () => {
    executeSubmit();
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ha' : 'en');
  };

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, dark && styles.textLight]}>{t('prev').replace('←', '‹')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dark && styles.textLight]}>{t('quizTitle')}</Text>
        
        {/* Language Switch Pill */}
        <TouchableOpacity style={styles.langPill} onPress={toggleLanguage} activeOpacity={0.8}>
          <Text style={styles.langPillText}>
            {language === 'ha' ? '🇳🇬 HA' : '🇬🇧 EN'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.textMuted}>{t('loading')}</Text>
        </View>
      ) : result ? (
        <ScrollView
          contentContainerStyle={[styles.center, { paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.resultIcon}>
            {result.score >= Math.ceil(result.total / 2) ? '🎉' : '📚'}
          </Text>
          <Text style={[styles.resultTitle, dark && styles.textLight]}>{t('quizScore')}</Text>
          <Text style={styles.resultScore}>
            {result.score} / {result.total}
          </Text>
          {result.pointsEarned > 0 && (
            <Text style={styles.resultPoints}>+{result.pointsEarned} PTS</Text>
          )}

          {result.review?.length ? (
            <View style={styles.reviewWrap}>
              <Text style={[styles.reviewTitle, dark && styles.textLight]}>
                {t('reviewAnswers')}
              </Text>
              {result.review.map((r, i) => {
                const isCorrect = r.selected === r.correctIndex;
                const originalQ = questions?.[i];
                const qText = language === 'ha' && originalQ?.questionHa ? originalQ.questionHa : originalQ?.question || `Question ${i + 1}`;
                const expText = language === 'ha' && (r as any).explanationHa ? (r as any).explanationHa : r.explanation;

                return (
                  <View
                    key={i}
                    style={[
                      styles.reviewItem,
                      dark && styles.cardDark,
                      !isCorrect && { borderColor: 'rgba(239,68,68,0.35)' },
                    ]}>
                    <Text style={[styles.reviewQuestion, dark && styles.textLight]}>
                      {i + 1}. {qText}
                    </Text>
                    {(originalQ?.options ?? []).map((optText: string, optIdx: number) => {
                      const wasSelected = r.selected === optIdx;
                      const wasRight = r.correctIndex === optIdx;
                      const optDisplay = language === 'ha' && originalQ?.optionsHa?.[optIdx] ? originalQ.optionsHa[optIdx] : optText;

                      return (
                        <View
                          key={optIdx}
                          style={[
                            styles.reviewOption,
                            wasRight && styles.reviewOptionRight,
                            wasSelected && !wasRight && styles.reviewOptionPicked,
                          ]}>
                          <Text
                            style={[
                              styles.reviewOptionText,
                              (wasRight || wasSelected) && styles.reviewOptionTextStrong,
                              dark && styles.textLight,
                            ]}>
                            {optDisplay}
                          </Text>
                          {wasRight ? (
                            <Text style={styles.reviewMarkRight}>✓</Text>
                          ) : wasSelected ? (
                            <Text style={styles.reviewMarkWrong}>✗</Text>
                          ) : null}
                        </View>
                      );
                    })}
                    {expText ? (
                      <Text style={[styles.reviewExplanation, dark && styles.textMuted]}>
                        <Text style={styles.reviewExplanationLabel}>{t('whyExplanation')} </Text>
                        {expText}
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
                          📚 {t('learn')}: {r.courseTitle} → {r.lessonTitle ?? `Lesson ${r.lessonNumber}`}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : current ? (
        <View style={styles.quizContent}>
          <View style={styles.counterRow}>
            <Text style={styles.counter}>
              {t('question')} {currentIndex + 1} {t('of')} {questions.length}
            </Text>
            {current.topic || current.courseTitle ? (
              <View style={styles.topicBadge}>
                <Text style={styles.topicBadgeText} numberOfLines={1}>
                  📖 {current.courseTitle || current.topic}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.question, dark && styles.textLight]}>
            {language === 'ha' && current.questionHa ? current.questionHa : current.question}
          </Text>

          <View style={styles.optionsContainer}>
            {(shuffledOptions[current._id] ?? current.options.map((opt, i) => ({ opt, optHa: current.optionsHa?.[i] || opt, originalIndex: i }))).map((item) => {
              const selected =
                answers.find((a) => a.questionId === current._id)?.selectedIndex === item.originalIndex;
              const displayText = language === 'ha' && item.optHa ? item.optHa : item.opt;

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
                    {displayText}
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
                <Text style={styles.navButtonText}>{t('prev')}</Text>
              </TouchableOpacity>
            )}
            {currentIndex < questions.length - 1 ? (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setCurrentIndex((i) => i + 1)}>
                <Text style={styles.navButtonText}>{t('next')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  answers.length === 0 && styles.navButtonDisabled,
                ]}
                disabled={answers.length === 0 || submitted}
                onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>{t('submit')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.textMuted}>{t('loading')}</Text>
        </View>
      )}
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
    minWidth: 50,
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
  langPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDeep,
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
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
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
    gap: 8,
  },
  counter: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700',
  },
  topicBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: '65%',
  },
  topicBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDeep,
  },
  question: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 24,
    lineHeight: 27,
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
