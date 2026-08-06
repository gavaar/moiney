/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authRateLimits from "../lib/authRateLimits.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as lib_jwtPublic from "../lib/jwtPublic.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_pipes from "../lib/pipes.js";
import type * as lib_transactions from "../lib/transactions.js";
import type * as lib_usernames from "../lib/usernames.js";
import type * as migrations from "../migrations.js";
import type * as pipes from "../pipes.js";
import type * as sessions from "../sessions.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/authRateLimits": typeof lib_authRateLimits;
  "lib/constants": typeof lib_constants;
  "lib/jwt": typeof lib_jwt;
  "lib/jwtPublic": typeof lib_jwtPublic;
  "lib/password": typeof lib_password;
  "lib/pipes": typeof lib_pipes;
  "lib/transactions": typeof lib_transactions;
  "lib/usernames": typeof lib_usernames;
  migrations: typeof migrations;
  pipes: typeof pipes;
  sessions: typeof sessions;
  transactions: typeof transactions;
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

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
