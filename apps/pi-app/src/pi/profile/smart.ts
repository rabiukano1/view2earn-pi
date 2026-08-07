// Pure helpers that turn the backend `smartDashboard` payload into the "smart
// profile" view model: level + XP, achievements, coach panel insights and a
// 0–100 daily Smart Score. Mirrors src/profile/smart.ts in the mobile app but
// resolves coach actions to pi-app routes.

export type SmartDashboard = {
  user: {
    username: string;
    name: string;
    ecosystem: "PI" | "SIDRA";
    tier: number;
    country: string;
    joinedAt: number;
    payoutEvm: string;
    payoutSolana: string;
    telegramUserId: string;
  };
  stats: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    tasksCompleted: number;
  };
  recent: {
    time: number;
    label: string;
    kind: string;
    detail: string;
    delta: number;
    balanceAfter: number;
  }[];
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
  };
  box: {
    tasksToday: number;
    needed: number;
    openedToday: boolean;
    eligible: boolean;
  };
  combo: {
    social: boolean;
    telegram: boolean;
    quiz: boolean;
    allDone: boolean;
    claimedToday: boolean;
    canClaim: boolean;
    reward: number;
  };
  progress: {
    balance: number;
    target: { name: string; pointsPrice: number } | null;
    ready: boolean;
  } | null;
  referral: {
    code: string;
    count: number;
    qualifiedCount: number;
    totalEarned: number;
    referredBy: string | null;
  };
  rank: {
    rank: number | null;
    total: number;
    balance: number;
  };
  achievements: {
    key: string;
    metric: string;
    target: number;
    icon: string;
    tint: string;
    title: string;
    desc: string;
    enabled: boolean;
    sortOrder: number;
  }[];
};

export type AchievementMetric = "tasks" | "earned" | "streak" | "referrals" | "rank";

// ---- Level & XP ----
export function xpForLevel(level: number): number {
  return Math.round(60 * level * (level + 1));
}

export type LevelInfo = {
  level: number;
  xp: number;
  current: number;
  next: number;
  progress: number;
  title: string;
};

const LEVEL_TITLES = [
  "Rookie",
  "Learner",
  "Explorer",
  "Earner",
  "Achiever",
  "Collector",
  "Rising Star",
  "Power User",
  "Earning Elite",
  "View2Earn Legend",
];

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return {
    level,
    xp,
    current,
    next,
    progress: Math.max(0, Math.min(1, (xp - current) / (next - current))),
    title,
  };
}

// ---- Achievements ----
export type Achievement = {
  id: string;
  icon: string;
  tint: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number;
  current: number;
  target: number;
};

export function metricCurrent(d: SmartDashboard, metric: AchievementMetric, target: number): number {
  switch (metric) {
    case "tasks":
      return d.stats.tasksCompleted;
    case "earned":
      return d.stats.totalEarned;
    case "streak":
      return d.streak.longest;
    case "referrals":
      return d.referral.count;
    case "rank":
      return d.rank.rank !== null && d.rank.rank <= target ? 1 : 0;
  }
}

export function achievements(d: SmartDashboard): Achievement[] {
  const configs = d.achievements ?? [];
  return configs.map((cfg) => {
    const current = metricCurrent(d, cfg.metric as AchievementMetric, cfg.target);
    const target = cfg.metric === "rank" ? 1 : cfg.target;
    const { key: id, icon, tint, title, desc, metric } = cfg;
    return {
      id,
      icon,
      tint,
      title,
      desc,
      current,
      target,
      unlocked: metric === "rank" ? current === 1 : current >= target,
      progress: Math.max(0, Math.min(1, metric === "rank" ? current : current / target)),
    };
  });
}

// ---- Coach panel ----
export type CoachInsight = {
  id: string;
  icon: string;
  tint: string;
  title: string;
  body: string;
  action?: "Home" | "Tasks" | "Spin" | "Quiz" | "Rewards" | "Referral";
};

export function coachInsights(d: SmartDashboard): CoachInsight[] {
  const out: CoachInsight[] = [];

  if (d.streak.canCheckIn) {
    out.push({
      id: "checkin",
      icon: "calendar-check",
      tint: "#7C3AED",
      title: "Check in to keep your streak",
      body: `Day ${d.streak.current + 1} is worth +${d.streak.todayReward} pts. A tap now keeps your streak alive.`,
      action: "Home",
    });
  }

  if (d.spin.spinsRemaining > 0) {
    out.push({
      id: "spin",
      icon: "rotate",
      tint: "#F59E0B",
      title: `${d.spin.spinsRemaining} spin${d.spin.spinsRemaining === 1 ? "" : "s"} ready`,
      body:
        d.spin.bonusSpins > 0
          ? `Includes ${d.spin.bonusSpins} bonus spin${d.spin.bonusSpins === 1 ? "" : "s"} you earned. Spin now!`
          : "Your spin window is open. Try your luck for points.",
      action: "Spin",
    });
  } else if (d.spin.adBonusRemaining > 0) {
    out.push({
      id: "adspin",
      icon: "video",
      tint: "#F59E0B",
      title: "Watch an ad for +1 spin",
      body: `${d.spin.adBonusRemaining} ad spin${d.spin.adBonusRemaining === 1 ? "" : "s"} available this window — free points.`,
      action: "Spin",
    });
  }

  if (d.box.eligible) {
    out.push({
      id: "box",
      icon: "gift",
      tint: "#10B981",
      title: "Today's mystery box is ready!",
      body: `You completed ${d.box.needed} tasks. Open it for a chance at bonus points.`,
      action: "Home",
    });
  } else if (!d.box.openedToday && d.box.tasksToday < d.box.needed) {
    out.push({
      id: "boxtasks",
      icon: "list-check",
      tint: "#10B981",
      title: `${d.box.needed - d.box.tasksToday} more task${d.box.needed - d.box.tasksToday === 1 ? "" : "s"} to unlock the box`,
      body: `Complete ${d.box.needed} tasks today and the mystery box unlocks for bonus points.`,
      action: "Tasks",
    });
  }

  if (!d.combo.quiz) {
    out.push({
      id: "quiz",
      icon: "brain",
      tint: "#06B6D4",
      title: "Today's quiz is waiting",
      body: "Answer correctly to earn points — one of the three daily combo legs.",
      action: "Quiz",
    });
  } else if (d.combo.canClaim) {
    out.push({
      id: "combo",
      icon: "fire",
      tint: "#EF4444",
      title: "Combo bonus ready!",
      body: `All 3 legs done — claim your +${d.combo.reward} pts combo bonus.`,
      action: "Home",
    });
  }

  if (d.progress) {
    if (d.progress.ready) {
      out.push({
        id: "reward-ready",
        icon: "gift",
        tint: "#7C3AED",
        title: `You can redeem ${d.progress.target?.name ?? "a reward"} now!`,
        body: "Head to the Rewards tab and cash in your points.",
        action: "Rewards",
      });
    } else if (d.progress.target) {
      const diff = d.progress.target.pointsPrice - d.progress.balance;
      out.push({
        id: "reward-next",
        icon: "ticket",
        tint: "#7C3AED",
        title: `${diff} pts from ${d.progress.target.name}`,
        body: "Keep earning — your next reward is in reach.",
        action: "Rewards",
      });
    }
  }

  if (d.referral.count === 0) {
    out.push({
      id: "referral",
      icon: "user-plus",
      tint: "#10B981",
      title: "Invite friends, earn together",
      body: `You earn points when friends complete tasks. Share your code ${d.referral.code}.`,
      action: "Referral",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "all-done",
      icon: "face-smile",
      tint: "#10B981",
      title: "All caught up!",
      body: "Great day so far — check back later for fresh tasks and spins.",
    });
  }

  const order = ["checkin", "box", "combo", "spin", "adspin", "boxtasks", "quiz", "reward-ready", "reward-next", "referral"];
  return out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, 4);
}

export function coachHref(action: CoachInsight["action"]): string {
  switch (action) {
    case "Home":
      return "/home";
    case "Tasks":
      return "/tasks";
    case "Spin":
      return "/spin";
    case "Quiz":
      return "/learn";
    case "Rewards":
      return "/redeem";
    case "Referral":
      return "/rewards-redemption";
    default:
      return "/home";
  }
}

// ---- Smart Score (0–100) ----
export type SmartScore = {
  score: number;
  label: string;
  parts: { label: string; done: boolean }[];
};

export function smartScore(d: SmartDashboard): SmartScore {
  const parts = [
    { label: "Check-in", done: d.streak.checkedInToday },
    { label: "Tasks today", done: d.box.tasksToday > 0 },
    { label: "Mystery box", done: d.box.openedToday },
    { label: "Daily quiz", done: d.combo.quiz },
    { label: "Spins", done: d.spin.baseSpinsRemaining < 3 || d.spin.adBonusEarned > 0 },
    { label: "Social combo", done: d.combo.social },
    { label: "Telegram combo", done: d.combo.telegram },
    { label: "All three combo", done: d.combo.allDone },
  ];
  const weights = [20, 15, 15, 15, 12, 8, 8, 7];
  const score = parts.reduce((s, p, i) => s + (p.done ? weights[i] : 0), 0);
  const label =
    score >= 85
      ? "On fire"
      : score >= 65
        ? "Crushing it"
        : score >= 45
          ? "On a roll"
          : score >= 25
            ? "Warming up"
            : "Just getting started";
  return { score, label, parts };
}

export function formatPts(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const ICON_EMOJI: Record<string, string> = {
  "list-check": "✅",
  "clipboard-check": "📋",
  trophy: "🏆",
  flame: "🔥",
  bolt: "⚡",
  fire: "🔥",
  "user-plus": "👥",
  gift: "🎁",
  medal: "🏅",
  "face-smile": "😄",
  "calendar-check": "📅",
  rotate: "🔁",
  video: "📺",
  brain: "🧠",
  ticket: "🎟️",
  "wand-magic-sparkles": "✨",
  "shield-halved": "🛡️",
  lock: "🔒",
};

export function iconEmoji(name: string): string {
  return ICON_EMOJI[name] ?? "⭐";
}
