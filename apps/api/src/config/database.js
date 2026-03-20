const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const databaseConfig = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().default(20)
}).parse(process.env);

module.exports = { databaseConfig };
