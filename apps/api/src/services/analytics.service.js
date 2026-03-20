const { pool } = require("../db/pool");
const {
  getChannelDistribution,
  getCoverage,
  getDailyTrend,
  getHeatmap,
  getSummaryTotals
} = require("../repositories/analytics.repository");
const { getUserById } = require("../repositories/user.repository");

async function getDashboardAnalytics(userId, days) {
  const client = await pool.connect();

  try {
    const [user, coverage, totals, trend, channelDistribution, heatmap] = await Promise.all([
      getUserById(client, userId),
      getCoverage(client, userId),
      getSummaryTotals(client, userId, days),
      getDailyTrend(client, userId, days),
      getChannelDistribution(client, userId, days),
      getHeatmap(client, userId, days)
    ]);

    return {
      user,
      coverage,
      summary: {
        totalMessages: Number(totals.total_messages || 0),
        totalVoiceSeconds: Number(totals.total_voice_seconds || 0),
        mostActiveChannelId: totals.most_active_channel_id || null,
        mostActiveChannelCount: Number(totals.most_active_channel_count || 0)
      },
      dailyTrend: trend.map((row) => ({
        date: row.stat_date,
        totalMessages: Number(row.total_messages),
        totalVoiceSeconds: Number(row.total_voice_seconds)
      })),
      channelDistribution: channelDistribution.map((row) => ({
        channelId: row.channel_id,
        messageCount: Number(row.message_count)
      })),
      heatmap: heatmap.map((row) => ({
        dayOfWeek: Number(row.day_of_week),
        hourOfDay: Number(row.hour_of_day),
        eventCount: Number(row.event_count)
      }))
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getDashboardAnalytics
};
