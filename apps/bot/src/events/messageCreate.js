const { ChannelType } = require("discord.js");

function resolveChannelTypeName(channel) {
  if (!channel) {
    return null;
  }

  return ChannelType[channel.type] || String(channel.type);
}

function extractAttachments(message) {
  return Array.from(message.attachments.values()).map((attachment) => ({
    url: attachment.url,
    proxyUrl: attachment.proxyURL || null,
    contentType: attachment.contentType || null,
    name: attachment.name || null,
    width: attachment.width || null,
    height: attachment.height || null
  }));
}

function extractEmbeds(message) {
  return message.embeds.map((embed) => ({
    url: embed.url || null,
    imageUrl: embed.image?.url || embed.thumbnail?.url || null,
    type: embed.type || null,
    title: embed.title || null,
    description: embed.description || null
  }));
}

function createMessageCreateHandler({ backendClient, logger }) {
  return async function handleMessageCreate(message) {
    if (!message.guild || message.author.bot) {
      return;
    }

    const channelType = resolveChannelTypeName(message.channel);
    const cleanContent = message.cleanContent || message.content || null;
    const attachments = extractAttachments(message);
    const embeds = extractEmbeds(message);

    if (message.channel?.isVoiceBased?.()) {
      logger.info("Observed message in a voice-based channel", {
        channelId: message.channel.id,
        channelName: message.channel.name || null,
        channelType,
        guildId: message.guild.id,
        messageId: message.id,
        userId: message.author.id
      });
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
        name: message.channel.name || null,
        type: channelType
      },
      idempotencyKey: `message:${message.id}`,
      content: cleanContent,
      attachments,
      embeds,
      messageId: message.id,
      timestamp: message.createdAt.toISOString()
    });
  };
}

module.exports = { createMessageCreateHandler };
