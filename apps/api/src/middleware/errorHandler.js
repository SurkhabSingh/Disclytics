const { ZodError } = require("zod");

const { AppError } = require("../lib/appError");
const { logger } = require("../lib/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Route not found"
  });
}

function errorHandler(error, req, res, next) {
  const requestLogger = req.log || logger;

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ZodError) {
    requestLogger.warn("Validation failed", {
      details: error.flatten()
    });
    return res.status(400).json({
      error: "Validation failed",
      details: error.flatten(),
      requestId: req.requestId || null
    });
  }

  if (error instanceof AppError) {
    requestLogger.warn("Handled application error", {
      details: error.details,
      error
    });
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
      requestId: req.requestId || null
    });
  }

  requestLogger.error("Unhandled application error", {
    error
  });

  return res.status(500).json({
    error: "Internal server error",
    requestId: req.requestId || null
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
