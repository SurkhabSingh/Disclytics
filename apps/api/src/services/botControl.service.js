const { AppError } = require("../lib/appError");
const { logger } = require("../lib/logger");
const { serviceEnv } = require("../config/serviceEnv");
const { createHttpClient } = require("@analytics-platform/runtime");

const httpClient = createHttpClient({
  baseUrl: serviceEnv.BOT_CONTROL_URL,
  defaultHeaders: {
    "x-internal-secret": serviceEnv.INTERNAL_API_SECRET
  },
  logger: logger.child({
    component: "bot-control-client"
  }),
  retries: serviceEnv.INTERNAL_REQUEST_RETRIES,
  serviceName: "api",
  timeoutMs: serviceEnv.INTERNAL_REQUEST_TIMEOUT_MS
});

async function sendReminderCommand(reminder) {
  try {
    const response = await httpClient.post("/internal/notifications/reminders", reminder);
    return response.data;
  } catch (error) {
    throw new AppError("Bot notification dispatch failed", 502, {
      message: error.message,
      requestId: error.requestId || null
    });
  }
}

module.exports = {
  sendReminderCommand
};
