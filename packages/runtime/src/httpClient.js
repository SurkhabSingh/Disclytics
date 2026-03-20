const { createRequestId, getRequestId } = require("./requestContext");

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

class HttpClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "HttpClientError";
    this.status = options.status;
    this.responseBody = options.responseBody;
    this.requestId = options.requestId || null;
    this.url = options.url || null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status) {
  return RETRYABLE_STATUS_CODES.has(status);
}

function createHttpClient({
  serviceName,
  baseUrl = "",
  logger,
  defaultHeaders = {},
  timeoutMs = 5_000,
  retries = 2,
  retryDelayMs = 250
}) {
  async function request(path, options = {}) {
    const requestId = options.requestId || getRequestId() || createRequestId();
    const url = options.url || `${baseUrl}${path}`;
    const method = options.method || "GET";
    const headers = {
      ...defaultHeaders,
      ...(options.headers || {}),
      "x-request-id": requestId,
      "x-source-service": serviceName
    };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const maxAttempts = (options.retries ?? retries) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);

      try {
        logger.debug("HTTP request started", {
          attempt,
          method,
          requestId,
          url
        });

        const response = await fetch(url, {
          method,
          headers,
          body: options.rawBody || (options.body ? JSON.stringify(options.body) : undefined),
          signal: controller.signal
        });

        clearTimeout(timer);

        const rawBody = await response.text();
        const contentType = response.headers.get("content-type") || "";
        const parsedBody = contentType.includes("application/json") && rawBody
          ? JSON.parse(rawBody)
          : rawBody;

        if (!response.ok) {
          if (attempt < maxAttempts && shouldRetryStatus(response.status)) {
            logger.warn("HTTP request failed and will be retried", {
              attempt,
              method,
              requestId,
              status: response.status,
              url
            });
            await delay(retryDelayMs * attempt);
            continue;
          }

          throw new HttpClientError(`HTTP ${response.status} for ${method} ${url}`, {
            status: response.status,
            requestId,
            responseBody: parsedBody,
            url
          });
        }

        logger.debug("HTTP request completed", {
          attempt,
          method,
          requestId,
          status: response.status,
          url
        });

        return {
          status: response.status,
          data: parsedBody,
          headers: response.headers,
          requestId
        };
      } catch (error) {
        clearTimeout(timer);

        const isAbortError = error && error.name === "AbortError";

        if (attempt < maxAttempts && (isAbortError || error instanceof TypeError)) {
          logger.warn("HTTP request network failure, retrying", {
            attempt,
            error,
            method,
            requestId,
            url
          });
          await delay(retryDelayMs * attempt);
          continue;
        }

        if (error instanceof HttpClientError) {
          throw error;
        }

        throw new HttpClientError(
          isAbortError ? `Request timed out for ${method} ${url}` : error.message,
          {
            requestId,
            url
          }
        );
      }
    }

    throw new HttpClientError(`Exhausted retries for ${method} ${url}`, {
      requestId,
      url
    });
  }

  return {
    get(path, options) {
      return request(path, {
        ...(options || {}),
        method: "GET"
      });
    },
    post(path, body, options) {
      return request(path, {
        ...(options || {}),
        body,
        method: "POST"
      });
    },
    request
  };
}

module.exports = {
  HttpClientError,
  createHttpClient
};
