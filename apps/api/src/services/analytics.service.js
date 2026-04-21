const { DateTime, IANAZone } = require("luxon");
const { pool } = require("../db/pool");
const {
  getAvailableActivityDates,
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
} = require("../repositories/analytics.repository");
const { getUserById, updateUserTimezone } = require("../repositories/user.repository");

const TIMEZONE_ALIASES = new Map([
  ["Asia/Calcutta", "Asia/Kolkata"]
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isoDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dateTime = DateTime.fromJSDate(new Date(value), { zone: "utc" });
  return dateTime.isValid ? dateTime.toISODate() : null;
}

function resolveAnalyticsTimezone(requestedTimezone, storedTimezone) {
  const normalizedRequestedTimezone = normalizeTimezoneId(requestedTimezone);
  const normalizedStoredTimezone = normalizeTimezoneId(storedTimezone);

  if (typeof normalizedRequestedTimezone === "string" && IANAZone.isValidZone(normalizedRequestedTimezone)) {
    return normalizedRequestedTimezone;
  }

  if (typeof normalizedStoredTimezone === "string" && IANAZone.isValidZone(normalizedStoredTimezone)) {
    return normalizedStoredTimezone;
  }

  return "UTC";
}

function normalizeTimezoneId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return TIMEZONE_ALIASES.get(trimmedValue) || trimmedValue;
}

async function resolveDatabaseTimezone(client, requestedTimezone, storedTimezone) {
  const candidateTimezones = [
    resolveAnalyticsTimezone(requestedTimezone, storedTimezone),
    resolveAnalyticsTimezone(null, storedTimezone),
    "UTC"
  ].filter((timezone, index, values) => timezone && values.indexOf(timezone) === index);

  for (const timezone of candidateTimezones) {
    try {
      await client.query("SELECT NOW() AT TIME ZONE $1 AS local_time", [timezone]);
      return timezone;
    } catch {
      continue;
    }
  }

  return "UTC";
}

function getDayWindow(dateValue, timezone) {
  const dayStart = DateTime.fromISO(dateValue, { zone: timezone }).startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });

  return {
    startAt: dayStart.toUTC().toISO(),
    endAt: dayEnd.toUTC().toISO()
  };
}

function pickSelectedDate(requestedDate, availableDates, fallbackDate) {
  if (requestedDate && availableDates.includes(requestedDate)) {
    return requestedDate;
  }

  if (availableDates.length) {
    return availableDates[0];
  }

  return fallbackDate;
}

function mapSummary(summary) {
  return {
    totalMessages: Number(summary?.total_messages || 0),
    totalVoiceSeconds: Number(summary?.total_voice_seconds || 0),
    mostActiveChannelId: summary?.most_active_channel_id || null,
    mostActiveChannelName: summary?.most_active_channel_name || null,
    mostActiveChannelCount: Number(summary?.most_active_channel_count || 0)
  };
}

function mapChatLeaderboard(rows) {
  return rows.map((row) => ({
    channelId: row.channel_id,
    channelName: row.channel_name,
    messageCount: Number(row.message_count || 0)
  }));
}

function mapVoiceLeaderboard(rows) {
  return rows.map((row) => ({
    channelId: row.channel_id,
    channelName: row.channel_name,
    totalVoiceSeconds: Number(row.total_voice_seconds || 0)
  }));
}

function mapMessageMedia(row) {
  const media = [];
  const seen = new Set();

  for (const attachment of asArray(row.attachments)) {
    const url = attachment?.proxyUrl || attachment?.url || null;
    const contentType = attachment?.contentType || "";
    const isImage = contentType.startsWith("image/") || /\.(gif|png|jpe?g|webp)$/i.test(url || "");
    const isVideo = contentType.startsWith("video/");

    if (!url || (!isImage && !isVideo) || seen.has(url)) {
      continue;
    }

    seen.add(url);
    media.push({
      url,
      kind: isVideo ? "video" : (/\.gif($|\?)/i.test(url) ? "gif" : "image"),
      label: attachment?.name || null
    });
  }

  for (const embed of asArray(row.embeds)) {
    const url = embed?.imageUrl || embed?.url || null;

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    media.push({
      url,
      kind: embed?.type === "gifv" || /\.gif($|\?)/i.test(url) ? "gif" : "image",
      label: embed?.title || null
    });
  }

  return media;
}

function mapMessages(rows) {
  return rows.map((row) => ({
    channelId: row.channel_id,
    channelName: row.channel_name,
    content: row.content || null,
    media: mapMessageMedia(row),
    occurredAt: row.occurred_at
  }));
}

function mapVoiceSessions(rows) {
  return rows.map((row) => ({
    channelId: row.channel_id,
    channelName: row.channel_name,
    startTime: row.start_time,
    endTime: row.end_time,
    durationSeconds: Number(row.duration_seconds || 0),
    closedReason: row.closed_reason || null
  }));
}

function mapTrendRows(rows) {
  return rows.map((row) => ({
    date: isoDate(row.stat_date),
    totalMessages: Number(row.total_messages || 0),
    totalVoiceSeconds: Number(row.total_voice_seconds || 0)
  }));
}

function mapHourlyBreakdown(rows) {
  return rows.map((row) => ({
    hourOfDay: Number(row.hour_of_day),
    totalMessages: Number(row.total_messages || 0),
    totalVoiceSeconds: Number(row.total_voice_seconds || 0)
  }));
}

function mapHeatmap(rows) {
  return rows.map((row) => ({
    dayOfWeek: Number(row.day_of_week),
    hourOfDay: Number(row.hour_of_day),
    eventCount: Number(row.event_count)
  }));
}

async function getAnalyticsContext(client, userId, requestedDate, requestedTimezone) {
  const user = await getUserById(client, userId);
  const analyticsTimezone = await resolveDatabaseTimezone(client, requestedTimezone, user?.timezone);

  if (user && user.timezone !== analyticsTimezone) {
    await updateUserTimezone(client, userId, analyticsTimezone);
  }

  const now = DateTime.now().setZone(analyticsTimezone);
  const today = now.toISODate();
  const trackedBounds = await getTrackedDateBounds(client, userId, analyticsTimezone);
  const trackedStartDate = isoDate(trackedBounds.first_activity_date);
  const lastActivityDate = isoDate(trackedBounds.last_activity_date);
  const availableDateRows = await getAvailableActivityDates(client, userId, analyticsTimezone);
  const availableDates = availableDateRows
    .map((row) => isoDate(row.activity_date))
    .filter(Boolean);
  const selectedDate = pickSelectedDate(requestedDate, availableDates, lastActivityDate || today);

  return {
    analyticsTimezone,
    availableDates,
    lastActivityDate,
    now,
    selectedDate,
    today,
    trackedRange: {
      firstActivityDate: trackedStartDate,
      lastActivityDate
    }
  };
}

async function getTodayScope(client, userId, dateValue, timezone) {
  const dayWindow = getDayWindow(dateValue, timezone);
  const [summary, chatChannels, voiceChannels, hourlyBreakdownRows, recentMessages, recentVoiceSessions, voiceSessionsForChart] = await Promise.all([
    getScopedSummary(client, userId, dayWindow.startAt, dayWindow.endAt),
    getTopChatChannels(client, userId, dayWindow.startAt, dayWindow.endAt, 8),
    getTopVoiceChannels(client, userId, dayWindow.startAt, dayWindow.endAt, 8),
    getHourlyBreakdown(client, userId, dateValue, timezone),
    getRecentMessages(client, userId, {
      endAt: dayWindow.endAt,
      limit: 20,
      startAt: dayWindow.startAt
    }),
    getRecentVoiceSessions(client, userId, {
      endAt: dayWindow.endAt,
      limit: 20,
      startAt: dayWindow.startAt
    }),
    getRecentVoiceSessions(client, userId, {
      endAt: dayWindow.endAt,
      limit: 250,
      startAt: dayWindow.startAt
    })
  ]);

  return {
    date: dateValue,
    summary: mapSummary(summary),
    hourlyBreakdown: mapHourlyBreakdown(hourlyBreakdownRows),
    leaderboards: {
      chatChannels: mapChatLeaderboard(chatChannels),
      voiceChannels: mapVoiceLeaderboard(voiceChannels)
    },
    recentMessages: mapMessages(recentMessages),
    recentVoiceSessions: mapVoiceSessions(recentVoiceSessions),
    voiceSessionsForChart: mapVoiceSessions(voiceSessionsForChart)
  };
}

async function getHistoryScope(client, userId, selectedDate, timezone) {
  return getTodayScope(client, userId, selectedDate, timezone);
}

async function getLifetimeScope(client, userId, trackedStartDate, today, timezone, nowUtcIso) {
  const lifetimeStartAt = getDayWindow(trackedStartDate || today, timezone).startAt;
  const lifetimeEndAt = nowUtcIso;
  const [summary, trendRows, chatChannels, voiceChannels, heatmapRows, recentMessages, recentVoiceSessions] = await Promise.all([
    getScopedSummary(client, userId, lifetimeStartAt, lifetimeEndAt),
    getLifetimeTrend(client, userId, trackedStartDate, today, timezone),
    getTopChatChannels(client, userId, lifetimeStartAt, lifetimeEndAt, 8),
    getTopVoiceChannels(client, userId, lifetimeStartAt, lifetimeEndAt, 8),
    getHeatmap(client, userId, lifetimeStartAt, lifetimeEndAt, timezone),
    getRecentMessages(client, userId, { limit: 20 }),
    getRecentVoiceSessions(client, userId, { limit: 20 })
  ]);

  return {
    heatmap: mapHeatmap(heatmapRows),
    scope: {
      summary: mapSummary(summary),
      trend: mapTrendRows(trendRows),
      leaderboards: {
        chatChannels: mapChatLeaderboard(chatChannels),
        voiceChannels: mapVoiceLeaderboard(voiceChannels)
      },
      recentMessages: mapMessages(recentMessages),
      recentVoiceSessions: mapVoiceSessions(recentVoiceSessions)
    }
  };
}

async function getDashboardOverview(userId, requestedDate, requestedTimezone) {
  const client = await pool.connect();

  try {
    const context = await getAnalyticsContext(client, userId, requestedDate, requestedTimezone);
    const coverage = await getCoverage(client, userId);
    const todayScope = await getTodayScope(client, userId, context.today, context.analyticsTimezone);

    return {
      availableDates: context.availableDates,
      coverage,
      selectedDate: context.selectedDate,
      timezone: context.analyticsTimezone,
      todayDate: context.today,
      trackedRange: context.trackedRange,
      scopes: {
        today: todayScope
      }
    };
  } finally {
    client.release();
  }
}

async function getHistoryAnalytics(userId, requestedDate, requestedTimezone) {
  const client = await pool.connect();

  try {
    const context = await getAnalyticsContext(client, userId, requestedDate, requestedTimezone);
    const historyScope = await getHistoryScope(
      client,
      userId,
      context.selectedDate,
      context.analyticsTimezone
    );

    return {
      availableDates: context.availableDates,
      selectedDate: context.selectedDate,
      timezone: context.analyticsTimezone,
      todayDate: context.today,
      trackedRange: context.trackedRange,
      scopes: {
        history: historyScope
      }
    };
  } finally {
    client.release();
  }
}

async function getLifetimeAnalytics(userId, requestedTimezone) {
  const client = await pool.connect();

  try {
    const context = await getAnalyticsContext(client, userId, null, requestedTimezone);
    const lifetime = await getLifetimeScope(
      client,
      userId,
      context.trackedRange.firstActivityDate,
      context.today,
      context.analyticsTimezone,
      context.now.toUTC().toISO()
    );

    return {
      heatmap: lifetime.heatmap,
      timezone: context.analyticsTimezone,
      todayDate: context.today,
      trackedRange: context.trackedRange,
      scopes: {
        lifetime: lifetime.scope
      }
    };
  } finally {
    client.release();
  }
}

async function getDashboardAnalytics(userId, requestedDate, requestedTimezone) {
  const [overview, history, lifetime] = await Promise.all([
    getDashboardOverview(userId, requestedDate, requestedTimezone),
    getHistoryAnalytics(userId, requestedDate, requestedTimezone),
    getLifetimeAnalytics(userId, requestedTimezone)
  ]);

  return {
    availableDates: overview.availableDates,
    coverage: overview.coverage,
    heatmap: lifetime.heatmap,
    scopes: {
      history: history.scopes.history,
      lifetime: lifetime.scopes.lifetime,
      today: overview.scopes.today
    },
    selectedDate: history.selectedDate,
    timezone: overview.timezone,
    todayDate: overview.todayDate,
    trackedRange: overview.trackedRange
  };
}

function minTimestamp(...values) {
  const validValues = values.filter(Boolean).map((value) => new Date(value).getTime());

  if (!validValues.length) {
    return null;
  }

  return new Date(Math.min(...validValues)).toISOString();
}

function maxTimestamp(...values) {
  const validValues = values.filter(Boolean).map((value) => new Date(value).getTime());

  if (!validValues.length) {
    return null;
  }

  return new Date(Math.max(...validValues)).toISOString();
}

module.exports = {
  getDashboardOverview,
  getDashboardAnalytics,
  getHistoryAnalytics,
  async getGuildStatsSummary(userId, guildId, period) {
    const client = await pool.connect();

    try {
      const summary = await getGuildScopedSummary(client, userId, guildId, period);

      return {
        guildId,
        period,
        summary: {
          totalMessages: Number(summary?.total_messages || 0),
          totalVoiceSeconds: Number(summary?.total_voice_seconds || 0),
          mostActiveChannelId: summary?.most_active_channel_id || null,
          mostActiveChannelName: summary?.most_active_channel_name || null,
          mostActiveChannelCount: Number(summary?.most_active_channel_count || 0),
          firstActivityAt: minTimestamp(summary?.first_message_at, summary?.first_voice_at),
          lastActivityAt: maxTimestamp(summary?.last_message_at, summary?.last_voice_at)
        }
      };
    } finally {
      client.release();
    }
  },
  getLifetimeAnalytics
};
