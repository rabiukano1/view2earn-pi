import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Question = {
  _id: Id<'quizQuestions'>;
  question: string;
  options: string[];
};

type Answer = {
  questionId: Id<'quizQuestions'>;
  selectedIndex: number;
};

export default function QuizScreen({
  visible,
  onClose,
  userId,
  ecosystem,
}: {
  visible: boolean;
  onClose: () => void;
  userId: Id<'users'>;
  ecosystem: 'PI' | 'SIDRA';
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; pointsEarned: number } | null>(null);

  const questions = useQuery(api.quiz.getDailyQuiz, visible ? { userId, ecosystem } : 'skip');
  const submitQuiz = useMutation(api.quiz.submitQuiz);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setAnswers([]);
      setSubmitted(false);
      setResult(null);
    }
  }, [visible]);

  if (!visible) return null;

  const loading = questions === undefined;
  const current = questions?.[currentIndex];
  const answered = answers.some((a) => a.questionId === current?._id);

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
    if (!questions || answers.length === 0) {
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

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : result ? (
          <View style={styles.center}>
            <Text style={styles.resultTitle}>Quiz Complete!</Text>
            <Text style={styles.resultScore}>
              {result.score} of {result.total} correct
            </Text>
            <Text style={styles.resultPoints}>+{result.pointsEarned} pts earned</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : current ? (
          <View style={styles.quizContent}>
            <View style={styles.header}>
              <Text style={styles.counter}>
                Question {currentIndex + 1} of {questions.length}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.question}>{current.question}</Text>
            <View style={styles.optionsContainer}>
              {current.options.map((option, idx) => {
                const isSelected =
                  answers.find((a) => a.questionId === current._id)?.selectedIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(idx)}>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {String.fromCharCode(65 + idx)}. {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                disabled={currentIndex === 0}
                onPress={() => setCurrentIndex((i) => i - 1)}>
                <Text style={styles.navButtonText}>← Prev</Text>
              </TouchableOpacity>
              {currentIndex < questions.length - 1 ? (
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F5',
    paddingTop: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  quizContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  counter: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '600',
  },
  closeX: {
    fontSize: 24,
    color: '#18181B',
    fontWeight: '300',
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181B',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E4E4E7',
  },
  optionSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  optionText: {
    fontSize: 14,
    color: '#18181B',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#7C3AED',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 40,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#18181B',
  },
  resultScore: {
    fontSize: 32,
    fontWeight: '700',
    color: '#7C3AED',
  },
  resultPoints: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 24,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
