const { Router } = require("express");
const { z } = require("zod");

const {
  createInternalReminder,
  getGuildUserStats,
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
  name: z.string().nullable().optional(),
  type: z.string().nullable().optional()
});

const messageEventSchema = z.object({
  user: userSchema,
  guild: guildSchema,
  channel: channelSchema,
  content: z.string().nullable().optional(),
  attachments: z.array(z.object({
    url: z.string(),
    proxyUrl: z.string().nullable().optional(),
    contentType: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional()
  })).optional(),
  embeds: z.array(z.object({
    url: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional()
  })).optional(),
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

const statsSummarySchema = z.object({
  guildId: z.string(),
  period: z.enum(["day", "week", "month", "lifetime"]),
  userId: z.string()
});

const reminderCreateSchema = z.object({
  user: userSchema,
  guild: guildSchema.optional(),
  targetChannelId: z.string().optional(),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(1000),
  scheduleType: z.enum(["once", "daily", "weekly"]),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduleDays: z.array(z.number().int().min(0).max(6)).default([]),
  timezone: z.string().optional(),
  deliveryModes: z.array(z.enum(["dm", "channel", "voice"])).default(["dm"])
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
router.post("/analytics/guild-user-summary", validate(statsSummarySchema), asyncHandler(getGuildUserStats));
router.post("/reminders", validate(reminderCreateSchema), asyncHandler(createInternalReminder));

module.exports = router;
