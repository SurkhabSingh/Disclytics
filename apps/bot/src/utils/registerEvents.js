const { Events } = require("discord.js");

const { createGuildCreateHandler } = require("../events/guildCreate");
const { createGuildDeleteHandler } = require("../events/guildDelete");
const { createInteractionCreateHandler } = require("../events/interactionCreate");
const { createMessageCreateHandler } = require("../events/messageCreate");
const { createReadyHandler } = require("../events/ready");
const { createVoiceStateUpdateHandler } = require("../events/voiceStateUpdate");

function wrap(handler, eventName, logger) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      logger.error("Bot event failed", {
        error,
        eventName
      });
    }
  };
}

function registerEvents(client, dependencies) {
  client.once(
    Events.ClientReady,
    wrap(createReadyHandler(dependencies), Events.ClientReady, dependencies.logger)
  );
  client.on(
    Events.MessageCreate,
    wrap(
      createMessageCreateHandler({
        backendClient: dependencies.backendClient,
        logger: dependencies.logger.child({
          component: "message-tracking"
        })
      }),
      Events.MessageCreate,
      dependencies.logger
    )
  );
  client.on(
    Events.InteractionCreate,
    wrap(
      createInteractionCreateHandler({
        backendClient: dependencies.backendClient
      }),
      Events.InteractionCreate,
      dependencies.logger
    )
  );
  client.on(
    Events.VoiceStateUpdate,
    wrap(createVoiceStateUpdateHandler(dependencies.voiceTrackingService), Events.VoiceStateUpdate, dependencies.logger)
  );
  client.on(
    Events.GuildCreate,
    wrap(createGuildCreateHandler(dependencies.backendClient), Events.GuildCreate, dependencies.logger)
  );
  client.on(
    Events.GuildDelete,
    wrap(createGuildDeleteHandler(dependencies.backendClient), Events.GuildDelete, dependencies.logger)
  );
}

module.exports = { registerEvents };
