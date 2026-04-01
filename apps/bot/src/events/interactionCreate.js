const { handleReminderCommand } = require("../commands/remind");
const { handleStatsCommand } = require("../commands/stats");

function createInteractionCreateHandler({ backendClient }) {
  return async function handleInteractionCreate(interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === "stats") {
      await handleStatsCommand(interaction, backendClient);
      return;
    }

    if (interaction.commandName === "remind") {
      await handleReminderCommand(interaction, backendClient);
    }
  };
}

module.exports = { createInteractionCreateHandler };
