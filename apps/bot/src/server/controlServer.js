const express = require("express");
const { createRequestContextMiddleware } = require("@analytics-platform/runtime");

const { env } = require("../config/env");
const { logger } = require("../lib/logger");
const { deliverReminder } = require("../services/notification.service");
const { playTextToMemberVoiceChannel } = require("../services/tts.service");

function createControlServer(client) {
  const app = express();
  const wrap = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error("Bot control request failed", {
        error
      });
      res.status(500).json({
        error: "Internal control server error",
        requestId: req.requestId || null
      });
    }
  };

  app.use(express.json({ limit: "1mb" }));
  app.use(createRequestContextMiddleware(logger.child({ component: "control-server" })));
  app.get("/internal/health/live", (req, res) => {
    res.json({
      service: "bot-control",
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });
  app.get("/internal/health/ready", (req, res) => {
    res.json({
      service: "bot-control",
      status: client.isReady() ? "ready" : "starting",
      timestamp: new Date().toISOString()
    });
  });
  app.use((req, res, next) => {
    const secret = req.get("x-internal-secret");

    if (!secret || secret !== env.INTERNAL_API_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  });

  app.post("/internal/notifications/reminders", wrap(async (req, res) => {
    const result = await deliverReminder(client, req.body);
    res.json(result);
  }));

  app.post("/internal/notifications/tts", wrap(async (req, res) => {
    const result = await playTextToMemberVoiceChannel(client, req.body);
    res.json(result);
  }));

  return app.listen(env.BOT_CONTROL_PORT, () => {
    logger.info("Bot control server listening", {
      port: env.BOT_CONTROL_PORT
    });
  });
}

module.exports = { createControlServer };
