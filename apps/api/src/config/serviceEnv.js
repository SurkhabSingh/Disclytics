const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const serviceEnv = z.object({
  BOT_CONTROL_URL: z.string().url(),
  INTERNAL_API_SECRET: z.string().min(16),
  INTERNAL_REQUEST_TIMEOUT_MS: z.coerce.number().default(5_000),
  INTERNAL_REQUEST_RETRIES: z.coerce.number().default(2)
}).parse(process.env);

module.exports = { serviceEnv };
