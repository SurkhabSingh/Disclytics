const { getEffectiveVoiceEndSql } = require("../lib/voiceSessionSql");

const EFFECTIVE_VOICE_END = getEffectiveVoiceEndSql();
const EFFECTIVE_VOICE_END_VS = getEffectiveVoiceEndSql("vs");

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

async function getTrackedDateBounds(client, userId) {
  const { rows } = await client.query(
    `
      WITH message_bounds AS (
        SELECT
          MIN(DATE(occurred_at)) AS first_date,
          MAX(DATE(occurred_at)) AS last_date
        FROM events
        WHERE discord_user_id = $1
          AND type = 'message'
      ),
      voice_bounds AS (
        SELECT
          MIN(DATE(start_time)) AS first_date,
          MAX(DATE(${EFFECTIVE_VOICE_END})) AS last_date
        FROM voice_sessions
        WHERE discord_user_id = $1
      )
      SELECT
        CASE
          WHEN message_bounds.first_date IS NULL THEN voice_bounds.first_date
          WHEN voice_bounds.first_date IS NULL THEN message_bounds.first_date
          ELSE LEAST(message_bounds.first_date, voice_bounds.first_date)
        END AS first_activity_date,
        CASE
          WHEN message_bounds.last_date IS NULL THEN voice_bounds.last_date
          WHEN voice_bounds.last_date IS NULL THEN message_bounds.last_date
          ELSE GREATEST(message_bounds.last_date, voice_bounds.last_date)
        END AS last_activity_date
      FROM message_bounds, voice_bounds
    `,
    [userId]
  );

  return rows[0] || {
    first_activity_date: null,
    last_activity_date: null
  };
}

async function getLifetimeTrend(client, userId, startDate) {
  if (!startDate) {
    return [];
  }

  const { rows } = await client.query(
    `
      WITH day_series AS (
        SELECT generate_series(
          $2::DATE,
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
          AND occurred_at >= $2::DATE
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
                  LEAST(${EFFECTIVE_VOICE_END_VS}, ds.stat_date + INTERVAL '1 day'),
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
          AND LEAST(${EFFECTIVE_VOICE_END_VS}, ds.stat_date + INTERVAL '1 day') > ds.stat_date
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
    [userId, startDate]
  );

  return rows;
}

async function getScopedSummary(client, userId, startAt, endAt) {
  const { rows } = await client.query(
    `
      WITH message_totals AS (
        SELECT COUNT(*)::INTEGER AS total_messages
        FROM events
        WHERE discord_user_id = $1
          AND type = 'message'
          AND occurred_at >= $2::TIMESTAMPTZ
          AND occurred_at < $3::TIMESTAMPTZ
      ),
      voice_totals AS (
        SELECT
          COALESCE(SUM(
            GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(${EFFECTIVE_VOICE_END}, $3::TIMESTAMPTZ) -
                GREATEST(start_time, $2::TIMESTAMPTZ)
              ))
            )
          ), 0)::INTEGER AS total_voice_seconds
        FROM voice_sessions
        WHERE discord_user_id = $1
          AND start_time < $3::TIMESTAMPTZ
          AND LEAST(${EFFECTIVE_VOICE_END}, $3::TIMESTAMPTZ) > $2::TIMESTAMPTZ
      ),
      top_channel AS (
        SELECT
          discord_channel_id,
          COALESCE(MAX(metadata->>'channelName'), discord_channel_id) AS channel_name,
          COUNT(*)::INTEGER AS activity_count
        FROM events
        WHERE discord_user_id = $1
          AND type = 'message'
          AND occurred_at >= $2::TIMESTAMPTZ
          AND occurred_at < $3::TIMESTAMPTZ
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
    [userId, startAt, endAt]
  );

  return rows[0] || null;
}

async function getTopChatChannels(client, userId, startAt, endAt, limit = 8) {
  const { rows } = await client.query(
    `
      SELECT
        discord_channel_id AS channel_id,
        COALESCE(MAX(metadata->>'channelName'), discord_channel_id) AS channel_name,
        COUNT(*)::INTEGER AS message_count
      FROM events
      WHERE discord_user_id = $1
        AND type = 'message'
        AND occurred_at >= $2::TIMESTAMPTZ
        AND occurred_at < $3::TIMESTAMPTZ
      GROUP BY discord_channel_id
      ORDER BY message_count DESC, channel_name ASC
      LIMIT $4
    `,
    [userId, startAt, endAt, limit]
  );

  return rows;
}

async function getTopVoiceChannels(client, userId, startAt, endAt, limit = 8) {
  const { rows } = await client.query(
    `
      WITH channel_names AS (
        SELECT
          discord_channel_id,
          COALESCE(MAX(metadata->>'channelName'), discord_channel_id) AS channel_name
        FROM events
        WHERE discord_user_id = $1
          AND type IN ('voice_join', 'voice_leave', 'voice_switch')
        GROUP BY discord_channel_id
      )
      SELECT
        vs.discord_channel_id AS channel_id,
        COALESCE(channel_names.channel_name, vs.discord_channel_id) AS channel_name,
        COALESCE(SUM(
          GREATEST(
            0,
            EXTRACT(EPOCH FROM (
              LEAST(${EFFECTIVE_VOICE_END_VS}, $3::TIMESTAMPTZ) -
              GREATEST(vs.start_time, $2::TIMESTAMPTZ)
            ))
          )
        ), 0)::INTEGER AS total_voice_seconds
      FROM voice_sessions vs
      LEFT JOIN channel_names
        ON channel_names.discord_channel_id = vs.discord_channel_id
      WHERE vs.discord_user_id = $1
        AND vs.start_time < $3::TIMESTAMPTZ
        AND LEAST(${EFFECTIVE_VOICE_END_VS}, $3::TIMESTAMPTZ) > $2::TIMESTAMPTZ
      GROUP BY vs.discord_channel_id, channel_names.channel_name
      ORDER BY total_voice_seconds DESC, channel_name ASC
      LIMIT $4
    `,
    [userId, startAt, endAt, limit]
  );

  return rows;
}

async function getHeatmap(client, userId, startAt, endAt) {
  const { rows } = await client.query(
    `
      SELECT
        EXTRACT(DOW FROM occurred_at)::INTEGER AS day_of_week,
        EXTRACT(HOUR FROM occurred_at)::INTEGER AS hour_of_day,
        COUNT(*)::INTEGER AS event_count
      FROM events
      WHERE discord_user_id = $1
        AND occurred_at >= $2::TIMESTAMPTZ
        AND occurred_at < $3::TIMESTAMPTZ
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week ASC, hour_of_day ASC
    `,
    [userId, startAt, endAt]
  );

  return rows;
}

async function getHourlyBreakdown(client, userId, selectedDate) {
  const { rows } = await client.query(
    `
      WITH hour_series AS (
        SELECT
          generate_series(0, 23) AS hour_of_day
      ),
      hour_windows AS (
        SELECT
          hour_of_day,
          ($2::DATE + make_interval(hours => hour_of_day)) AS hour_start,
          ($2::DATE + make_interval(hours => hour_of_day + 1)) AS hour_end
        FROM hour_series
      ),
      messages AS (
        SELECT
          EXTRACT(HOUR FROM occurred_at)::INTEGER AS hour_of_day,
          COUNT(*)::INTEGER AS total_messages
        FROM events
        WHERE discord_user_id = $1
          AND type = 'message'
          AND occurred_at >= $2::DATE
          AND occurred_at < ($2::DATE + INTERVAL '1 day')
        GROUP BY EXTRACT(HOUR FROM occurred_at)
      ),
      voice AS (
        SELECT
          hw.hour_of_day,
          COALESCE(SUM(
            GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(${EFFECTIVE_VOICE_END_VS}, hw.hour_end) -
                GREATEST(vs.start_time, hw.hour_start)
              ))
            )
          ), 0)::INTEGER AS total_voice_seconds
        FROM hour_windows hw
        LEFT JOIN voice_sessions vs
          ON vs.discord_user_id = $1
          AND vs.start_time < hw.hour_end
          AND LEAST(${EFFECTIVE_VOICE_END_VS}, hw.hour_end) > hw.hour_start
        GROUP BY hw.hour_of_day
      )
      SELECT
        hw.hour_of_day,
        COALESCE(messages.total_messages, 0)::INTEGER AS total_messages,
        COALESCE(voice.total_voice_seconds, 0)::INTEGER AS total_voice_seconds
      FROM hour_windows hw
      LEFT JOIN messages ON messages.hour_of_day = hw.hour_of_day
      LEFT JOIN voice ON voice.hour_of_day = hw.hour_of_day
      ORDER BY hw.hour_of_day ASC
    `,
    [userId, selectedDate]
  );

  return rows;
}

async function getRecentMessages(client, userId, options = {}) {
  const {
    endAt = null,
    limit = 20,
    startAt = null
  } = options;

  const params = [userId];
  const filters = ["discord_user_id = $1", "type = 'message'"];

  if (startAt && endAt) {
    params.push(startAt, endAt);
    filters.push(`occurred_at >= $${params.length - 1}::TIMESTAMPTZ`);
    filters.push(`occurred_at < $${params.length}::TIMESTAMPTZ`);
  }

  params.push(limit);

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
      WHERE ${filters.join("\n        AND ")}
      ORDER BY occurred_at DESC
      LIMIT $${params.length}
    `,
    params
  );

  return rows;
}

async function getRecentVoiceSessions(client, userId, options = {}) {
  const {
    endAt = null,
    limit = 20,
    startAt = null
  } = options;

  const params = [userId];
  const filters = ["vs.discord_user_id = $1"];

  if (startAt && endAt) {
    params.push(startAt, endAt);
    filters.push(`vs.start_time < $${params.length}::TIMESTAMPTZ`);
    filters.push(`LEAST(${EFFECTIVE_VOICE_END_VS}, $${params.length}::TIMESTAMPTZ) > $${params.length - 1}::TIMESTAMPTZ`);
  }

  params.push(limit);

  const { rows } = await client.query(
    `
      SELECT
        vs.start_time,
        vs.end_time,
        CASE
          WHEN vs.end_time IS NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (${EFFECTIVE_VOICE_END_VS} - vs.start_time)))::INTEGER
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
      WHERE ${filters.join("\n        AND ")}
      ORDER BY vs.start_time DESC
      LIMIT $${params.length}
    `,
    params
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
    : `AND ${getEffectiveVoiceEndSql("", "NOW()")} > NOW() - ($3 || ' days')::INTERVAL`;

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
                LEAST(${getEffectiveVoiceEndSql("", "NOW()")}, NOW()) -
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
        SELECT MAX(${getEffectiveVoiceEndSql("", "NOW()")}) AS last_voice_at
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
  getCoverage,
  getGuildScopedSummary,
  getHeatmap,
  getHourlyBreakdown,
  getLifetimeTrend,
  getRecentMessages,
  getRecentVoiceSessions,
  getScopedSummary,
  getTopChatChannels,
  getTopVoiceChannels,
  getTrackedDateBounds
};
