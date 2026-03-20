const { createHttpClient, HttpClientError } = require("./httpClient");
const { createLogger, serializeError } = require("./logger");
const {
  createRequestContextMiddleware,
  createRequestId,
  getRequestContext,
  getRequestId,
  runWithRequestContext
} = require("./requestContext");
const { registerGracefulShutdown } = require("./shutdown");

module.exports = {
  createHttpClient,
  createLogger,
  createRequestContextMiddleware,
  createRequestId,
  getRequestContext,
  getRequestId,
  HttpClientError,
  registerGracefulShutdown,
  runWithRequestContext,
  serializeError
};
