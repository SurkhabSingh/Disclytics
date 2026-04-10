const { DateTime, IANAZone } = require("luxon");
const { pool } = require("../db/pool");
const {
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

async function getDashboardAnalytics(userId, requestedDate, requestedTimezone) {
  const client = await pool.connect();

  try {
    const user = await getUserById(client, userId);
    const analyticsTimezone = await resolveDatabaseTimezone(client, requestedTimezone, user?.timezone);

    if (user && user.timezone !== analyticsTimezone) {
      await updateUserTimezone(client, userId, analyticsTimezone);
    }

    const now = DateTime.now().setZone(analyticsTimezone);
    const today = now.toISODate();
    const coverage = await getCoverage(client, userId);
    const trackedBounds = await getTrackedDateBounds(client, userId, analyticsTimezone);

    const trackedStartDate = isoDate(trackedBounds.first_activity_date);
    const lastActivityDate = isoDate(trackedBounds.last_activity_date);
    const lifetimeTrendRows = await getLifetimeTrend(
      client,
      userId,
      trackedStartDate,
      today,
      analyticsTimezone
    );
    const lifetimeTrend = mapTrendRows(lifetimeTrendRows);
    const availableDates = lifetimeTrend
      .filter((row) => row.totalMessages > 0 || row.totalVoiceSeconds > 0)
      .map((row) => row.date)
      .reverse();
    const selectedDate = pickSelectedDate(requestedDate, availableDates, lastActivityDate || today);
    const lifetimeWindow = getDayWindow(trackedStartDate || today, analyticsTimezone);
    const todayWindow = getDayWindow(today, analyticsTimezone);
    const selectedDayWindow = getDayWindow(selectedDate, analyticsTimezone);
    const lifetimeStartAt = lifetimeWindow.startAt;
    const lifetimeEndAt = now.toUTC().toISO();
    const todayStartAt = todayWindow.startAt;
    const todayEndAt = todayWindow.endAt;
    const selectedDayStartAt = selectedDayWindow.startAt;
    const selectedDayEndAt = selectedDayWindow.endAt;
    const selectedDateIsToday = selectedDate === today;

    const lifetimeSummary = await getScopedSummary(client, userId, lifetimeStartAt, lifetimeEndAt);
    const todaySummary = await getScopedSummary(client, userId, todayStartAt, todayEndAt);
    const lifetimeChatChannels = await getTopChatChannels(client, userId, lifetimeStartAt, lifetimeEndAt, 8);
    const todayChatChannels = await getTopChatChannels(client, userId, todayStartAt, todayEndAt, 8);
    const lifetimeVoiceChannels = await getTopVoiceChannels(client, userId, lifetimeStartAt, lifetimeEndAt, 8);
    const todayVoiceChannels = await getTopVoiceChannels(client, userId, todayStartAt, todayEndAt, 8);
    const heatmapRows = await getHeatmap(client, userId, lifetimeStartAt, lifetimeEndAt, analyticsTimezone);
    const todayHourlyBreakdownRows = await getHourlyBreakdown(client, userId, today, analyticsTimezone);
    const lifetimeRecentMessages = await getRecentMessages(client, userId, { limit: 20 });
    const todayRecentMessages = await getRecentMessages(client, userId, {
      endAt: todayEndAt,
      limit: 20,
      startAt: todayStartAt
    });
    const lifetimeRecentVoiceSessions = await getRecentVoiceSessions(client, userId, { limit: 20 });
    const todayRecentVoiceSessions = await getRecentVoiceSessions(client, userId, {
      endAt: todayEndAt,
      limit: 20,
      startAt: todayStartAt
    });
    const todayVoiceSessionsForChart = await getRecentVoiceSessions(client, userId, {
      endAt: todayEndAt,
      limit: 250,
      startAt: todayStartAt
    });
    const historySummary = selectedDateIsToday
      ? todaySummary
      : await getScopedSummary(client, userId, selectedDayStartAt, selectedDayEndAt);
    const historyChatChannels = selectedDateIsToday
      ? todayChatChannels
      : await getTopChatChannels(client, userId, selectedDayStartAt, selectedDayEndAt, 8);
    const historyVoiceChannels = selectedDateIsToday
      ? todayVoiceChannels
      : await getTopVoiceChannels(client, userId, selectedDayStartAt, selectedDayEndAt, 8);
    const historyHourlyBreakdownRows = selectedDateIsToday
      ? todayHourlyBreakdownRows
      : await getHourlyBreakdown(client, userId, selectedDate, analyticsTimezone);
    const selectedDayRecentMessages = selectedDateIsToday
      ? todayRecentMessages
      : await getRecentMessages(client, userId, {
        endAt: selectedDayEndAt,
        limit: 20,
        startAt: selectedDayStartAt
      });
    const selectedDayRecentVoiceSessions = selectedDateIsToday
      ? todayRecentVoiceSessions
      : await getRecentVoiceSessions(client, userId, {
        endAt: selectedDayEndAt,
        limit: 20,
        startAt: selectedDayStartAt
      });
    const selectedDayVoiceSessionsForChart = selectedDateIsToday
      ? todayVoiceSessionsForChart
      : await getRecentVoiceSessions(client, userId, {
        endAt: selectedDayEndAt,
        limit: 250,
        startAt: selectedDayStartAt
      });

    return {
      coverage,
      trackedRange: {
        firstActivityDate: trackedStartDate,
        lastActivityDate
      },
      timezone: analyticsTimezone,
      selectedDate,
      todayDate: today,
      availableDates,
      scopes: {
        today: {
          date: today,
          summary: mapSummary(todaySummary),
          hourlyBreakdown: todayHourlyBreakdownRows.map((row) => ({
            hourOfDay: Number(row.hour_of_day),
            totalMessages: Number(row.total_messages || 0),
            totalVoiceSeconds: Number(row.total_voice_seconds || 0)
          })),
          leaderboards: {
            chatChannels: mapChatLeaderboard(todayChatChannels),
            voiceChannels: mapVoiceLeaderboard(todayVoiceChannels)
          },
          recentMessages: mapMessages(todayRecentMessages),
          recentVoiceSessions: mapVoiceSessions(todayRecentVoiceSessions),
          voiceSessionsForChart: mapVoiceSessions(todayVoiceSessionsForChart)
        },
        lifetime: {
          summary: mapSummary(lifetimeSummary),
          trend: lifetimeTrend,
          leaderboards: {
            chatChannels: mapChatLeaderboard(lifetimeChatChannels),
            voiceChannels: mapVoiceLeaderboard(lifetimeVoiceChannels)
          },
          recentMessages: mapMessages(lifetimeRecentMessages),
          recentVoiceSessions: mapVoiceSessions(lifetimeRecentVoiceSessions)
        },
        history: {
          date: selectedDate,
          summary: mapSummary(historySummary),
          hourlyBreakdown: historyHourlyBreakdownRows.map((row) => ({
            hourOfDay: Number(row.hour_of_day),
            totalMessages: Number(row.total_messages || 0),
            totalVoiceSeconds: Number(row.total_voice_seconds || 0)
          })),
          leaderboards: {
            chatChannels: mapChatLeaderboard(historyChatChannels),
            voiceChannels: mapVoiceLeaderboard(historyVoiceChannels)
          },
          recentMessages: mapMessages(selectedDayRecentMessages),
          recentVoiceSessions: mapVoiceSessions(selectedDayRecentVoiceSessions),
          voiceSessionsForChart: mapVoiceSessions(selectedDayVoiceSessionsForChart)
        }
      },
      heatmap: heatmapRows.map((row) => ({
        dayOfWeek: Number(row.day_of_week),
        hourOfDay: Number(row.hour_of_day),
        eventCount: Number(row.event_count)
      }))
    };
  } finally {
    client.release();
  }
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
  getDashboardAnalytics,
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
  }
};
