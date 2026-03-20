const {
  createUserReminder,
  listUserReminders,
  setReminderActive
} = require("../services/reminder.service");

async function listReminders(req, res) {
  const reminders = await listUserReminders(req.auth.userId);
  res.json({ reminders });
}

async function createReminder(req, res) {
  const reminder = await createUserReminder(req.auth.userId, req.validated);
  res.status(201).json({ reminder });
}

async function toggleReminder(req, res) {
  const reminder = await setReminderActive(
    req.auth.userId,
    Number(req.params.reminderId),
    req.validated.active
  );

  res.json({ reminder });
}

module.exports = {
  createReminder,
  listReminders,
  toggleReminder
};
