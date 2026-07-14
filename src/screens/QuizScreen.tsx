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
import type { RootTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { deviceFingerprint } from '../lib/device';
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

type Props = BottomTabScreenProps<RootTabParamList, 'Quiz'>;

export default function QuizScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const route = useRoute<Props['route']>();
  const [localUserId, setLocalUserId] = useState<Id<'users'> | null>(null);
  const [localEcosystem, setLocalEcosystem] = useState<'PI' | 'SIDRA'>('SIDRA');
  const getOrCreateDevUser = useMutation(api.users.getOrCreateDevUser);

  const params = route.params;
  const userId = (params?.userId ?? localUserId) as Id<'users'> | null;
  const ecosystem: 'PI' | 'SIDRA' = params?.ecosystem ?? localEcosystem;

  useEffect(() => {
    if (!params?.userId) {
      getOrCreateDevUser({ deviceFingerprint: deviceFingerprint() })
        .then((id) => {
          setLocalUserId(id);
        })
        .catch(() => {});
    }
  }, [params, getOrCreateDevUser]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; pointsEarned: number } | null>(null);

  const questions = useQuery(
    api.quiz.getDailyQuiz,
    userId ? { userId, ecosystem } : 'skip',
  );
  const submitQuiz = useMutation(api.quiz.submitQuiz);

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers([]);
    setSubmitted(false);
    setResult(null);
  }, []);

  const loading = questions === undefined;
  const current = questions?.[currentIndex];

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

  const handleSubmit = async () => {
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
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : result ? (
        <View style={styles.center}>
          <Text style={styles.resultIcon}>
            {result.score === result.total ? '🎉' : '👏'}
          </Text>
          <Text style={styles.resultTitle}>Quiz Complete!</Text>
          <Text style={styles.resultScore}>
            {result.score} of {result.total} correct
          </Text>
          <Text style={styles.resultPoints}>+{result.pointsEarned} pts earned</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : current ? (
        <View style={styles.quizContent}>
          <View style={styles.counterRow}>
            <Text style={styles.counter}>
              Question {currentIndex + 1} of {questions!.length}
            </Text>
            <Text style={styles.answeredCount}>
              {answers.filter((a) => questions!.some((q) => q._id === a.questionId)).length} answered
            </Text>
          </View>
          <ScrollView style={styles.scrollArea}>
            <Text style={[styles.question, dark && styles.textLight]}>
              {current.question}
            </Text>
            <View style={styles.optionsContainer}>
              {current.options.map((option, idx) => {
                const isSelected =
                  answers.find((a) => a.questionId === current._id)?.selectedIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.option, isSelected && styles.optionSelected, dark && styles.optionDark]}
                    onPress={() => handleSelect(idx)}>
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                        dark && styles.textLight,
                      ]}>
                      {String.fromCharCode(65 + idx)}. {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
              disabled={currentIndex === 0}
              onPress={() => setCurrentIndex((i) => i - 1)}>
              <Text style={styles.navButtonText}>← Prev</Text>
            </TouchableOpacity>
            {currentIndex < questions!.length - 1 ? (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setCurrentIndex((i) => i + 1)}>
                <Text style={styles.navButtonText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Submit</Text>
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
