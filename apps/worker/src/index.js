require("./config/env");

const { registerGracefulShutdown } = require("@analytics-platform/runtime");

const { pool } = require("../../api/src/db/pool");
const { startJobs } = require("../../api/src/jobs/startJobs");
const { logger } = require("./lib/logger");

async function startWorker() {
  await pool.query("SELECT 1");
  const scheduler = startJobs(logger.child({ component: "scheduler" }));

  logger.info("Worker started");

  registerGracefulShutdown({
    cleanup: async () => {
      scheduler.stop();
      await pool.end();
    },
    logger,
    name: "worker"
  });
}

startWorker().catch((error) => {
  logger.fatal("Failed to start worker", {
    error
  });
  process.exit(1);
});
