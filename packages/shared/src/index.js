const EVENT_TYPES = Object.freeze({
  MESSAGE: "message",
  VOICE_JOIN: "voice_join",
  VOICE_LEAVE: "voice_leave",
  VOICE_SWITCH: "voice_switch"
});

const REMINDER_DELIVERY_TYPES = Object.freeze({
  DM: "dm",
  CHANNEL: "channel",
  VOICE: "voice"
});

const REMINDER_SCHEDULE_TYPES = Object.freeze({
  ONCE: "once",
  DAILY: "daily",
  WEEKLY: "weekly"
});

function createVoiceSessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

module.exports = {
  EVENT_TYPES,
  REMINDER_DELIVERY_TYPES,
  REMINDER_SCHEDULE_TYPES,
  createVoiceSessionKey
};
