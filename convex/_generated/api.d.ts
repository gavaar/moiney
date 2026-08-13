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
import type * as lib_pipes_delete_contracts from "../lib/pipes/delete/contracts.js";
import type * as lib_pipes_delete_index from "../lib/pipes/delete/index.js";
import type * as lib_pipes_delete_operations from "../lib/pipes/delete/operations.js";
import type * as lib_pipes_delete_plan from "../lib/pipes/delete/plan.js";
import type * as lib_pipes_delete_transactionDisposition from "../lib/pipes/delete/transactionDisposition.js";
import type * as lib_pipes_index from "../lib/pipes/index.js";
import type * as lib_pipes_pipes from "../lib/pipes/pipes.js";
import type * as lib_transactions from "../lib/transactions.js";
import type * as lib_usernames from "../lib/usernames.js";
import type * as pipes from "../pipes.js";
import type * as profile from "../profile.js";
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
  "lib/pipes/delete/contracts": typeof lib_pipes_delete_contracts;
  "lib/pipes/delete/index": typeof lib_pipes_delete_index;
  "lib/pipes/delete/operations": typeof lib_pipes_delete_operations;
  "lib/pipes/delete/plan": typeof lib_pipes_delete_plan;
  "lib/pipes/delete/transactionDisposition": typeof lib_pipes_delete_transactionDisposition;
  "lib/pipes/index": typeof lib_pipes_index;
  "lib/pipes/pipes": typeof lib_pipes_pipes;
  "lib/transactions": typeof lib_transactions;
  "lib/usernames": typeof lib_usernames;
  pipes: typeof pipes;
  profile: typeof profile;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
