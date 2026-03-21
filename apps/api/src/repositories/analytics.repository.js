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
        SELECT
          discord_channel_id,
          COALESCE(MAX(metadata->>'channelName'), discord_channel_id) AS channel_name,
          COUNT(*)::INTEGER AS activity_count
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
        top_channel.channel_name AS most_active_channel_name,
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
        COALESCE(MAX(metadata->>'channelName'), discord_channel_id) AS channel_name,
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

async function getRecentMessages(client, userId, limit = 20) {
  const { rows } = await client.query(
    `
      SELECT
        occurred_at,
        discord_channel_id AS channel_id,
        COALESCE(metadata->>'channelName', discord_channel_id) AS channel_name,
        metadata->>'content' AS content,
        metadata->'attachments' AS attachments,
        metadata->'embeds' AS embeds
      FROM events
      WHERE discord_user_id = $1
        AND type = 'message'
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return rows;
}

async function getRecentVoiceSessions(client, userId, limit = 20) {
  const { rows } = await client.query(
    `
      SELECT
        vs.start_time,
        vs.end_time,
        CASE
          WHEN vs.end_time IS NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - vs.start_time)))::INTEGER
          ELSE COALESCE(vs.duration_seconds, 0)::INTEGER
        END AS duration_seconds,
        vs.closed_reason,
        vs.discord_channel_id AS channel_id,
        COALESCE(voice_event.metadata->>'channelName', vs.discord_channel_id) AS channel_name
      FROM voice_sessions vs
      LEFT JOIN LATERAL (
        SELECT e.metadata
        FROM events e
        WHERE e.discord_user_id = vs.discord_user_id
          AND e.discord_guild_id = vs.discord_guild_id
          AND e.discord_channel_id = vs.discord_channel_id
          AND e.type IN ('voice_join', 'voice_switch', 'voice_leave')
        ORDER BY ABS(EXTRACT(EPOCH FROM (e.occurred_at - vs.start_time))) ASC, e.id DESC
        LIMIT 1
      ) voice_event ON TRUE
      WHERE vs.discord_user_id = $1
      ORDER BY start_time DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return rows;
}

function resolvePeriodWindow(period) {
  switch (period) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
    default:
      return null;
  }
}

async function getGuildScopedSummary(client, userId, guildId, period) {
  const dayWindow = resolvePeriodWindow(period);
  const params = [userId, guildId];

  const eventWindowClause = dayWindow === null
    ? ""
    : `AND occurred_at >= NOW() - ($3 || ' days')::INTERVAL`;
  const voiceWindowClause = dayWindow === null
    ? ""
    : `AND COALESCE(end_time, NOW()) > NOW() - ($3 || ' days')::INTERVAL`;

  if (dayWindow !== null) {
    params.push(String(dayWindow));
  }

  const { rows } = await client.query(
    `
      WITH message_totals AS (
        SELECT COUNT(*)::INTEGER AS total_messages
        FROM events
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          AND type = 'message'
          ${eventWindowClause}
      ),
      voice_totals AS (
        SELECT
          COALESCE(SUM(
            GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(COALESCE(end_time, NOW()), NOW()) -
                GREATEST(
                  start_time,
                  ${dayWindow === null ? "start_time" : "NOW() - ($3 || ' days')::INTERVAL"}
                )
              ))
            )
          ), 0)::INTEGER AS total_voice_seconds
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          ${voiceWindowClause}
      ),
      top_channel AS (
        SELECT
          discord_channel_id,
          COALESCE(MAX(metadata->>'channelName'), discord_channel_id) AS channel_name,
          COUNT(*)::INTEGER AS message_count
        FROM events
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          AND type = 'message'
          ${eventWindowClause}
        GROUP BY discord_channel_id
        ORDER BY message_count DESC
        LIMIT 1
      ),
      first_message AS (
        SELECT MIN(occurred_at) AS first_message_at
        FROM events
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          ${eventWindowClause}
      ),
      last_message AS (
        SELECT MAX(occurred_at) AS last_message_at
        FROM events
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          ${eventWindowClause}
      ),
      first_voice AS (
        SELECT MIN(start_time) AS first_voice_at
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          ${voiceWindowClause}
      ),
      last_voice AS (
        SELECT MAX(COALESCE(end_time, start_time)) AS last_voice_at
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND discord_guild_id = $2
          ${voiceWindowClause}
      )
      SELECT
        message_totals.total_messages,
        voice_totals.total_voice_seconds,
        top_channel.discord_channel_id AS most_active_channel_id,
        top_channel.channel_name AS most_active_channel_name,
        COALESCE(top_channel.message_count, 0)::INTEGER AS most_active_channel_count,
        first_message.first_message_at,
        last_message.last_message_at,
        first_voice.first_voice_at,
        last_voice.last_voice_at
      FROM message_totals, voice_totals, first_message, last_message, first_voice, last_voice
      LEFT JOIN top_channel ON TRUE
    `,
    params
  );

  return rows[0] || null;
}

module.exports = {
  getChannelDistribution,
  getCoverage,
  getDailyTrend,
  getGuildScopedSummary,
  getHeatmap,
  getRecentMessages,
  getRecentVoiceSessions,
  getSummaryTotals
};
