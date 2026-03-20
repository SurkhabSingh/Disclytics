const { syncTrackedGuilds } = require("../services/guildSync.service");

function createGuildDeleteHandler(backendClient) {
  return async function handleGuildDelete(guild) {
    await syncTrackedGuilds(guild.client, backendClient);
  };
}

module.exports = { createGuildDeleteHandler };
