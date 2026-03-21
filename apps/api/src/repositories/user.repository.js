async function upsertUser(client, user) {
  const query = `
    INSERT INTO users (
      discord_user_id,
      username,
      global_name,
      avatar,
      timezone,
      updated_at
    )
    VALUES ($1, $2, $3, $4, COALESCE($5, 'UTC'), NOW())
    ON CONFLICT (discord_user_id)
    DO UPDATE SET
      username = EXCLUDED.username,
      global_name = EXCLUDED.global_name,
      avatar = EXCLUDED.avatar,
      timezone = COALESCE(EXCLUDED.timezone, users.timezone),
      updated_at = NOW()
    RETURNING *
  `;

  const values = [
    user.userId,
    user.username,
    user.globalName || null,
    user.avatar || null,
    user.timezone || null
  ];

  const { rows } = await client.query(query, values);
  return rows[0];
}

async function getUserById(client, userId) {
  const { rows } = await client.query(
    `
      SELECT *
      FROM users
      WHERE discord_user_id = $1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function getUserGuilds(client, userId) {
  const { rows } = await client.query(
    `
      SELECT
        ug.discord_guild_id AS guild_id,
        g.name,
        g.icon,
        g.bot_present,
        (
          (COALESCE(ug.permissions, 0)::BIGINT & 8::BIGINT) = 8::BIGINT OR
          (COALESCE(ug.permissions, 0)::BIGINT & 32::BIGINT) = 32::BIGINT
        ) AS can_install
      FROM user_guilds ug
      JOIN guilds g
        ON g.discord_guild_id = ug.discord_guild_id
      WHERE ug.discord_user_id = $1
      ORDER BY g.bot_present ASC, can_install DESC, g.name ASC
    `,
    [userId]
  );

  return rows;
}

async function replaceUserGuilds(client, userId, guilds) {
  await client.query(
    `
      DELETE FROM user_guilds
      WHERE discord_user_id = $1
    `,
    [userId]
  );

  if (!guilds.length) {
    return;
  }

  const values = [];
  const placeholders = guilds.map((guild, index) => {
    const offset = index * 3;
    values.push(userId, guild.guildId, guild.permissions || null);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
  });

  await client.query(
    `
      INSERT INTO user_guilds (
        discord_user_id,
        discord_guild_id,
        permissions
      )
      VALUES ${placeholders.join(", ")}
    `,
    values
  );
}

module.exports = {
  getUserById,
  getUserGuilds,
  replaceUserGuilds,
  upsertUser
};
