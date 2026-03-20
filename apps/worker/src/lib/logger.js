const { createLogger } = require("@analytics-platform/runtime");

const { env } = require("../config/env");

const logger = createLogger({
  service: "worker",
  level: env.LOG_LEVEL
});

module.exports = { logger };
