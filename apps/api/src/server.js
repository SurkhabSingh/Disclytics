const { createApp } = require("./app");
const { env } = require("./config/env");
const { pool } = require("./db/pool");
const { logger } = require("./lib/logger");
const { registerGracefulShutdown } = require("@analytics-platform/runtime");

async function startServer() {
  await pool.query("SELECT 1");

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info("API listening", {
      host: env.HOST,
      port: env.PORT,
      nodeEnv: env.NODE_ENV
    });
  });

  registerGracefulShutdown({
    cleanup: async () => {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await pool.end();
    },
    logger,
    name: "api"
  });
}

startServer().catch((error) => {
  logger.fatal("Failed to start API", {
    error
  });
  process.exit(1);
});
