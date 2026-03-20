const { createLogger } = require("@analytics-platform/runtime");

const { env } = require("../config/env");

const logger = createLogger({
  service: "bot",
  level: env.LOG_LEVEL
});

module.exports = { logger };
