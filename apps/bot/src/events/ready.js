const { syncTrackedGuilds } = require("../services/guildSync.service");
const { registerSlashCommands } = require("../services/commandRegistration.service");

function createReadyHandler({ backendClient, logger, voiceTrackingService }) {
  return async function handleReady(client) {
    logger.info("Bot connected to Discord gateway", {
      botTag: client.user.tag,
      guildCount: client.guilds.cache.size
    });
    await registerSlashCommands(client, logger);
    await syncTrackedGuilds(client, backendClient);
    await voiceTrackingService.reconcileFromGateway(client, "ready");
    voiceTrackingService.startBackgroundSync(client);
  };
}

module.exports = { createReadyHandler };
