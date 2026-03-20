const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeNextRunAt,
  getNextReminderState
} = require("../src/services/reminderSchedule.service");

test("computeNextRunAt schedules the next daily reminder for tomorrow when today's time passed", () => {
  const actual = computeNextRunAt(
    {
      scheduleType: "daily",
      scheduleTime: "09:30",
      timezone: "UTC"
    },
    require("luxon").DateTime.fromISO("2026-03-20T10:00:00", { zone: "UTC" })
  );

  assert.equal(actual, "2026-03-21T09:30:00.000Z");
});

test("computeNextRunAt schedules the next weekly reminder on the next selected weekday", () => {
  const actual = computeNextRunAt(
    {
      scheduleType: "weekly",
      scheduleTime: "18:00",
      scheduleDays: [1, 3],
      timezone: "UTC"
    },
    require("luxon").DateTime.fromISO("2026-03-20T10:00:00", { zone: "UTC" })
  );

  assert.equal(actual, "2026-03-23T18:00:00.000Z");
});

test("getNextReminderState deactivates one-time reminders after dispatch", () => {
  const state = getNextReminderState({
    schedule_type: "once",
    timezone: "UTC"
  });

  assert.equal(state.active, false);
  assert.equal(state.nextRunAt, null);
  assert.ok(state.lastSentAt);
});
