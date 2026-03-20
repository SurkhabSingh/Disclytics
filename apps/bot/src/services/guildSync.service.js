function serializeGuild(guild) {
  return {
    guildId: guild.id,
    name: guild.name,
    icon: guild.icon
  };
}

async function syncTrackedGuilds(client, backendClient) {
  const guilds = [...client.guilds.cache.values()].map(serializeGuild);
  await backendClient.post("/api/internal/guilds/sync", { guilds });
}

module.exports = {
  serializeGuild,
  syncTrackedGuilds
};
