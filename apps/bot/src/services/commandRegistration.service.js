const { createReminderCommand } = require("../commands/remind");
const { createStatsCommand } = require("../commands/stats");
const { env } = require("../config/env");

async function registerSlashCommands(client, logger) {
  const commands = [
    createStatsCommand().toJSON(),
    createReminderCommand().toJSON()
  ];

  if (env.DISCORD_COMMAND_GUILD_ID) {
    const guild = await client.guilds.fetch(env.DISCORD_COMMAND_GUILD_ID);
    await guild.commands.set(commands);
    logger.info("Registered guild slash commands", {
      commandCount: commands.length,
      guildId: guild.id
    });
    return;
  }

  await client.application.commands.set(commands);
  logger.info("Registered global slash commands", {
    commandCount: commands.length
  });
}

module.exports = { registerSlashCommands };
