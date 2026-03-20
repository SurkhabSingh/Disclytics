const { Router } = require("express");
const { z } = require("zod");

const {
  ingestMessage,
  reconcileVoiceSessions,
  startVoiceSession,
  stopVoiceSession,
  syncGuildPresence
} = require("../controllers/internal.controller");
const { asyncHandler } = require("../lib/asyncHandler");
const { requireInternalAuth } = require("../middleware/requireInternalAuth");
const { validate } = require("../middleware/validate");

const userSchema = z.object({
  userId: z.string(),
  username: z.string(),
  globalName: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  timezone: z.string().optional()
});

const guildSchema = z.object({
  guildId: z.string(),
  name: z.string(),
  icon: z.string().nullable().optional()
});

const channelSchema = z.object({
  channelId: z.string(),
  name: z.string().nullable().optional()
});

const messageEventSchema = z.object({
  user: userSchema,
  guild: guildSchema,
  channel: channelSchema,
  messageId: z.string().optional(),
  idempotencyKey: z.string(),
  timestamp: z.string().datetime()
});

const voiceStartSchema = z.object({
  user: userSchema,
  guild: guildSchema,
  channel: channelSchema,
  idempotencyKey: z.string(),
  startTime: z.string().datetime()
});

const voiceStopSchema = z.object({
  user: userSchema,
  guild: guildSchema,
  channel: channelSchema,
  idempotencyKey: z.string(),
  endTime: z.string().datetime(),
  reason: z.string().optional(),
  sessionStartTime: z.string().datetime().optional()
});

const voiceReconcileSchema = z.object({
  observedAt: z.string().datetime(),
  sessions: z.array(
    z.object({
      user: userSchema,
      guild: guildSchema,
      channel: channelSchema
    })
  )
});

const guildSyncSchema = z.object({
  guilds: z.array(guildSchema)
});

const router = Router();

router.use(requireInternalAuth);

router.post("/events/messages", validate(messageEventSchema), asyncHandler(ingestMessage));
router.post("/voice-sessions/start", validate(voiceStartSchema), asyncHandler(startVoiceSession));
router.post("/voice-sessions/stop", validate(voiceStopSchema), asyncHandler(stopVoiceSession));
router.post(
  "/voice-sessions/reconcile",
  validate(voiceReconcileSchema),
  asyncHandler(reconcileVoiceSessions)
);
router.post("/guilds/sync", validate(guildSyncSchema), asyncHandler(syncGuildPresence));

module.exports = router;
