const { REMINDER_DELIVERY_TYPES } = require("@analytics-platform/shared");
const { ChannelType } = require("discord.js");

const { playTextToMemberVoiceChannel } = require("./tts.service");

function buildReminderContent(payload) {
  return `**${payload.title}**\n${payload.message}`;
}

async function sendDirectMessage(client, payload) {
  const user = await client.users.fetch(payload.userId);
  await user.send(buildReminderContent(payload));
  return { mode: REMINDER_DELIVERY_TYPES.DM, delivered: true };
}

async function sendChannelMessage(client, payload) {
  if (!payload.targetChannelId) {
    return {
      mode: REMINDER_DELIVERY_TYPES.CHANNEL,
      delivered: false,
      reason: "missing_target_channel"
    };
  }

  const channel = await client.channels.fetch(payload.targetChannelId);

  if (!channel || !channel.isTextBased() || channel.type === ChannelType.DM) {
    return {
      mode: REMINDER_DELIVERY_TYPES.CHANNEL,
      delivered: false,
      reason: "invalid_target_channel"
    };
  }

  await channel.send(buildReminderContent(payload));
  return { mode: REMINDER_DELIVERY_TYPES.CHANNEL, delivered: true };
}

async function sendVoiceReminder(client, payload) {
  if (!payload.guildId) {
    return {
      mode: REMINDER_DELIVERY_TYPES.VOICE,
      delivered: false,
      reason: "missing_guild_id"
    };
  }

  const result = await playTextToMemberVoiceChannel(client, {
    guildId: payload.guildId,
    userId: payload.userId,
    text: `Reminder. ${payload.title}. ${payload.message}`
  });

  return {
    mode: REMINDER_DELIVERY_TYPES.VOICE,
    ...result
  };
}

async function deliverReminder(client, payload) {
  const results = [];

  if (payload.deliveryModes.includes(REMINDER_DELIVERY_TYPES.DM)) {
    try {
      results.push(await sendDirectMessage(client, payload));
    } catch (error) {
      results.push({
        mode: REMINDER_DELIVERY_TYPES.DM,
        delivered: false,
        reason: error.message
      });
    }
  }

  if (payload.deliveryModes.includes(REMINDER_DELIVERY_TYPES.CHANNEL)) {
    try {
      results.push(await sendChannelMessage(client, payload));
    } catch (error) {
      results.push({
        mode: REMINDER_DELIVERY_TYPES.CHANNEL,
        delivered: false,
        reason: error.message
      });
    }
  }

  if (payload.deliveryModes.includes(REMINDER_DELIVERY_TYPES.VOICE)) {
    try {
      results.push(await sendVoiceReminder(client, payload));
    } catch (error) {
      results.push({
        mode: REMINDER_DELIVERY_TYPES.VOICE,
        delivered: false,
        reason: error.message
      });
    }
  }

  return { reminderId: payload.reminderId, results };
}

module.exports = {
  deliverReminder
};
