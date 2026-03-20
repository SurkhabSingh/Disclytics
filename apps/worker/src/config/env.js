const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const env = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  BOT_CONTROL_URL: z.string().url(),
  INTERNAL_API_SECRET: z.string().min(16),
  CRON_TIMEZONE: z.string().default("UTC"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  INTERNAL_REQUEST_TIMEOUT_MS: z.coerce.number().default(5_000),
  INTERNAL_REQUEST_RETRIES: z.coerce.number().default(2)
}).parse(process.env);

module.exports = { env };
