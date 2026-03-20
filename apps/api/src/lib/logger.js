const { createLogger } = require("@analytics-platform/runtime");

const logger = createLogger({
  service: "api",
  level: process.env.LOG_LEVEL || "info"
});

module.exports = { logger };
