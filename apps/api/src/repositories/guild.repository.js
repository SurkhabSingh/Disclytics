async function upsertGuilds(client, guilds, options = {}) {
  if (!guilds.length) {
    return;
  }

  const {
    botPresent = true,
    preserveExistingBotPresence = false
  } = options;

  const values = [];
  const placeholders = guilds.map((guild, index) => {
    const offset = index * 4;
    values.push(guild.guildId, guild.name, guild.icon || null, botPresent);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  });

  await client.query(
    `
      INSERT INTO guilds (
        discord_guild_id,
        name,
        icon,
        bot_present,
        last_synced_at,
        updated_at
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (discord_guild_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        icon = EXCLUDED.icon,
        bot_present = ${preserveExistingBotPresence ? "guilds.bot_present" : "EXCLUDED.bot_present"},
        last_synced_at = NOW(),
        updated_at = NOW()
    `,
    values
  );
}

async function syncBotGuilds(client, guilds) {
  await upsertGuilds(client, guilds, { botPresent: true });

  if (!guilds.length) {
    await client.query(
      `
        UPDATE guilds
        SET bot_present = FALSE,
            last_synced_at = NOW(),
            updated_at = NOW()
      `
    );

    return;
  }

  const guildIds = guilds.map((guild) => guild.guildId);

  await client.query(
    `
      UPDATE guilds
      SET bot_present = FALSE,
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE bot_present = TRUE
        AND discord_guild_id <> ALL($1::TEXT[])
    `,
    [guildIds]
  );
}

module.exports = {
  syncBotGuilds,
  upsertGuilds
};
