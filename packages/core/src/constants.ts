export const POINTS = {
  FOLLOW_PAGE: 10,
  JOIN_CHANNEL: 8,
  QUIZ_CORRECT: 3,
  SURVEY_BASE: 50,
  REFERRAL_QUALIFIED: 100,
  STREAK_BONUS: {
    DAY_1: 1,
    DAY_2: 2,
    DAY_3: 3,
    DAY_4: 4,
    DAY_5: 5,
    DAY_6: 6,
    DAY_7: 10,
  },
  COMBO_BONUS: 5,
} as const;

export const FRAUD_THRESHOLDS = {
  NEW_USER_VERIFICATION_RATE: 1.0,
  ESTABLISHED_USER_VERIFICATION_RATE: 0.3,
  FRAUD_BACK_TO_FULL_RATE_DAYS: 30,
  MAX_FRAUD_SCORE_BEFORE_BAN: 100,
} as const;

export const PLATFORM_LIMITS_DEFAULTS = {
  tiktok: { dailyTaskLimit: 15, cooldownMinutes: 3, newProfileFactor: 0.5 },
  facebook: { dailyTaskLimit: 15, cooldownMinutes: 3, newProfileFactor: 0.5 },
  telegram: { dailyTaskLimit: 10, cooldownMinutes: 1, newProfileFactor: 0.5 },
  instagram: { dailyTaskLimit: 10, cooldownMinutes: 3, newProfileFactor: 0.5 },
} as const;

export const HOLD_DURATION_MS = 48 * 60 * 60 * 1000;

export const PROFILE_LOCK_DAYS = 30;

export const BIO_CODE_EXPIRY_MINUTES = 15;

export const STORAGE_PURGE_DAYS = 14;

export const ECOSYSTEM_LABELS: Record<string, string> = {
  PI: "Pi Network",
  SIDRA: "Sidra Chain",
};
