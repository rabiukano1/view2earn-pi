export type Ecosystem = "PI" | "SIDRA";

export type TaskType =
  | "FOLLOW_PAGE"
  | "JOIN_CHANNEL"
  | "MULTI_TASK"
  | "QUIZ"
  | "SURVEY";

export type TaskPlatform = "tiktok" | "facebook" | "telegram" | "instagram";

export type VerifierKind =
  | "screenshot-ai"
  | "bio-code"
  | "count-delta"
  | "telegram-bot";

export type VerificationState =
  | "CREATED"
  | "USER_CLAIMED_DONE"
  | "PROOF_SUBMITTED"
  | "AI_APPROVED"
  | "AI_UNCERTAIN"
  | "AI_REJECTED"
  | "ADMIN_REVIEW"
  | "PENDING_HOLD"
  | "RELEASED"
  | "CANCELLED"
  | "REJECTED";

export type RedemptionStatus =
  | "processing"
  | "fulfilled"
  | "failed"
  | "refunded";

export type PaymentMethod = "POINTS" | "PI" | "SIDRA";

export type ProviderKind = "ADS" | "SURVEY" | "VAS";

export type ProviderPlatform = "pi-web" | "sidra-mobile" | "both";

export type UserTier = 0 | 1 | 2;

export interface User {
  ecosystem: Ecosystem;
  externalUid: string;
  username: string;
  tier: UserTier;
  fraudScore: number;
  deviceFingerprint: string;
  signupIp: string;
  country: string;
}

export interface LinkedProfile {
  userId: string;
  platform: TaskPlatform;
  url: string;
  usernameSnapshot: string;
  verifiedAt: number;
  lockedUntil: number;
  normalizedUrl: string;
}

export interface Task {
  type: TaskType;
  platform: TaskPlatform;
  targetUrl: string;
  points: number;
  verifier: VerifierKind;
  maxCompletions: number;
  creatorUserId?: string;
  status: string;
  expiresAt: number;
}

export interface Verification {
  taskId: string;
  userId: string;
  state: VerificationState;
  screenshotStorageId?: string;
  screenshotPhash?: string;
  sampled?: boolean;
  aiConfidence?: number;
  reviewedBy?: string;
  holdUntil?: number;
}

export interface PointsLedgerEntry {
  userId: string;
  delta: number;
  reason: string;
  refId?: string;
  balanceAfter: number;
}

export interface Provider {
  kind: ProviderKind;
  name: string;
  platform: ProviderPlatform;
  configJson: string;
  enabled: boolean;
}

export interface CatalogItem {
  ecosystem: Ecosystem;
  itemType: "DATA" | "AIRTIME";
  name: string;
  pointsPrice?: number;
  coinPrice?: number;
  providerSku: string;
  countries: string[];
  enabled: boolean;
}

export interface Redemption {
  userId: string;
  catalogId: string;
  paidWith: PaymentMethod;
  amount: number;
  phoneNumber: string;
  providerRef?: string;
  status: RedemptionStatus;
}

export interface Referral {
  referrerId: string;
  refereeId: string;
  qualifiedAt?: number;
  rewarded: boolean;
}

export interface FraudEvent {
  userId: string;
  type: string;
  detailsJson: string;
}

export interface DeviceSignal {
  userId: string;
  platform: ProviderPlatform;
  canvasHash?: string;
  audioHash?: string;
  hardwareJson: string;
  ip: string;
  ipFraudScore?: number;
  vpnDetected?: boolean;
  timezone: string;
  tzIpMismatch?: boolean;
}

export interface PlatformLimit {
  platform: TaskPlatform;
  dailyTaskLimit: number;
  cooldownMinutes: number;
  newProfileFactor: number;
}
