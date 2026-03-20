const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const jobEnv = z.object({
  CRON_TIMEZONE: z.string().default("UTC")
}).parse(process.env);

module.exports = { jobEnv };
