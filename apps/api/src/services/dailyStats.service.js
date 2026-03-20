const { pool } = require("../db/pool");

async function refreshDailyStatsForDate(statDate) {
  const client = await pool.connect();

  try {
    await client.query(
      `
        DELETE FROM daily_stats
        WHERE stat_date = $1::DATE
      `,
      [statDate]
    );

    await client.query(
      `
        WITH day_window AS (
          SELECT
            $1::DATE AS day_start,
            ($1::DATE + INTERVAL '1 day') AS day_end
        ),
        messages AS (
          SELECT
            discord_user_id,
            discord_guild_id,
            COUNT(*)::INTEGER AS total_messages,
            COALESCE(JSONB_OBJECT_AGG(discord_channel_id, channel_count), '{}'::JSONB) AS active_channels
          FROM (
            SELECT
              discord_user_id,
              discord_guild_id,
              discord_channel_id,
              COUNT(*)::INTEGER AS channel_count
            FROM events, day_window
            WHERE type = 'message'
              AND occurred_at >= day_window.day_start
              AND occurred_at < day_window.day_end
            GROUP BY discord_user_id, discord_guild_id, discord_channel_id
          ) grouped_messages
          GROUP BY discord_user_id, discord_guild_id
        ),
        voice AS (
          SELECT
            discord_user_id,
            discord_guild_id,
            COALESCE(SUM(
              GREATEST(
                0,
                EXTRACT(EPOCH FROM (
                  LEAST(COALESCE(end_time, day_window.day_end), day_window.day_end) -
                  GREATEST(start_time, day_window.day_start)
                ))
              )
            ), 0)::INTEGER AS total_voice_seconds
          FROM voice_sessions, day_window
          WHERE start_time < day_window.day_end
            AND COALESCE(end_time, day_window.day_end) > day_window.day_start
          GROUP BY discord_user_id, discord_guild_id
        )
        INSERT INTO daily_stats (
          discord_user_id,
          discord_guild_id,
          stat_date,
          total_voice_seconds,
          total_messages,
          active_channels,
          updated_at
        )
        SELECT
          COALESCE(messages.discord_user_id, voice.discord_user_id),
          COALESCE(messages.discord_guild_id, voice.discord_guild_id),
          $1::DATE,
          COALESCE(voice.total_voice_seconds, 0),
          COALESCE(messages.total_messages, 0),
          COALESCE(messages.active_channels, '{}'::JSONB),
          NOW()
        FROM messages
        FULL OUTER JOIN voice
          ON voice.discord_user_id = messages.discord_user_id
         AND voice.discord_guild_id = messages.discord_guild_id
      `,
      [statDate]
    );
  } finally {
    client.release();
  }
}

async function refreshRollingDailyStats() {
  const toIsoDate = (value) => value.toISOString().slice(0, 10);
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await refreshDailyStatsForDate(toIsoDate(yesterday));
  await refreshDailyStatsForDate(toIsoDate(today));
}

module.exports = {
  refreshDailyStatsForDate,
  refreshRollingDailyStats
};
