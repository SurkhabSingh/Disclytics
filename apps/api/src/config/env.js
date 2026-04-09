const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  OAUTH_STATE_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().default("analytics_session"),
  SESSION_COOKIE_DOMAIN: z.string().trim().optional().or(z.literal("")),
  SESSION_COOKIE_PATH: z.string().default("/"),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SESSION_COOKIE_SECURE: z.enum(["auto", "true", "false"]).default("auto"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),
  WEB_APP_URL: z.string().url().default("http://localhost:4173"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:4173"),
  INTERNAL_API_SECRET: z.string().min(16),
  TRUST_PROXY: z.coerce.number().default(0),
});

const env = schema.parse(process.env);

module.exports = { env };
