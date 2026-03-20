const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const { createRequestContextMiddleware } = require("@analytics-platform/runtime");

const { env } = require("./config/env");
const { AppError } = require("./lib/appError");
const { logger } = require("./lib/logger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((value) => value.trim());

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
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
