async function createReminder(client, reminder) {
  const { rows } = await client.query(
    `
      INSERT INTO reminders (
        discord_user_id,
        discord_guild_id,
        target_channel_id,
        title,
        message,
        schedule_type,
        schedule_time,
        schedule_date,
        schedule_days,
        timezone,
        delivery_modes,
        next_run_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::SMALLINT[], $10, $11::TEXT[], $12)
      RETURNING *
    `,
    [
      reminder.userId,
      reminder.guildId || null,
      reminder.targetChannelId || null,
      reminder.title,
      reminder.message,
      reminder.scheduleType,
      reminder.scheduleTime,
      reminder.scheduleDate || null,
      reminder.scheduleDays || [],
      reminder.timezone,
      reminder.deliveryModes,
      reminder.nextRunAt
    ]
  );

  return rows[0];
}

async function listRemindersByUser(client, userId) {
  const { rows } = await client.query(
    `
      SELECT *
      FROM reminders
      WHERE discord_user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
}

async function updateReminderStatus(client, reminderId, fields) {
  const { rows } = await client.query(
    `
      UPDATE reminders
      SET active = COALESCE($2, active),
          next_run_at = $3,
          last_sent_at = COALESCE($4, last_sent_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      reminderId,
      typeof fields.active === "boolean" ? fields.active : null,
      fields.nextRunAt || null,
      fields.lastSentAt || null
    ]
  );

  return rows[0] || null;
}

async function toggleReminder(client, reminderId, userId, active) {
  const { rows } = await client.query(
    `
      UPDATE reminders
      SET active = $3,
          updated_at = NOW()
      WHERE id = $1
        AND discord_user_id = $2
      RETURNING *
    `,
    [reminderId, userId, active]
  );

  return rows[0] || null;
}

async function findDueReminders(client, limit = 100) {
  const { rows } = await client.query(
    `
      SELECT *
      FROM reminders
      WHERE active = TRUE
        AND next_run_at IS NOT NULL
        AND next_run_at <= NOW()
      ORDER BY next_run_at ASC
      LIMIT $1
    `,
    [limit]
  );

  return rows;
}

module.exports = {
  createReminder,
  findDueReminders,
  listRemindersByUser,
  toggleReminder,
  updateReminderStatus
};
