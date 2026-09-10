// Pure helpers that turn the backend `getActivitiesHub` payload into the
// Achievements hub view model (status, progress, rewards, priorities). Kept
// free of React and navigation so it's trivially unit-testable — mirrors the
// `src/profile/smart.ts` pattern.
//
// The hub is a read-only aggregation layer: every value here is derived from
// real backend status (same sources the individual screens use). It never
// awards rewards and never mutates state.

import { formatPts } from '../profile/smart';

export type ActivityId =
  | 'checkin'
  | 'spin'
  | 'tasks'
  | 'learn'
  | 'surveys'
  | 'quiz'
  | 'box'
  | 'combo';

export type ActivityCategory =
  | 'DAILY'
  | 'EARN'
  | 'LEARN'
  | 'SURVEYS'
  | 'GAMES'
  | 'BONUSES';

export type ActivityStatus =
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'claimable'
  | 'locked'
  | 'cooldown';

// Existing screen a card deep-links to. Tab targets are reached via
// MainTabs -> { screen }; stack targets via their existing route.
export type ActivityRoute = 'Spin' | 'Tasks' | 'Academy' | 'Surveys' | 'Quiz' | 'Home';

export type Activity = {
  id: ActivityId;
  category: ActivityCategory;
  title: string;
  subtitle: string;
  icon: string;
  tint: string;
  status: ActivityStatus;
  statusLabel: string;
  progress: number; // 0..1
  progressLabel: string;
  rewardLabel: string;
  rewardPoints: number | null; // best-known potential remaining (real config)
  buttonLabel: string;
  route: ActivityRoute;
  doneToday: boolean; // counts toward the daily progress bar
};

export type ActivityEarning = {
  id: ActivityId;
  label: string;
  points: number;
};

export type HubSummary = {
  doneToday: number;
  totalToday: number;
  remainingToday: number;
  availableCount: number;
  claimableCount: number;
  todayEarned: number;
  potentialRemaining: number;
};

export type ActivitiesHubData = {
  stats: { todayEarned: number; earnings: { reason: string; points: number }[] };
  streak: {
    current: number;
    longest: number;
    checkedInToday: boolean;
    canCheckIn: boolean;
    cycleDay: number;
    todayReward: number;
    schedule: number[];
  };
  spin: {
    spinsRemaining: number;
    baseSpinsRemaining: number;
    bonusSpins: number;
    adBonusEarned: number;
    adBonusLimit: number;
    adBonusRemaining: number;
    nextRefillMs: number;
    nextRefillAt: number;
    windowTotalMs: number;
    spinsUsedInWindow: number;
    baseSpinsPerWindow: number;
  };
  box: { tasksToday: number; needed: number; openedToday: boolean; eligible: boolean };
  combo: {
    social: boolean;
    telegram: boolean;
    quiz: boolean;
    allDone: boolean;
    claimedToday: boolean;
    canClaim: boolean;
    reward: number;
  };
  tasks: { available: number; availablePoints: number; doneToday: number };
  academy: {
    total: number;
    passed: number;
    locked: number;
    passedToday: number;
    nextUnlocked: boolean;
  };
  surveys: { available: number; doneToday: boolean };
  quiz: { doneToday: boolean };
  rewardConfig: {
    maxSpinPrize: number;
    maxBoxPrize: number;
    academyLevelPoints: number;
    quizCorrectPoints: number;
  };
};

// Display order used when two cards have equal status priority.
const CANONICAL_ORDER: ActivityId[] = [
  'checkin',
  'box',
  'combo',
  'spin',
  'tasks',
  'learn',
  'surveys',
  'quiz',
];

// Smart prioritization: available-now and claimable rewards float to the top,
// completed/cooldown sink to the bottom.
const STATUS_PRIORITY: Record<ActivityStatus, number> = {
  available: 6,
  claimable: 5,
  in_progress: 4,
  locked: 3,
  completed: 2,
  cooldown: 1,
};

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function checkinActivity(data: ActivitiesHubData): Activity {
  const st = data.streak;
  const done = st.checkedInToday;
  const days = Math.max(1, st.schedule.length);
  return {
    id: 'checkin',
    category: 'DAILY',
    title: 'Daily Check-in',
    subtitle: 'Keep your streak alive',
    icon: 'calendar-check',
    tint: '#7C3AED',
    status: done ? 'completed' : 'available',
    statusLabel: done ? `Checked in · ${st.current}-day streak` : 'Not checked in yet',
    progress: done ? st.cycleDay / days : (st.cycleDay - 1) / days,
    progressLabel: `Day ${st.cycleDay} of ${days}`,
    rewardLabel: `+${st.todayReward} PTS`,
    rewardPoints: done ? 0 : st.todayReward,
    buttonLabel: done ? 'Done' : 'Check in',
    route: 'Home',
    doneToday: done,
  };
}

function spinActivity(data: ActivitiesHubData): Activity {
  const s = data.spin;
  const engaged =
    s.spinsUsedInWindow > 0 || s.adBonusEarned > 0 || s.bonusSpins > 0;
  const hasFreeSpin = s.spinsRemaining > 0;
  const hasAdSpin = s.adBonusRemaining > 0;

  let status: ActivityStatus;
  let statusLabel: string;
  let buttonLabel: string;
  if (hasFreeSpin) {
    status = 'available';
    statusLabel = `${s.spinsRemaining} spin${s.spinsRemaining === 1 ? '' : 's'} ready`;
    buttonLabel = 'Spin now';
  } else if (hasAdSpin) {
    status = 'available';
    statusLabel = `Watch an ad for +1 spin (${s.adBonusRemaining} left)`;
    buttonLabel = 'Watch ad';
  } else if (s.nextRefillMs > 0) {
    status = 'cooldown';
    statusLabel = `Refills in ${formatMs(s.nextRefillMs)}`;
    buttonLabel = 'Spin';
  } else {
    status = 'available';
    statusLabel = 'No spins left right now';
    buttonLabel = 'Spin';
  }

  const progress =
    s.baseSpinsPerWindow > 0
      ? Math.min(1, s.spinsUsedInWindow / s.baseSpinsPerWindow)
      : 0;

  return {
    id: 'spin',
    category: 'GAMES',
    title: 'Lucky Spin',
    subtitle: 'Spin the wheel and earn rewards',
    icon: 'arrows-spin',
    tint: '#EC4899',
    status,
    statusLabel,
    progress,
    progressLabel: `${s.spinsRemaining} spin${s.spinsRemaining === 1 ? '' : 's'} left`,
    rewardLabel: `Up to ${formatPts(data.rewardConfig.maxSpinPrize)} PTS`,
    rewardPoints: hasFreeSpin || hasAdSpin ? data.rewardConfig.maxSpinPrize : 0,
    buttonLabel,
    route: 'Spin',
    doneToday: engaged,
  };
}

function tasksActivity(data: ActivitiesHubData): Activity {
  const t = data.tasks;
  const noneAvailable = t.available === 0;
  const allDone = noneAvailable && t.doneToday > 0;

  let status: ActivityStatus = noneAvailable
    ? allDone
      ? 'completed'
      : 'locked'
    : 'available';
  if (!noneAvailable && t.doneToday > 0) status = 'in_progress';

  const total = t.doneToday + t.available;
  return {
    id: 'tasks',
    category: 'EARN',
    title: 'Tasks',
    subtitle: 'Complete available tasks',
    icon: 'list-check',
    tint: '#3B82F6',
    status,
    statusLabel: noneAvailable
      ? allDone
        ? 'All available tasks done'
        : 'No tasks right now'
      : `${t.available} task${t.available === 1 ? '' : 's'} available`,
    progress: total > 0 ? t.doneToday / total : 0,
    progressLabel: `${t.doneToday} done · ${t.available} left`,
    rewardLabel: `Up to ${formatPts(t.availablePoints)} PTS`,
    rewardPoints: noneAvailable ? 0 : t.availablePoints,
    buttonLabel: 'View tasks',
    route: 'Tasks',
    doneToday: allDone || t.doneToday > 0,
  };
}

function learnActivity(data: ActivitiesHubData): Activity {
  const a = data.academy;
  const allPassed = a.total > 0 && a.passed === a.total;
  const canDo = a.nextUnlocked;

  let status: ActivityStatus = allPassed
    ? 'completed'
    : canDo
      ? a.passed > 0
        ? 'in_progress'
        : 'available'
      : 'locked';

  return {
    id: 'learn',
    category: 'LEARN',
    title: 'Learn',
    subtitle: 'Learn and earn',
    icon: 'graduation-cap',
    tint: '#F59E0B',
    status,
    statusLabel: allPassed
      ? 'All lessons passed'
      : canDo
        ? a.passed > 0
          ? `${a.passed} passed · keep going`
          : 'Start your first lesson'
        : 'Next lesson locked',
    progress: a.total > 0 ? a.passed / a.total : 0,
    progressLabel: `${a.passed}/${a.total} lessons`,
    rewardLabel: `+${data.rewardConfig.academyLevelPoints} PTS / lesson`,
    rewardPoints:
      a.total > 0
        ? data.rewardConfig.academyLevelPoints * Math.max(0, a.total - a.passed)
        : null,
    buttonLabel: allPassed ? 'Review' : canDo ? 'Start learning' : 'Locked',
    route: 'Academy',
    doneToday: a.passedToday > 0 || allPassed,
  };
}

function surveysActivity(data: ActivitiesHubData): Activity {
  const s = data.surveys;
  const none = s.available === 0;
  return {
    id: 'surveys',
    category: 'SURVEYS',
    title: 'Surveys',
    subtitle: 'Complete available surveys',
    icon: 'clipboard-list',
    tint: '#F97316',
    status: none ? (s.doneToday ? 'completed' : 'locked') : 'available',
    statusLabel: none
      ? s.doneToday
        ? 'Done for today'
        : 'No surveys right now'
      : `${s.available} survey${s.available === 1 ? '' : 's'} available`,
    progress: s.doneToday ? 1 : 0,
    progressLabel: s.doneToday ? 'Completed today' : 'Varies by offer',
    rewardLabel: 'Earn per survey',
    rewardPoints: s.available > 0 ? null : 0,
    buttonLabel: 'Take survey',
    route: 'Surveys',
    doneToday: s.doneToday,
  };
}

function quizActivity(data: ActivitiesHubData): Activity {
  const done = data.quiz.doneToday;
  const maxPts = 5 * data.rewardConfig.quizCorrectPoints;
  return {
    id: 'quiz',
    category: 'DAILY',
    title: 'Daily Quiz',
    subtitle: 'Test your knowledge',
    icon: 'brain',
    tint: '#06B6D4',
    status: done ? 'completed' : 'available',
    statusLabel: done ? 'Completed today' : 'Not completed',
    progress: done ? 1 : 0,
    progressLabel: done ? 'Completed' : '5 questions',
    rewardLabel: `+${maxPts} PTS`,
    rewardPoints: done ? 0 : maxPts,
    buttonLabel: done ? 'Done' : 'Take quiz',
    route: 'Quiz',
    doneToday: done,
  };
}

function boxActivity(data: ActivitiesHubData): Activity {
  const b = data.box;
  let status: ActivityStatus;
  let statusLabel: string;
  let buttonLabel: string;
  if (b.openedToday) {
    status = 'completed';
    statusLabel = 'Opened today';
    buttonLabel = 'Done';
  } else if (b.eligible) {
    status = 'claimable';
    statusLabel = 'Ready to open';
    buttonLabel = 'Open box';
  } else if (b.tasksToday > 0) {
    status = 'in_progress';
    statusLabel = `${b.needed - b.tasksToday} more task${b.needed - b.tasksToday === 1 ? '' : 's'} to unlock`;
    buttonLabel = 'Unlock';
  } else {
    status = 'available';
    statusLabel = `Complete ${b.needed} tasks to unlock`;
    buttonLabel = 'Unlock';
  }
  return {
    id: 'box',
    category: 'BONUSES',
    title: 'Mystery Box',
    subtitle: 'Your daily mystery reward',
    icon: 'gift',
    tint: '#10B981',
    status,
    statusLabel,
    progress: b.needed > 0 ? Math.min(1, b.tasksToday / b.needed) : 0,
    progressLabel: b.openedToday ? 'Opened today' : `${b.tasksToday}/${b.needed} tasks`,
    rewardLabel: `Up to ${formatPts(data.rewardConfig.maxBoxPrize)} PTS`,
    rewardPoints: b.openedToday || b.eligible ? 0 : data.rewardConfig.maxBoxPrize,
    buttonLabel,
    route: 'Home',
    doneToday: b.openedToday,
  };
}

function comboActivity(data: ActivitiesHubData): Activity {
  const c = data.combo;
  const legs = [c.social, c.telegram, c.quiz].filter(Boolean).length;
  let status: ActivityStatus = c.canClaim
    ? 'claimable'
    : c.claimedToday
      ? 'completed'
      : legs > 0
        ? 'in_progress'
        : 'available';
  return {
    id: 'combo',
    category: 'BONUSES',
    title: 'Daily Combo',
    subtitle: 'Follow + Telegram + Quiz',
    icon: 'fire',
    tint: '#EF4444',
    status,
    statusLabel: c.canClaim
      ? 'Bonus ready to claim'
      : c.claimedToday
        ? 'Claimed today'
        : legs > 0
          ? `${legs}/3 legs done`
          : 'Do all three daily legs',
    progress: legs / 3,
    progressLabel: `${legs}/3 legs`,
    rewardLabel: `+${c.reward} PTS`,
    rewardPoints: c.claimedToday ? 0 : c.reward,
    buttonLabel: c.canClaim ? 'Claim bonus' : c.claimedToday ? 'Claimed' : `${legs}/3`,
    route: 'Tasks',
    doneToday: c.claimedToday,
  };
}

export function buildActivities(data: ActivitiesHubData): Activity[] {
  const cards: Activity[] = [
    checkinActivity(data),
    boxActivity(data),
    comboActivity(data),
    spinActivity(data),
    tasksActivity(data),
    learnActivity(data),
    surveysActivity(data),
    quizActivity(data),
  ];
  const canonical = new Map(
    CANONICAL_ORDER.map((id, i) => [id, i]),
  );
  return [...cards].sort(
    (a, b) =>
      STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status] ||
      canonical.get(a.id)! - canonical.get(b.id)!,
  );
}

export function hubSummary(data: ActivitiesHubData, activities: Activity[]): HubSummary {
  const doneToday = activities.filter((a) => a.doneToday).length;
  const totalToday = activities.length;
  return {
    doneToday,
    totalToday,
    remainingToday: Math.max(0, totalToday - doneToday),
    availableCount: activities.filter((a) => a.status === 'available').length,
    claimableCount: activities.filter((a) => a.status === 'claimable').length,
    todayEarned: data.stats.todayEarned,
    potentialRemaining: activities.reduce(
      (s, a) => s + (a.doneToday ? 0 : a.rewardPoints ?? 0),
      0,
    ),
  };
}

const EARNINGS_LABELS: Record<ActivityId, string> = {
  checkin: 'Daily Check-in',
  spin: 'Lucky Spin',
  tasks: 'Tasks',
  learn: 'Learn',
  surveys: 'Surveys',
  quiz: 'Daily Quiz',
  box: 'Mystery Box',
  combo: 'Daily Combo',
};

const REASON_GROUPS: Record<string, ActivityId> = {
  DAILY_CHECKIN: 'checkin',
  SPIN_WHEEL: 'spin',
  TASK_COMPLETED: 'tasks',
  ACADEMY_LEVEL: 'learn',
  SURVEY_COMPLETED: 'surveys',
  QUIZ_CORRECT: 'quiz',
  MYSTERY_BOX: 'box',
  COMBO_BONUS: 'combo',
};

// Today's earnings per activity, derived only from real ledger rows.
export function activityEarnings(data: ActivitiesHubData): ActivityEarning[] {
  const byActivity = new Map<ActivityId, number>();
  for (const e of data.stats.earnings) {
    const id = REASON_GROUPS[e.reason];
    if (!id) continue;
    byActivity.set(id, (byActivity.get(id) ?? 0) + e.points);
  }
  return Array.from(byActivity.entries())
    .map(([id, points]) => ({ id, label: EARNINGS_LABELS[id], points }))
    .sort((a, b) => b.points - a.points);
}

export const ACTIVITY_CATEGORIES: { key: ActivityCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DAILY', label: 'Daily' },
  { key: 'EARN', label: 'Earn' },
  { key: 'LEARN', label: 'Learn' },
  { key: 'SURVEYS', label: 'Surveys' },
  { key: 'GAMES', label: 'Games' },
  { key: 'BONUSES', label: 'Bonuses' },
];
