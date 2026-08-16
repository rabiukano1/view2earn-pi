// Learn Pi / Learn Sidra academy (plan §7.11b).
// Leveled guides with a quiz gate per level: read the guide, pass the gate to
// unlock the next level and earn points + a badge.
// The actual content is dynamically loaded from the Convex Knowledge Center database.

export const ACADEMY_PASS_RATIO = 0.7; // share of gate questions needed to pass
export const ACADEMY_LEVEL_POINTS = 10; // awarded once, first time a level is passed

// Score a gate attempt. `answers` is the selected option index per question, in
// lesson order; a missing/wrong answer just counts as incorrect.
export function scoreGate(
  quiz: { correctIndex: number }[],
  answers: number[],
): { score: number; total: number; passed: boolean } {
  const total = quiz.length;
  let score = 0;
  quiz.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score++;
  });
  return { score, total, passed: total > 0 && score / total >= ACADEMY_PASS_RATIO };
}
