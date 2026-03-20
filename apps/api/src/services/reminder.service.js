const {
  REMINDER_DELIVERY_TYPES
} = require("@analytics-platform/shared");

const { pool } = require("../db/pool");
const { AppError } = require("../lib/appError");
const { logger } = require("../lib/logger");
const {
  createReminder,
  findDueReminders,
  listRemindersByUser,
  toggleReminder,
  updateReminderStatus
} = require("../repositories/reminder.repository");
const { sendReminderCommand } = require("./botControl.service");
const {
  computeNextRunAt,
  getNextReminderState
} = require("./reminderSchedule.service");

async function createUserReminder(userId, payload) {
  const client = await pool.connect();

  try {
    const nextRunAt = computeNextRunAt({
      ...payload,
      timezone: payload.timezone || "UTC"
    });

    return await createReminder(client, {
      userId,
      guildId: payload.guildId,
      targetChannelId: payload.targetChannelId,
      title: payload.title,
      message: payload.message,
      scheduleType: payload.scheduleType,
      scheduleTime: payload.scheduleTime,
      scheduleDate: payload.scheduleDate,
      scheduleDays: payload.scheduleDays,
      timezone: payload.timezone || "UTC",
      deliveryModes: payload.deliveryModes.length
        ? payload.deliveryModes
        : [REMINDER_DELIVERY_TYPES.DM],
      nextRunAt
    });
  } finally {
    logger.debug("Reminder create flow completed", {
      userId
    });
    client.release();
  }
}

async function listUserReminders(userId) {
  const client = await pool.connect();

  try {
    return await listRemindersByUser(client, userId);
  } finally {
    client.release();
  }
}

async function setReminderActive(userId, reminderId, active) {
  const client = await pool.connect();

  try {
    const updated = await toggleReminder(client, reminderId, userId, active);

    if (!updated) {
      throw new AppError("Reminder not found", 404);
    }

    return updated;
  } finally {
    client.release();
  }
}

async function dispatchDueReminders() {
  const client = await pool.connect();

  try {
    const reminders = await findDueReminders(client, 100);

    for (const reminder of reminders) {
      try {
        logger.info("Dispatching reminder", {
          reminderId: reminder.id,
          userId: reminder.discord_user_id
        });
        await sendReminderCommand({
          reminderId: reminder.id,
          userId: reminder.discord_user_id,
          guildId: reminder.discord_guild_id,
          targetChannelId: reminder.target_channel_id,
          title: reminder.title,
          message: reminder.message,
          deliveryModes: reminder.delivery_modes
        });

        await updateReminderStatus(client, reminder.id, getNextReminderState(reminder));
        logger.info("Reminder dispatched successfully", {
          reminderId: reminder.id
        });
      } catch (error) {
        logger.error("Failed to dispatch reminder", {
          error,
          reminderId: reminder.id
        });
      }
    }
  } finally {
    client.release();
  }
}

module.exports = {
  createUserReminder,
  dispatchDueReminders,
  listUserReminders,
  setReminderActive
};
