import {
  activityEarnings,
  buildActivities,
  hubSummary,
  type ActivitiesHubData,
} from '../hub';

function baseData(over: Partial<ActivitiesHubData> = {}): ActivitiesHubData {
  return {
    stats: { todayEarned: 0, earnings: [] },
    streak: {
      current: 0,
      longest: 0,
      checkedInToday: false,
      canCheckIn: true,
      cycleDay: 1,
      todayReward: 10,
      schedule: [10, 15, 20, 25, 30, 40, 75],
    },
    spin: {
      spinsRemaining: 3,
      baseSpinsRemaining: 3,
      bonusSpins: 0,
      adBonusEarned: 0,
      adBonusLimit: 2,
      adBonusRemaining: 2,
      nextRefillMs: 0,
      nextRefillAt: 0,
      windowTotalMs: 10800000,
      spinsUsedInWindow: 0,
      baseSpinsPerWindow: 3,
    },
    box: { tasksToday: 0, needed: 3, openedToday: false, eligible: false },
    combo: {
      social: false,
      telegram: false,
      quiz: false,
      allDone: false,
      claimedToday: false,
      canClaim: false,
      reward: 40,
    },
    tasks: { available: 5, availablePoints: 300, doneToday: 0 },
    academy: {
      total: 6,
      passed: 0,
      locked: 5,
      passedToday: 0,
      nextUnlocked: true,
    },
    surveys: { available: 3, doneToday: false },
    quiz: { doneToday: false },
    rewardConfig: {
      maxSpinPrize: 500,
      maxBoxPrize: 250,
      academyLevelPoints: 10,
      quizCorrectPoints: 3,
    },
    ...over,
  };
}

describe('buildActivities', () => {
  it('marks everything available for a fresh user', () => {
    const acts = buildActivities(baseData());
    expect(acts.filter((a) => a.status === 'available')).toHaveLength(8);
    expect(acts.filter((a) => a.doneToday)).toHaveLength(0);
    expect(acts.every((a) => a.statusLabel.length > 0)).toBe(true);
  });

  it('sorts available + claimable before completed (spec priority)', () => {
    const data = baseData({
      box: { tasksToday: 3, needed: 3, openedToday: false, eligible: true },
      combo: {
        social: true,
        telegram: true,
        quiz: true,
        allDone: true,
        claimedToday: false,
        canClaim: true,
        reward: 40,
      },
      streak: { ...baseData().streak, checkedInToday: true, canCheckIn: false },
      quiz: { doneToday: true },
    });
    const acts = buildActivities(data);
    const order = acts.map((a) => a.status);
    // Available-now floats to the top, then claimable rewards, then completed.
    expect(order[0]).toBe('available');
    expect(order.lastIndexOf('available')).toBeLessThan(order.indexOf('claimable'));
    expect(order.indexOf('claimable')).toBeLessThan(order.indexOf('completed'));
  });

  it('reports mystery box as claimable when eligible', () => {
    const acts = buildActivities(
      baseData({
        box: { tasksToday: 3, needed: 3, openedToday: false, eligible: true },
      }),
    );
    const box = acts.find((a) => a.id === 'box')!;
    expect(box.status).toBe('claimable');
    expect(box.progress).toBe(1);
  });

  it('reports spin as cooldown when no spins and no ad bonus', () => {
    const acts = buildActivities(
      baseData({
        spin: {
          ...baseData().spin,
          spinsRemaining: 0,
          baseSpinsRemaining: 0,
          spinsUsedInWindow: 3,
          adBonusRemaining: 0,
          adBonusEarned: 2,
          nextRefillMs: 5400000,
        },
      }),
    );
    const spin = acts.find((a) => a.id === 'spin')!;
    expect(spin.status).toBe('cooldown');
    expect(spin.statusLabel).toContain('Refills in');
    expect(spin.progress).toBe(1);
  });

  it('shows completed state when everything is done today', () => {
    const done = {
      streak: { ...baseData().streak, checkedInToday: true, canCheckIn: false },
      quiz: { doneToday: true },
      box: { tasksToday: 3, needed: 3, openedToday: true, eligible: false },
      combo: {
        social: true,
        telegram: true,
        quiz: true,
        allDone: true,
        claimedToday: true,
        canClaim: false,
        reward: 40,
      },
      tasks: { available: 0, availablePoints: 0, doneToday: 4 },
      academy: {
        total: 6,
        passed: 6,
        locked: 0,
        passedToday: 1,
        nextUnlocked: false,
      },
      surveys: { available: 0, doneToday: true },
      spin: {
        ...baseData().spin,
        spinsRemaining: 0,
        baseSpinsRemaining: 0,
        spinsUsedInWindow: 3,
        adBonusEarned: 2,
        adBonusRemaining: 0,
      },
    };
    const acts = buildActivities(baseData(done));
    // Every fixed card is done today (spin is a windowed activity so it stays
    // "on cooldown" rather than a completed status, but still counts as used).
    expect(acts.filter((a) => a.status === 'completed')).toHaveLength(7);
    expect(acts.every((a) => a.doneToday)).toBe(true);
    expect(acts.find((a) => a.id === 'spin')!.doneToday).toBe(true);
  });
});

describe('hubSummary', () => {
  it('counts completed, available, claimable and today earned', () => {
    const data = baseData({
      stats: { todayEarned: 120, earnings: [] },
      box: { tasksToday: 3, needed: 3, openedToday: false, eligible: true },
      quiz: { doneToday: true },
    });
    const acts = buildActivities(data);
    const s = hubSummary(data, acts);
    expect(s.totalToday).toBe(8);
    expect(s.doneToday).toBe(1); // quiz done; claimable box is not yet opened
    expect(s.availableCount).toBeGreaterThan(0);
    expect(s.claimableCount).toBe(1);
    expect(s.todayEarned).toBe(120);
  });
});

describe('activityEarnings', () => {
  it('groups real ledger reasons per activity and drops unknown ones', () => {
    const data = baseData({
      stats: {
        todayEarned: 155,
        earnings: [
          { reason: 'SPIN_WHEEL', points: 50 },
          { reason: 'TASK_COMPLETED', points: 100 },
          { reason: 'MYSTERY_BOX', points: 5 },
          { reason: 'REFERRAL_BONUS', points: 900 }, // not an activity row
        ],
      },
    });
    const rows = activityEarnings(data);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.id === 'tasks')!.points).toBe(100);
    expect(rows[0].points).toBe(100); // sorted desc
  });
});
