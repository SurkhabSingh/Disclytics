async function insertEvent(client, event) {
  const { rows } = await client.query(
    `
      INSERT INTO events (
        discord_user_id,
        discord_guild_id,
        discord_channel_id,
        type,
        occurred_at,
        idempotency_key,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB)
      ON CONFLICT (idempotency_key)
      DO UPDATE SET
        metadata = events.metadata
      RETURNING *
    `,
    [
      event.userId,
      event.guildId,
      event.channelId,
      event.type,
      event.timestamp,
      event.idempotencyKey || null,
      JSON.stringify(event.metadata || {})
    ]
  );

  return rows[0];
}

module.exports = { insertEvent };
