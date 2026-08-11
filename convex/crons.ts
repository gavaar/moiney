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
crons.daily(
  "cleanup stale transaction titles",
  { hourUTC: 4, minuteUTC: 0 },
  internal.transactions.cleanupStaleTitleUsage,
  {},
);
crons.daily(
  "cleanup orphaned profile pictures",
  { hourUTC: 4, minuteUTC: 0 },
  internal.profile.cleanupOrphanedProfilePictures,
  {},
);

export default crons;
