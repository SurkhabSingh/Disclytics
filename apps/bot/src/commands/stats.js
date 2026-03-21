const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { STATS_PERIODS } = require("@analytics-platform/shared");

const PERIOD_LABELS = Object.freeze({
  [STATS_PERIODS.DAY]: "Last 24 hours",
  [STATS_PERIODS.WEEK]: "Last 7 days",
  [STATS_PERIODS.MONTH]: "Last 30 days",
  [STATS_PERIODS.LIFETIME]: "Lifetime"
});

function formatVoiceTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatActivityTimestamp(value) {
  if (!value) {
    return "No tracked activity yet";
  }

  return `<t:${Math.floor(new Date(value).getTime() / 1000)}:R>`;
}

function createStatsCommand() {
  return new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show your analytics for this server only")
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription("How far back to look")
        .setRequired(false)
        .addChoices(
          { name: "Day", value: STATS_PERIODS.DAY },
          { name: "Week", value: STATS_PERIODS.WEEK },
          { name: "Month", value: STATS_PERIODS.MONTH },
          { name: "Lifetime", value: STATS_PERIODS.LIFETIME }
        )
    );
}

async function handleStatsCommand(interaction, backendClient) {
  const period = interaction.options.getString("period") || STATS_PERIODS.WEEK;
  const result = await backendClient.post("/api/internal/analytics/guild-user-summary", {
    guildId: interaction.guildId,
    period,
    userId: interaction.user.id
  });

  const summary = result.summary;
  const hasActivity = summary.totalMessages > 0 || summary.totalVoiceSeconds > 0;

  const embed = new EmbedBuilder()
    .setColor(0x16423c)
    .setTitle(`${interaction.user.username}'s server stats`)
    .setDescription(
      hasActivity
        ? `Tracked activity in **${interaction.guild.name}** for **${PERIOD_LABELS[period]}**.`
        : `No tracked activity yet in **${interaction.guild.name}** for **${PERIOD_LABELS[period]}**.`
    )
    .addFields(
      { name: "Messages", value: String(summary.totalMessages), inline: true },
      { name: "Voice Time", value: formatVoiceTime(summary.totalVoiceSeconds), inline: true },
      {
        name: "Top Channel",
        value: summary.mostActiveChannelName
          ? `${summary.mostActiveChannelName} (${summary.mostActiveChannelCount})`
          : "No dominant channel yet",
        inline: true
      },
      {
        name: "First Activity",
        value: formatActivityTimestamp(summary.firstActivityAt),
        inline: true
      },
      {
        name: "Last Activity",
        value: formatActivityTimestamp(summary.lastActivityAt),
        inline: true
      },
      {
        name: "Scope",
        value: "Current server only",
        inline: true
      }
    )
    .setFooter({
      text: "Only servers with the bot installed are tracked."
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

module.exports = {
  createStatsCommand,
  handleStatsCommand
};
