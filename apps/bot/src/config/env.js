const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const defaultBackendPort = process.env.PORT || "4000";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_COMMAND_GUILD_ID: z.string().optional(),
  BACKEND_BASE_URL: z.string().url().default(`http://127.0.0.1:${defaultBackendPort}`),
  INTERNAL_API_SECRET: z.string().min(16),
  BOT_CONTROL_HOST: z.string().default("127.0.0.1"),
  BOT_CONTROL_PORT: z.coerce.number().default(4100),
  GOOGLE_TTS_LANG: z.string().default("en"),
  INTERNAL_REQUEST_TIMEOUT_MS: z.coerce.number().default(5_000),
  INTERNAL_REQUEST_RETRIES: z.coerce.number().default(2)
});

const env = schema.parse(process.env);

module.exports = { env };
