/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as PiProvider from "../PiProvider.js";
import type * as ResendOTP from "../ResendOTP.js";
import type * as TelegramProvider from "../TelegramProvider.js";
import type * as academy from "../academy.js";
import type * as achievements from "../achievements.js";
import type * as activities from "../activities.js";
import type * as admin from "../admin.js";
import type * as ads from "../ads.js";
import type * as auth from "../auth.js";
import type * as backfill from "../backfill.js";
import type * as bonus from "../bonus.js";
import type * as cleanup from "../cleanup.js";
import type * as combos from "../combos.js";
import type * as countDelta from "../countDelta.js";
import type * as cpx from "../cpx.js";
import type * as crons from "../crons.js";
import type * as deviceSignals from "../deviceSignals.js";
import type * as features from "../features.js";
import type * as fraud from "../fraud.js";
import type * as http from "../http.js";
import type * as inquiries from "../inquiries.js";
import type * as ipReputation from "../ipReputation.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeAdmin from "../knowledgeAdmin.js";
import type * as knowledgeContent from "../knowledgeContent.js";
import type * as knowledgeSeed from "../knowledgeSeed.js";
import type * as leaderboard from "../leaderboard.js";
import type * as levels from "../levels.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as lib_ratelimit from "../lib/ratelimit.js";
import type * as linkedProfiles from "../linkedProfiles.js";
import type * as marketplace from "../marketplace.js";
import type * as piAds from "../piAds.js";
import type * as piAuth from "../piAuth.js";
import type * as piDonations from "../piDonations.js";
import type * as piLink from "../piLink.js";
import type * as piPayments from "../piPayments.js";
import type * as piWallet from "../piWallet.js";
import type * as piWithdrawals from "../piWithdrawals.js";
import type * as piWithdrawalsPayout from "../piWithdrawalsPayout.js";
import type * as pointDonations from "../pointDonations.js";
import type * as points from "../points.js";
import type * as profile from "../profile.js";
import type * as quiz from "../quiz.js";
import type * as quizSeed from "../quizSeed.js";
import type * as referrals from "../referrals.js";
import type * as reports from "../reports.js";
import type * as rewards from "../rewards.js";
import type * as rewardsConfig from "../rewardsConfig.js";
import type * as sidraAuth from "../sidraAuth.js";
import type * as spin from "../spin.js";
import type * as streaks from "../streaks.js";
import type * as surveys from "../surveys.js";
import type * as tasks from "../tasks.js";
import type * as telegram from "../telegram.js";
import type * as telegramAuth from "../telegramAuth.js";
import type * as users from "../users.js";
import type * as vas from "../vas.js";
import type * as verifications from "../verifications.js";
import type * as videos from "../videos.js";
import type * as visitors from "../visitors.js";
import type * as wallets from "../wallets.js";
import type * as xp from "../xp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  PiProvider: typeof PiProvider;
  ResendOTP: typeof ResendOTP;
  TelegramProvider: typeof TelegramProvider;
  academy: typeof academy;
  achievements: typeof achievements;
  activities: typeof activities;
  admin: typeof admin;
  ads: typeof ads;
  auth: typeof auth;
  backfill: typeof backfill;
  bonus: typeof bonus;
  cleanup: typeof cleanup;
  combos: typeof combos;
  countDelta: typeof countDelta;
  cpx: typeof cpx;
  crons: typeof crons;
  deviceSignals: typeof deviceSignals;
  features: typeof features;
  fraud: typeof fraud;
  http: typeof http;
  inquiries: typeof inquiries;
  ipReputation: typeof ipReputation;
  knowledge: typeof knowledge;
  knowledgeAdmin: typeof knowledgeAdmin;
  knowledgeContent: typeof knowledgeContent;
  knowledgeSeed: typeof knowledgeSeed;
  leaderboard: typeof leaderboard;
  levels: typeof levels;
  "lib/guards": typeof lib_guards;
  "lib/ledger": typeof lib_ledger;
  "lib/ratelimit": typeof lib_ratelimit;
  linkedProfiles: typeof linkedProfiles;
  marketplace: typeof marketplace;
  piAds: typeof piAds;
  piAuth: typeof piAuth;
  piDonations: typeof piDonations;
  piLink: typeof piLink;
  piPayments: typeof piPayments;
  piWallet: typeof piWallet;
  piWithdrawals: typeof piWithdrawals;
  piWithdrawalsPayout: typeof piWithdrawalsPayout;
  pointDonations: typeof pointDonations;
  points: typeof points;
  profile: typeof profile;
  quiz: typeof quiz;
  quizSeed: typeof quizSeed;
  referrals: typeof referrals;
  reports: typeof reports;
  rewards: typeof rewards;
  rewardsConfig: typeof rewardsConfig;
  sidraAuth: typeof sidraAuth;
  spin: typeof spin;
  streaks: typeof streaks;
  surveys: typeof surveys;
  tasks: typeof tasks;
  telegram: typeof telegram;
  telegramAuth: typeof telegramAuth;
  users: typeof users;
  vas: typeof vas;
  verifications: typeof verifications;
  videos: typeof videos;
  visitors: typeof visitors;
  wallets: typeof wallets;
  xp: typeof xp;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
