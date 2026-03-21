const { pool } = require("../db/pool");
const {
  getChannelDistribution,
  getCoverage,
  getDailyTrend,
  getGuildScopedSummary,
  getHeatmap,
  getRecentMessages,
  getRecentVoiceSessions,
  getSummaryTotals
} = require("../repositories/analytics.repository");
const { getUserById } = require("../repositories/user.repository");

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

async function getDashboardAnalytics(userId, days) {
  const client = await pool.connect();

  try {
    const [user, coverage, totals, trend, channelDistribution, heatmap, recentMessages, recentVoiceSessions] = await Promise.all([
      getUserById(client, userId),
      getCoverage(client, userId),
      getSummaryTotals(client, userId, days),
      getDailyTrend(client, userId, days),
      getChannelDistribution(client, userId, days),
      getHeatmap(client, userId, days),
      getRecentMessages(client, userId, 20),
      getRecentVoiceSessions(client, userId, 20)
    ]);

    return {
      user,
      coverage,
      summary: {
        totalMessages: Number(totals.total_messages || 0),
        totalVoiceSeconds: Number(totals.total_voice_seconds || 0),
        mostActiveChannelId: totals.most_active_channel_id || null,
        mostActiveChannelName: totals.most_active_channel_name || null,
        mostActiveChannelCount: Number(totals.most_active_channel_count || 0)
      },
      dailyTrend: trend.map((row) => ({
        date: row.stat_date,
        totalMessages: Number(row.total_messages),
        totalVoiceSeconds: Number(row.total_voice_seconds)
      })),
      channelDistribution: channelDistribution.map((row) => ({
        channelId: row.channel_id,
        channelName: row.channel_name,
        messageCount: Number(row.message_count)
      })),
      heatmap: heatmap.map((row) => ({
        dayOfWeek: Number(row.day_of_week),
        hourOfDay: Number(row.hour_of_day),
        eventCount: Number(row.event_count)
      })),
      recentMessages: recentMessages.map((row) => ({
        channelId: row.channel_id,
        channelName: row.channel_name,
        content: row.content || null,
        media: mapMessageMedia(row),
        occurredAt: row.occurred_at
      })),
      recentVoiceSessions: recentVoiceSessions.map((row) => ({
        channelId: row.channel_id,
        channelName: row.channel_name,
        startTime: row.start_time,
        endTime: row.end_time,
        durationSeconds: Number(row.duration_seconds || 0),
        closedReason: row.closed_reason || null
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
