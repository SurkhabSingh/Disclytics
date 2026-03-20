const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");

const requestContextStorage = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return requestContextStorage.run(context, callback);
}

function getRequestContext() {
  return requestContextStorage.getStore() || {};
}

function getRequestId() {
  return getRequestContext().requestId || null;
}

function createRequestId() {
  return randomUUID();
}

function createRequestContextMiddleware(logger) {
  return function requestContextMiddleware(req, res, next) {
    const requestId = req.get("x-request-id") || createRequestId();
    const startedAt = Date.now();
    const context = {
      requestId,
      method: req.method,
      path: req.originalUrl
    };

    res.setHeader("x-request-id", requestId);

    runWithRequestContext(context, () => {
      req.requestId = requestId;
      req.log = logger.child({
        requestId,
        method: req.method,
        path: req.originalUrl
      });

      req.log.info("Request started");

      res.on("finish", () => {
        req.log.info("Request completed", {
          durationMs: Date.now() - startedAt,
          statusCode: res.statusCode
        });
      });

      next();
    });
  };
}

module.exports = {
  createRequestContextMiddleware,
  createRequestId,
  getRequestContext,
  getRequestId,
  runWithRequestContext
};
