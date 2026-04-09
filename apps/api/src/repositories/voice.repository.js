async function startVoiceSession(client, session) {
  await client.query(
    `
      UPDATE voice_sessions
      SET end_time = $3,
          duration_seconds = GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM ($3 - start_time)))
          )::INTEGER,
          closed_reason = 'replaced',
          updated_at = NOW()
      WHERE discord_user_id = $1
        AND discord_guild_id = $2
        AND start_time < $3
        AND end_time IS NULL
    `,
    [session.userId, session.guildId, session.startTime]
  );

  const { rows } = await client.query(
    `
      INSERT INTO voice_sessions (
        discord_user_id,
        discord_guild_id,
        discord_channel_id,
        start_time
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (discord_user_id, discord_guild_id, start_time)
      DO UPDATE SET
        discord_channel_id = EXCLUDED.discord_channel_id,
        updated_at = NOW()
      RETURNING *
    `,
    [session.userId, session.guildId, session.channelId, session.startTime]
  );

  return rows[0];
}

async function stopActiveVoiceSession(client, session) {
  if (session.sessionStartTime) {
    const { rows: existingRows } = await client.query(
      `
        SELECT *
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          AND start_time = $3
        LIMIT 1
      `,
      [session.userId, session.guildId, session.sessionStartTime]
    );

    const existingSession = existingRows[0];

    if (!existingSession) {
      return null;
    }

    if (existingSession.end_time) {
      return existingSession;
    }

    const { rows } = await client.query(
      `
        UPDATE voice_sessions
        SET end_time = $4,
            duration_seconds = GREATEST(
              0,
              FLOOR(EXTRACT(EPOCH FROM ($4 - start_time)))
            )::INTEGER,
            closed_reason = COALESCE($5, 'leave'),
            updated_at = NOW()
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          AND start_time = $3
        RETURNING *
      `,
      [
        session.userId,
        session.guildId,
        session.sessionStartTime,
        session.endTime,
        session.reason || null
      ]
    );

    return rows[0] || null;
  }

  const { rows } = await client.query(
    `
      UPDATE voice_sessions
      SET end_time = $3,
          duration_seconds = GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM ($3 - start_time)))
          )::INTEGER,
          closed_reason = COALESCE($4, 'leave'),
          updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          AND end_time IS NULL
        ORDER BY start_time DESC
        LIMIT 1
      )
      RETURNING *
    `,
    [session.userId, session.guildId, session.endTime, session.reason || null]
  );

  return rows[0] || null;
}

async function touchActiveVoiceSession(client, session) {
  const { rows } = await client.query(
    `
      UPDATE voice_sessions
      SET updated_at = GREATEST(updated_at, $4::TIMESTAMPTZ)
      WHERE discord_user_id = $1
        AND discord_guild_id = $2
        AND discord_channel_id = $3
        AND end_time IS NULL
      RETURNING *
    `,
    [
      session.userId,
      session.guildId,
      session.channelId,
      session.observedAt
    ]
  );

  return rows[0] || null;
}

async function listActiveVoiceSessions(client) {
  const { rows } = await client.query(
    `
      SELECT *
      FROM voice_sessions
      WHERE end_time IS NULL
    `
  );

  return rows;
}

module.exports = {
  listActiveVoiceSessions,
  startVoiceSession,
  stopActiveVoiceSession,
  touchActiveVoiceSession
};
