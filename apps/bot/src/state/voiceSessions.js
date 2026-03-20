const { createVoiceSessionKey } = require("@analytics-platform/shared");

function createVoiceSessionStore() {
  const sessions = new Map();

  return {
    all() {
      return [...sessions.values()];
    },
    delete(guildId, userId) {
      sessions.delete(createVoiceSessionKey(guildId, userId));
    },
    get(guildId, userId) {
      return sessions.get(createVoiceSessionKey(guildId, userId)) || null;
    },
    set(session) {
      sessions.set(createVoiceSessionKey(session.guildId, session.userId), session);
    },
    clear() {
      sessions.clear();
    }
  };
}

module.exports = { createVoiceSessionStore };
