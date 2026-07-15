import { ACADEMY, getLesson, scoreGate } from "../src/academy";

describe("academy gate", () => {
  const lesson = getLesson("PI", 1)!;
  const correct = lesson.quiz.map((q) => q.correctIndex);

  it("passes when all answers are correct", () => {
    expect(scoreGate(lesson, correct).passed).toBe(true);
  });

  it("fails a single-correct answer on a 2-question gate (below 70%)", () => {
    const answers = [...correct];
    answers[1] = (correct[1] + 1) % lesson.quiz[1].options.length; // wrong
    const res = scoreGate(lesson, answers);
    expect(res.score).toBe(1);
    expect(res.passed).toBe(false);
  });

  it("fails when no answers are given", () => {
    expect(scoreGate(lesson, []).passed).toBe(false);
  });

  it("every lesson's correctIndex is a valid option", () => {
    for (const eco of ["PI", "SIDRA"] as const) {
      for (const l of ACADEMY[eco]) {
        for (const q of l.quiz) {
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(q.options.length);
        }
      }
    }
  });
});
