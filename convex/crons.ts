import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.monthly(
  "cleanup expired sessions",
  { day: 1, hourUTC: 3, minuteUTC: 0 },
  internal.sessions.cleanupExpired,
);
crons.daily(
  "run due cron rules",
  { hourUTC: 6, minuteUTC: 0 },
  internal.pipes.runDueCronRules,
  {},
);

export default crons;
