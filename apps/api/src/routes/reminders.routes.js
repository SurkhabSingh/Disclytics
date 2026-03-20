const { Router } = require("express");
const { z } = require("zod");

const {
  createReminder,
  listReminders,
  toggleReminder
} = require("../controllers/reminder.controller");
const { asyncHandler } = require("../lib/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");
const { validate } = require("../middleware/validate");

const createReminderSchema = z.object({
  guildId: z.string().optional(),
  targetChannelId: z.string().optional(),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(1000),
  scheduleType: z.enum(["once", "daily", "weekly"]),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduleDays: z.array(z.number().int().min(0).max(6)).default([]),
  timezone: z.string().default("UTC"),
  deliveryModes: z.array(z.enum(["dm", "channel", "voice"])).default(["dm"])
});

const toggleReminderSchema = z.object({
  active: z.boolean()
});

const router = Router();

router.get("/", requireAuth, asyncHandler(listReminders));
router.post("/", requireAuth, validate(createReminderSchema), asyncHandler(createReminder));
router.patch(
  "/:reminderId/toggle",
  requireAuth,
  validate(toggleReminderSchema),
  asyncHandler(toggleReminder)
);

module.exports = router;
