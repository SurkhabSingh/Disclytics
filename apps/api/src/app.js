const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const { createRequestContextMiddleware } = require("@analytics-platform/runtime");

const { env } = require("./config/env");
const { AppError } = require("./lib/appError");
const { logger } = require("./lib/logger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

function parseAllowedOrigins(value) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedDevelopmentOrigin(origin) {
  if (!origin) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isAllowedPort = parsed.port === "4173" || parsed.port === "5173";

    return parsed.protocol === "http:" && isLocalHost && isAllowedPort;
  } catch {
    return false;
  }
}

function createApp() {
  const app = express();
  const allowedOrigins = new Set([
    ...parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
    env.WEB_APP_URL
  ]);

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (env.NODE_ENV === "production" && req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          allowedOrigins.has(origin) ||
          (env.NODE_ENV !== "production" && isAllowedDevelopmentOrigin(origin))
        ) {
          return callback(null, true);
        }

        return callback(new AppError("Origin not allowed by CORS", 403));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(createRequestContextMiddleware(logger));

  app.use("/api", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
