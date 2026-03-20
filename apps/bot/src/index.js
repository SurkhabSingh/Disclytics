const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");
const { registerGracefulShutdown } = require("@analytics-platform/runtime");

const { createBackendClient } = require("./clients/backendClient");
const { env } = require("./config/env");
const { logger } = require("./lib/logger");
const { createControlServer } = require("./server/controlServer");
const { createVoiceTrackingService } = require("./services/voiceTracking.service");
const { createVoiceSessionStore } = require("./state/voiceSessions");
const { registerEvents } = require("./utils/registerEvents");

async function startBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
  });

  const backendClient = createBackendClient();
  const voiceSessionStore = createVoiceSessionStore();
  const voiceTrackingService = createVoiceTrackingService({
    backendClient,
    logger: logger.child({
      component: "voice-tracking"
    }),
    voiceSessionStore
  });

  registerEvents(client, {
    backendClient,
    logger,
    voiceTrackingService
  });

  const controlServer = createControlServer(client);

  registerGracefulShutdown({
    cleanup: async () => {
      await voiceTrackingService.flushActiveSessions(client);
      await new Promise((resolve, reject) => {
        controlServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      client.destroy();
    },
    logger,
    name: "bot"
  });

  await client.login(env.DISCORD_BOT_TOKEN);
  logger.info("Bot login initiated");
}

startBot().catch((error) => {
  logger.fatal("Failed to start bot", {
    error
  });
  process.exit(1);
});
