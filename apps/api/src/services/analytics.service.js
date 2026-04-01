const { pool } = require("../db/pool");
const {
  getCoverage,
  getGuildScopedSummary,
  getHeatmap,
  getHourlyBreakdown,
  getLifetimeTrend,
  getPeerLifetimeEngagement,
  getPeerRecentDailyEngagement,
  getRecentMessages,
  getRecentVoiceSessions,
  getScopedSummary,
  getTopChatChannels,
  getTopVoiceChannels,
  getTrackedDateBounds
} = require("../repositories/analytics.repository");
const { getUserById } = require("../repositories/user.repository");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isoDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function startOfDayUtc(dateValue) {
  return `${dateValue}T00:00:00.000Z`;
}

function nextDayUtc(dateValue) {
  const start = new Date(startOfDayUtc(dateValue));
  start.setUTCDate(start.getUTCDate() + 1);
  return start.toISOString();
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

function mapLifetimePeerRows(rows, currentUserId) {
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name || row.user_id,
    totalMessages: Number(row.total_messages || 0),
    totalVoiceSeconds: Number(row.total_voice_seconds || 0),
    isCurrentUser: row.user_id === currentUserId
  }));
}

function mapDailyPeerRows(rows, currentUserId) {
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name || row.user_id,
    avgMessagesPerDay: Number(row.avg_messages_per_day || 0),
    avgVoiceSecondsPerDay: Number(row.avg_voice_seconds_per_day || 0),
    recentTotalMessages: Number(row.recent_total_messages || 0),
    recentTotalVoiceSeconds: Number(row.recent_total_voice_seconds || 0),
    isCurrentUser: row.user_id === currentUserId
  }));
}

async function getDashboardAnalytics(userId, requestedDate) {
  const client = await pool.connect();

  try {
    const user = await getUserById(client, userId);
    const coverage = await getCoverage(client, userId);
    const trackedBounds = await getTrackedDateBounds(client, userId);

    const trackedStartDate = isoDate(trackedBounds.first_activity_date);
    const lastActivityDate = isoDate(trackedBounds.last_activity_date);
    const today = new Date().toISOString().slice(0, 10);
    const lifetimeTrendRows = await getLifetimeTrend(client, userId, trackedStartDate);
    const lifetimeTrend = mapTrendRows(lifetimeTrendRows);
    const availableDates = lifetimeTrend
      .filter((row) => row.totalMessages > 0 || row.totalVoiceSeconds > 0)
      .map((row) => row.date)
      .reverse();
    const selectedDate = pickSelectedDate(requestedDate, availableDates, lastActivityDate || today);
    const lifetimeStartAt = startOfDayUtc(trackedStartDate || today);
    const lifetimeEndAt = new Date().toISOString();
    const todayStartAt = startOfDayUtc(today);
    const todayEndAt = new Date().toISOString();
    const selectedDayStartAt = startOfDayUtc(selectedDate);
    const selectedDayEndAt = nextDayUtc(selectedDate);

    const lifetimeSummary = await getScopedSummary(client, userId, lifetimeStartAt, lifetimeEndAt);
    const todaySummary = await getScopedSummary(client, userId, todayStartAt, todayEndAt);
    const historySummary = await getScopedSummary(client, userId, selectedDayStartAt, selectedDayEndAt);
    const lifetimeChatChannels = await getTopChatChannels(client, userId, lifetimeStartAt, lifetimeEndAt, 8);
    const todayChatChannels = await getTopChatChannels(client, userId, todayStartAt, todayEndAt, 8);
    const historyChatChannels = await getTopChatChannels(client, userId, selectedDayStartAt, selectedDayEndAt, 8);
    const lifetimeVoiceChannels = await getTopVoiceChannels(client, userId, lifetimeStartAt, lifetimeEndAt, 8);
    const todayVoiceChannels = await getTopVoiceChannels(client, userId, todayStartAt, todayEndAt, 8);
    const historyVoiceChannels = await getTopVoiceChannels(client, userId, selectedDayStartAt, selectedDayEndAt, 8);
    const heatmapRows = await getHeatmap(client, userId, lifetimeStartAt, lifetimeEndAt);
    const todayHourlyBreakdownRows = await getHourlyBreakdown(client, userId, today);
    const historyHourlyBreakdownRows = await getHourlyBreakdown(client, userId, selectedDate);
    const lifetimeRecentMessages = await getRecentMessages(client, userId, { limit: 20 });
    const todayRecentMessages = await getRecentMessages(client, userId, {
      endAt: todayEndAt,
      limit: 20,
      startAt: todayStartAt
    });
    const selectedDayRecentMessages = await getRecentMessages(client, userId, {
      endAt: selectedDayEndAt,
      limit: 20,
      startAt: selectedDayStartAt
    });
    const lifetimeRecentVoiceSessions = await getRecentVoiceSessions(client, userId, { limit: 20 });
    const todayRecentVoiceSessions = await getRecentVoiceSessions(client, userId, {
      endAt: todayEndAt,
      limit: 20,
      startAt: todayStartAt
    });
    const selectedDayRecentVoiceSessions = await getRecentVoiceSessions(client, userId, {
      endAt: selectedDayEndAt,
      limit: 20,
      startAt: selectedDayStartAt
    });
    const peerLifetimeEngagement = await getPeerLifetimeEngagement(client, userId);
    const peerRecentDailyEngagement = await getPeerRecentDailyEngagement(client, userId, 7);
    const trackedDayCount = lifetimeTrend.length;

    return {
      user,
      coverage,
      trackedRange: {
        firstActivityDate: trackedStartDate,
        lastActivityDate
      },
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
          recentVoiceSessions: mapVoiceSessions(todayRecentVoiceSessions)
        },
        lifetime: {
          summary: mapSummary(lifetimeSummary),
          trend: lifetimeTrend,
          comparison: {
            trackedDayCount,
            recentWindowDays: 7,
            peers: {
              lifetime: mapLifetimePeerRows(peerLifetimeEngagement, userId),
              daily: mapDailyPeerRows(peerRecentDailyEngagement, userId)
            }
          },
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
          recentVoiceSessions: mapVoiceSessions(selectedDayRecentVoiceSessions)
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
