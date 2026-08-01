/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as TelegramProvider from "../TelegramProvider.js";
import type * as academy from "../academy.js";
import type * as admin from "../admin.js";
import type * as ads from "../ads.js";
import type * as auth from "../auth.js";
import type * as bonus from "../bonus.js";
import type * as combos from "../combos.js";
import type * as countDelta from "../countDelta.js";
import type * as cpx from "../cpx.js";
import type * as crons from "../crons.js";
import type * as deviceSignals from "../deviceSignals.js";
import type * as fraud from "../fraud.js";
import type * as http from "../http.js";
import type * as inquiries from "../inquiries.js";
import type * as ipReputation from "../ipReputation.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_ratelimit from "../lib/ratelimit.js";
import type * as linkedProfiles from "../linkedProfiles.js";
import type * as marketplace from "../marketplace.js";
import type * as points from "../points.js";
import type * as quiz from "../quiz.js";
import type * as quizSeed from "../quizSeed.js";
import type * as referrals from "../referrals.js";
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
import type * as wallets from "../wallets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  TelegramProvider: typeof TelegramProvider;
  academy: typeof academy;
  admin: typeof admin;
  ads: typeof ads;
  auth: typeof auth;
  bonus: typeof bonus;
  combos: typeof combos;
  countDelta: typeof countDelta;
  cpx: typeof cpx;
  crons: typeof crons;
  deviceSignals: typeof deviceSignals;
  fraud: typeof fraud;
  http: typeof http;
  inquiries: typeof inquiries;
  ipReputation: typeof ipReputation;
  leaderboard: typeof leaderboard;
  "lib/guards": typeof lib_guards;
  "lib/ratelimit": typeof lib_ratelimit;
  linkedProfiles: typeof linkedProfiles;
  marketplace: typeof marketplace;
  points: typeof points;
  quiz: typeof quiz;
  quizSeed: typeof quizSeed;
  referrals: typeof referrals;
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
  wallets: typeof wallets;
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
