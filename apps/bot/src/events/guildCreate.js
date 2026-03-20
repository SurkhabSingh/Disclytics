const { syncTrackedGuilds } = require("../services/guildSync.service");

function createGuildCreateHandler(backendClient) {
  return async function handleGuildCreate(guild) {
    await syncTrackedGuilds(guild.client, backendClient);
  };
}

module.exports = { createGuildCreateHandler };
