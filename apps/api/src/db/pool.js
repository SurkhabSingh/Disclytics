const { Pool } = require("pg");

const { databaseConfig } = require("../config/database");
const { logger } = require("../lib/logger");

const pool = new Pool({
  connectionString: databaseConfig.DATABASE_URL,
  max: databaseConfig.DATABASE_POOL_MAX
});

pool.on("error", (error) => {
  logger.error("Unexpected PostgreSQL error", {
    error
  });
});

async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withTransaction
};
