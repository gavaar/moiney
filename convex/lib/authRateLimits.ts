import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const authRateLimiter = new RateLimiter(components.rateLimiter, {
  signUp: { kind: "fixed window", rate: 20, period: HOUR },
  signIn: { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  refresh: { kind: "fixed window", rate: 300, period: MINUTE },
});
