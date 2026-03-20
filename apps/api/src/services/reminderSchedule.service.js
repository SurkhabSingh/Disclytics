const { DateTime } = require("luxon");
const { REMINDER_SCHEDULE_TYPES } = require("@analytics-platform/shared");

const { AppError } = require("../lib/appError");

function parseScheduleDateTime({ scheduleDate, scheduleTime, timezone }) {
  const [hour, minute] = scheduleTime.split(":").map((value) => Number(value));
  const date = scheduleDate || DateTime.now().setZone(timezone).toISODate();
  return DateTime.fromISO(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    { zone: timezone }
  );
}

function computeNextRunAt(input, now = DateTime.now().setZone(input.timezone)) {
  const baseDateTime = parseScheduleDateTime(input);

  if (input.scheduleType === REMINDER_SCHEDULE_TYPES.ONCE) {
    if (!input.scheduleDate) {
      throw new AppError("scheduleDate is required for one-time reminders", 400);
    }

    if (baseDateTime <= now) {
      throw new AppError("Reminder must be scheduled in the future", 400);
    }

    return baseDateTime.toUTC().toISO();
  }

  if (input.scheduleType === REMINDER_SCHEDULE_TYPES.DAILY) {
    const todayRun = now.set({
      hour: baseDateTime.hour,
      minute: baseDateTime.minute,
      second: 0,
      millisecond: 0
    });
    const nextRun = todayRun > now ? todayRun : todayRun.plus({ days: 1 });
    return nextRun.toUTC().toISO();
  }

  if (input.scheduleType === REMINDER_SCHEDULE_TYPES.WEEKLY) {
    if (!input.scheduleDays || !input.scheduleDays.length) {
      throw new AppError("scheduleDays is required for weekly reminders", 400);
    }

    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = now.plus({ days: offset }).set({
        hour: baseDateTime.hour,
        minute: baseDateTime.minute,
        second: 0,
        millisecond: 0
      });
      const candidateDay = candidate.weekday % 7;

      if (input.scheduleDays.includes(candidateDay) && candidate > now) {
        return candidate.toUTC().toISO();
      }
    }
  }

  throw new AppError("Unable to compute next reminder run", 400);
}

function getNextReminderState(reminder) {
  const now = DateTime.now().setZone(reminder.timezone);

  if (reminder.schedule_type === REMINDER_SCHEDULE_TYPES.ONCE) {
    return {
      active: false,
      nextRunAt: null,
      lastSentAt: now.toUTC().toISO()
    };
  }

  return {
    active: true,
    nextRunAt: computeNextRunAt(
      {
        scheduleType: reminder.schedule_type,
        scheduleDate: reminder.schedule_date,
        scheduleTime: reminder.schedule_time.slice(0, 5),
        scheduleDays: reminder.schedule_days || [],
        timezone: reminder.timezone
      },
      now.plus({ minutes: 1 })
    ),
    lastSentAt: now.toUTC().toISO()
  };
}

module.exports = {
  computeNextRunAt,
  getNextReminderState,
  parseScheduleDateTime
};
