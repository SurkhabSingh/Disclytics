function createMessageCreateHandler(backendClient) {
  return async function handleMessageCreate(message) {
    if (!message.guild || message.author.bot) {
      return;
    }

    await backendClient.post("/api/internal/events/messages", {
      user: {
        userId: message.author.id,
        username: message.author.username,
        globalName: message.author.globalName || null,
        avatar: message.author.avatar || null
      },
      guild: {
        guildId: message.guild.id,
        name: message.guild.name,
        icon: message.guild.icon
      },
      channel: {
        channelId: message.channel.id,
        name: message.channel.name || null
      },
      idempotencyKey: `message:${message.id}`,
      messageId: message.id,
      timestamp: message.createdAt.toISOString()
    });
  };
}

module.exports = { createMessageCreateHandler };
