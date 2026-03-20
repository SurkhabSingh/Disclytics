const { createHttpClient } = require("@analytics-platform/runtime");

const { env } = require("../config/env");
const { logger } = require("../lib/logger");

function createBackendClient() {
  const httpClient = createHttpClient({
    baseUrl: env.BACKEND_BASE_URL,
    defaultHeaders: {
      "x-internal-secret": env.INTERNAL_API_SECRET
    },
    logger: logger.child({
      component: "backend-client"
    }),
    retries: env.INTERNAL_REQUEST_RETRIES,
    serviceName: "bot",
    timeoutMs: env.INTERNAL_REQUEST_TIMEOUT_MS
  });

  async function post(path, payload) {
    const response = await httpClient.post(path, payload);
    return response.data;
  }

  return { post };
}

module.exports = { createBackendClient };
