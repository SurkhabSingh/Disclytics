async function getCoverage(client, userId) {
  const { rows } = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS accessible_guilds,
        COUNT(*) FILTER (WHERE g.bot_present = TRUE)::INTEGER AS tracked_guilds
      FROM user_guilds ug
      JOIN guilds g
        ON g.discord_guild_id = ug.discord_guild_id
      WHERE ug.discord_user_id = $1
    `,
    [userId]
  );

  const row = rows[0] || { accessible_guilds: 0, tracked_guilds: 0 };
  const accessibleGuilds = Number(row.accessible_guilds || 0);
  const trackedGuilds = Number(row.tracked_guilds || 0);

  return {
    accessibleGuilds,
    trackedGuilds,
    percent: accessibleGuilds === 0 ? 0 : Math.round((trackedGuilds / accessibleGuilds) * 100)
  };
}

async function getSummaryTotals(client, userId, days) {
  const { rows } = await client.query(
    `
      WITH message_totals AS (
        SELECT COUNT(*)::INTEGER AS total_messages
        FROM events
        WHERE discord_user_id = $1
          AND type = 'message'
          AND occurred_at >= NOW() - ($2 || ' days')::INTERVAL
      ),
      voice_totals AS (
        SELECT
          COALESCE(SUM(
            GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(COALESCE(end_time, NOW()), NOW()) -
                GREATEST(start_time, NOW() - ($2 || ' days')::INTERVAL)
              ))
            )
          ), 0)::INTEGER AS total_voice_seconds
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND start_time < NOW()
          AND COALESCE(end_time, NOW()) > NOW() - ($2 || ' days')::INTERVAL
      ),
      top_channel AS (
        SELECT discord_channel_id, COUNT(*)::INTEGER AS activity_count
        FROM events
        WHERE discord_user_id = $1
          AND occurred_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY discord_channel_id
        ORDER BY activity_count DESC
        LIMIT 1
      )
      SELECT
        message_totals.total_messages,
        voice_totals.total_voice_seconds,
        top_channel.discord_channel_id AS most_active_channel_id,
        COALESCE(top_channel.activity_count, 0)::INTEGER AS most_active_channel_count
      FROM message_totals, voice_totals
      LEFT JOIN top_channel ON TRUE
    `,
    [userId, String(days)]
  );

  return rows[0];
}

async function getDailyTrend(client, userId, days) {
  const { rows } = await client.query(
    `
      WITH day_series AS (
        SELECT generate_series(
          CURRENT_DATE - ($2::INTEGER - 1),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::DATE AS stat_date
      ),
      messages AS (
        SELECT
          DATE(occurred_at) AS stat_date,
          COUNT(*)::INTEGER AS total_messages
        FROM events
        WHERE discord_user_id = $1
          AND type = 'message'
          AND occurred_at >= CURRENT_DATE - ($2::INTEGER - 1)
        GROUP BY DATE(occurred_at)
      ),
      voice AS (
        SELECT
          ds.stat_date,
          COALESCE(SUM(
            GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(
                  COALESCE(vs.end_time, ds.stat_date + INTERVAL '1 day'),
                  ds.stat_date + INTERVAL '1 day'
                ) -
                GREATEST(vs.start_time, ds.stat_date)
              ))
            )
          ), 0)::INTEGER AS total_voice_seconds
        FROM day_series ds
        LEFT JOIN voice_sessions vs
          ON vs.discord_user_id = $1
          AND vs.start_time < ds.stat_date + INTERVAL '1 day'
          AND COALESCE(vs.end_time, ds.stat_date + INTERVAL '1 day') > ds.stat_date
        GROUP BY ds.stat_date
      )
      SELECT
        ds.stat_date,
        COALESCE(messages.total_messages, 0)::INTEGER AS total_messages,
        COALESCE(voice.total_voice_seconds, 0)::INTEGER AS total_voice_seconds
      FROM day_series ds
      LEFT JOIN messages ON messages.stat_date = ds.stat_date
      LEFT JOIN voice ON voice.stat_date = ds.stat_date
      ORDER BY ds.stat_date ASC
    `,
    [userId, days]
  );

  return rows;
}

async function getChannelDistribution(client, userId, days) {
  const { rows } = await client.query(
    `
      SELECT
        discord_channel_id AS channel_id,
        COUNT(*)::INTEGER AS message_count
      FROM events
      WHERE discord_user_id = $1
        AND type = 'message'
        AND occurred_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY discord_channel_id
      ORDER BY message_count DESC
      LIMIT 8
    `,
    [userId, String(days)]
  );

  return rows;
}

async function getHeatmap(client, userId, days) {
  const { rows } = await client.query(
    `
      SELECT
        EXTRACT(DOW FROM occurred_at)::INTEGER AS day_of_week,
        EXTRACT(HOUR FROM occurred_at)::INTEGER AS hour_of_day,
        COUNT(*)::INTEGER AS event_count
      FROM events
      WHERE discord_user_id = $1
        AND occurred_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week ASC, hour_of_day ASC
    `,
    [userId, String(days)]
  );

  return rows;
}

module.exports = {
  getChannelDistribution,
  getCoverage,
  getDailyTrend,
  getHeatmap,
  getSummaryTotals
};
