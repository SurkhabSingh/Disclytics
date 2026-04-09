const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const jobEnv = z.object({
  CRON_TIMEZONE: z.string().default("UTC"),
  DAILY_STATS_CRON: z.string().default("*/15 * * * *"),
  REMINDER_DISPATCH_CRON: z.string().default("* * * * *")
}).parse(process.env);

module.exports = { jobEnv };
