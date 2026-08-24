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
          contentContainerStyle={[styles.reviewContainer, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}>
          
          {/* Score Hero Banner */}
          <View style={[styles.heroCard, dark && styles.cardDark]}>
            <View style={styles.heroBadgeRow}>
              <View style={[
                styles.heroIconCircle,
                result.score === result.total 
                  ? styles.heroIconGold 
                  : result.score >= Math.ceil(result.total / 2) 
                    ? styles.heroIconPurple 
                    : styles.heroIconBlue
              ]}>
                <Icon 
                  name={
                    result.score === result.total 
                      ? 'trophy' 
                      : result.score >= Math.ceil(result.total / 2) 
                        ? 'award' 
                        : 'lightbulb'
                  } 
                  iconStyle="solid" 
                  size={28} 
                  color={
                    result.score === result.total 
                      ? '#F59E0B' 
                      : result.score >= Math.ceil(result.total / 2) 
                        ? colors.primary 
                        : '#3B82F6'
                  } 
                />
              </View>
            </View>

            <Text style={[styles.heroTitle, dark && styles.textLight]}>
              {language === 'ha' ? 'An Kammala Tambayoyin!' : 'Quiz Completed!'}
            </Text>
            
            <Text style={styles.heroSubtitle}>
              {result.score === result.total 
                ? (language === 'ha' ? '🌟 Amsa Duka Daidai! Gwaninta!' : '🌟 Perfect Score! Outstanding job!')
                : result.score >= Math.ceil(result.total / 2)
                  ? (language === 'ha' ? '👏 Aiki Mai Kyau! Ka kware sosai!' : '👏 Well Done! Great effort!')
                  : (language === 'ha' ? '💡 Ci Gaba Da Koyo! Zaka iya fi haka.' : '💡 Keep Practicing! You can do better!')}
            </Text>

            {/* Score Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, dark && styles.statBoxDark]}>
                <Text style={styles.statLabel}>{language === 'ha' ? 'Maki' : 'Score'}</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {result.score} / {result.total}
                </Text>
              </View>

              <View style={[styles.statBox, dark && styles.statBoxDark]}>
                <Text style={styles.statLabel}>{language === 'ha' ? 'Daidaito' : 'Accuracy'}</Text>
                <Text style={[styles.statValue, { color: result.score >= Math.ceil(result.total / 2) ? colors.success : colors.danger }]}>
                  {Math.round((result.score / result.total) * 100)}%
                </Text>
              </View>

              {result.pointsEarned > 0 ? (
                <View style={[styles.statBox, styles.statBoxGold, dark && styles.statBoxGoldDark]}>
                  <Text style={[styles.statLabel, { color: '#B45309' }]}>{language === 'ha' ? 'Kyauta' : 'Reward'}</Text>
                  <Text style={[styles.statValue, { color: '#D97706' }]}>
                    +{result.pointsEarned} PTS
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Review Answers List */}
          {result.review?.length ? (
            <View style={styles.reviewWrap}>
              <View style={styles.reviewHeaderRow}>
                <View style={styles.reviewHeaderLeft}>
                  <Icon name="list-check" iconStyle="solid" size={16} color={colors.primary} />
                  <Text style={[styles.reviewSectionTitle, dark && styles.textLight]}>
                    {t('reviewAnswers')}
                  </Text>
                </View>
                <View style={styles.reviewCountPill}>
                  <Text style={styles.reviewCountText}>
                    {result.review.length} {language === 'ha' ? 'Tambayoyi' : 'Questions'}
                  </Text>
                </View>
              </View>

              {result.review.map((r, i) => {
                const isCorrect = r.selected === r.correctIndex;
                const originalQ = questions?.[i];
                const qText = language === 'ha' && originalQ?.questionHa ? originalQ.questionHa : originalQ?.question || `Question ${i + 1}`;
                const expText = language === 'ha' && (r as any).explanationHa ? (r as any).explanationHa : r.explanation;
                const LETTERS = ['A', 'B', 'C', 'D', 'E'];

                return (
                  <View
                    key={i}
                    style={[
                      styles.reviewCard,
                      dark && styles.cardDark,
                      isCorrect ? styles.reviewCardCorrect : styles.reviewCardWrong,
                    ]}>
                    
                    {/* Question Header Pill Bar */}
                    <View style={styles.qHeaderRow}>
                      <View style={styles.qIndexPill}>
                        <Text style={styles.qIndexText}>{language === 'ha' ? 'Tambaya' : 'Q'}{i + 1}</Text>
                      </View>
                      
                      <View style={[
                        styles.statusBadge, 
                        isCorrect ? styles.statusBadgeCorrect : styles.statusBadgeWrong
                      ]}>
                        <Icon 
                          name={isCorrect ? 'circle-check' : 'circle-xmark'} 
                          iconStyle="solid" 
                          size={12} 
                          color={isCorrect ? '#059669' : '#DC2626'} 
                        />
                        <Text style={[
                          styles.statusBadgeText, 
                          isCorrect ? styles.statusTextCorrect : styles.statusTextWrong
                        ]}>
                          {isCorrect 
                            ? (language === 'ha' ? 'Daidai' : 'Correct') 
                            : (language === 'ha' ? 'Kuskure' : 'Incorrect')}
                        </Text>
                      </View>
                    </View>

                    {/* Question Text */}
                    <Text style={[styles.qText, dark && styles.textLight]}>
                      {qText}
                    </Text>

                    {/* Options List */}
                    <View style={styles.optionsList}>
                      {(originalQ?.options ?? []).map((optText: string, optIdx: number) => {
                        const wasSelected = r.selected === optIdx;
                        const wasRight = r.correctIndex === optIdx;
                        const optDisplay = language === 'ha' && originalQ?.optionsHa?.[optIdx] ? originalQ.optionsHa[optIdx] : optText;
                        const letter = LETTERS[optIdx] || String(optIdx + 1);

                        return (
                          <View
                            key={optIdx}
                            style={[
                              styles.modernOption,
                              dark && styles.modernOptionDark,
                              wasRight && styles.optionIsRight,
                              wasSelected && !wasRight && styles.optionIsWrong,
                            ]}>
                            
                            {/* Letter Avatar */}
                            <View style={[
                              styles.letterCircle,
                              dark && styles.letterCircleDark,
                              wasRight && styles.letterCircleRight,
                              wasSelected && !wasRight && styles.letterCircleWrong,
                            ]}>
                              <Text style={[
                                styles.letterText,
                                dark && styles.textLight,
                                (wasRight || wasSelected) && styles.letterTextActive,
                              ]}>
                                {letter}
                              </Text>
                            </View>

                            {/* Option Text */}
                            <Text style={[
                              styles.optionLabel,
                              dark && styles.textLight,
                              wasRight && styles.optionLabelRight,
                              wasSelected && !wasRight && styles.optionLabelWrong,
                            ]}>
                              {optDisplay}
                            </Text>

                            {/* Status Tag on Right */}
                            {wasRight ? (
                              <View style={styles.tagRight}>
                                <Icon name="check" iconStyle="solid" size={11} color="#059669" />
                                <Text style={styles.tagRightText}>{language === 'ha' ? 'Daidai' : 'Correct'}</Text>
                              </View>
                            ) : wasSelected ? (
                              <View style={styles.tagWrong}>
                                <Icon name="xmark" iconStyle="solid" size={11} color="#DC2626" />
                                <Text style={styles.tagWrongText}>{language === 'ha' ? 'Zabinka' : 'Your Choice'}</Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    {/* Explanation Box */}
                    {expText ? (
                      <View style={[styles.explanationCard, dark && styles.explanationCardDark]}>
                        <View style={styles.explanationHeader}>
                          <Icon name="lightbulb" iconStyle="solid" size={13} color="#D97706" />
                          <Text style={styles.explanationTitle}>
                            {language === 'ha' ? 'Bayani / Dalili:' : 'Why is this correct?'}
                          </Text>
                        </View>
                        <Text style={[styles.explanationBody, dark && styles.textDarkMuted]}>
                          {expText}
                        </Text>
                      </View>
                    ) : null}

                    {/* Academy Course Link CTA */}
                    {Boolean(r.courseKey && r.lessonNumber) ? (
                      <TouchableOpacity
                        style={[styles.academyCta, dark && styles.academyCtaDark]}
                        activeOpacity={0.8}
                        onPress={() =>
                          navigation.navigate('Academy', {
                            ecosystem: ecosystem,
                          })
                        }>
                        <View style={styles.academyCtaLeft}>
                          <Icon name="graduation-cap" iconStyle="solid" size={14} color={colors.primary} />
                          <Text style={styles.academyCtaText} numberOfLines={1}>
                            {language === 'ha' ? 'Koyi a' : 'Study'}: {r.courseTitle} → {r.lessonTitle ?? `Lesson ${r.lessonNumber}`}
                          </Text>
                        </View>
                        <Icon name="chevron-right" iconStyle="solid" size={11} color={colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Done CTA Button */}
          <TouchableOpacity 
            style={styles.continueBtn} 
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}>
            <Icon name="check" iconStyle="solid" size={16} color="#FFFFFF" />
            <Text style={styles.continueBtnText}>
              {language === 'ha' ? 'An Gama' : 'Done & Return'}
            </Text>
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
  textDarkMuted: { color: '#94A3B8' },

  // Modernized Review Container
  reviewContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroBadgeRow: {
    marginBottom: 12,
  },
  heroIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  heroIconPurple: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  heroIconBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 12,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxDark: {
    backgroundColor: colors.surfaceAltDark,
  },
  statBoxGold: {
    backgroundColor: '#FEF3C7',
  },
  statBoxGoldDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
  },

  // Review Section Header
  reviewWrap: {
    width: '100%',
    gap: 14,
    marginBottom: 20,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  reviewCountPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  reviewCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDeep,
  },

  // Question Card
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  reviewCardCorrect: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  reviewCardWrong: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },

  qHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  qIndexPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  qIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusBadgeCorrect: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeWrong: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextCorrect: {
    color: '#059669',
  },
  statusTextWrong: {
    color: '#DC2626',
  },

  qText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 14,
  },

  // Options List
  optionsList: {
    gap: 8,
    marginBottom: 12,
  },
  modernOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 10,
  },
  modernOptionDark: {
    backgroundColor: colors.surfaceAltDark,
  },
  optionIsRight: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  optionIsWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  letterCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  letterCircleDark: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderDark,
  },
  letterCircleRight: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  letterCircleWrong: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  letterText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  letterTextActive: {
    color: '#FFFFFF',
  },
  optionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  optionLabelRight: {
    fontWeight: '800',
    color: '#065F46',
  },
  optionLabelWrong: {
    fontWeight: '800',
    color: '#991B1B',
  },
  tagRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagRightText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  tagWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagWrongText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },

  // Explanation Card
  explanationCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: radius.md,
    padding: 12,
    borderLeftWidth: 3.5,
    borderLeftColor: '#F59E0B',
    marginTop: 4,
  },
  explanationCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  explanationBody: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 19,
  },

  // Academy CTA
  academyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  academyCtaDark: {
    backgroundColor: colors.primarySoftDark,
  },
  academyCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  academyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDeep,
    flex: 1,
  },

  // Bottom Action
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.pill,
    marginTop: 8,
    marginBottom: 32,
    ...shadow.raised,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
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
