const { EVENT_TYPES } = require("@analytics-platform/shared");

const { withTransaction } = require("../db/pool");
const { insertEvent } = require("../repositories/event.repository");
const { upsertGuilds } = require("../repositories/guild.repository");
const { upsertUser } = require("../repositories/user.repository");
const {
  listActiveVoiceSessions,
  startVoiceSession,
  stopActiveVoiceSession
} = require("../repositories/voice.repository");

async function ingestMessageEvent(payload) {
  return withTransaction(async (client) => {
    await upsertUser(client, payload.user);
    await upsertGuilds(client, [payload.guild], { botPresent: true });

    return insertEvent(client, {
      userId: payload.user.userId,
      guildId: payload.guild.guildId,
      channelId: payload.channel.channelId,
      idempotencyKey: payload.idempotencyKey,
      type: EVENT_TYPES.MESSAGE,
      timestamp: payload.timestamp,
      metadata: {
        content: payload.content || null,
        attachments: payload.attachments || [],
        embeds: payload.embeds || [],
        messageId: payload.messageId || null,
        channelName: payload.channel.name || null,
        channelType: payload.channel.type || null,
        guildName: payload.guild.name || null
      }
    });
  });
}

async function startTrackedVoiceSession(payload) {
  return withTransaction(async (client) => {
    await upsertUser(client, payload.user);
    await upsertGuilds(client, [payload.guild], { botPresent: true });

    await insertEvent(client, {
      userId: payload.user.userId,
      guildId: payload.guild.guildId,
      channelId: payload.channel.channelId,
      idempotencyKey: payload.idempotencyKey,
      type: EVENT_TYPES.VOICE_JOIN,
      timestamp: payload.startTime,
      metadata: {
        channelName: payload.channel.name || null
      }
    });

    return startVoiceSession(client, {
      userId: payload.user.userId,
      guildId: payload.guild.guildId,
      channelId: payload.channel.channelId,
      startTime: payload.startTime
    });
  });
}

async function stopTrackedVoiceSession(payload) {
  return withTransaction(async (client) => {
    await upsertUser(client, payload.user);
    await upsertGuilds(client, [payload.guild], { botPresent: true });

    await insertEvent(client, {
      userId: payload.user.userId,
      guildId: payload.guild.guildId,
      channelId: payload.channel.channelId,
      idempotencyKey: payload.idempotencyKey,
      type: payload.reason === "switch" ? EVENT_TYPES.VOICE_SWITCH : EVENT_TYPES.VOICE_LEAVE,
      timestamp: payload.endTime,
      metadata: {
        channelName: payload.channel.name || null,
        reason: payload.reason || "leave"
      }
    });

    return stopActiveVoiceSession(client, {
      userId: payload.user.userId,
      guildId: payload.guild.guildId,
      endTime: payload.endTime,
      reason: payload.reason,
      sessionStartTime: payload.sessionStartTime
    });
  });
}

async function reconcileTrackedVoiceSessions(payload) {
  return withTransaction(async (client) => {
    const activeSessions = await listActiveVoiceSessions(client);
    const expectedKeys = new Set(
      payload.sessions.map((session) => `${session.guild.guildId}:${session.user.userId}`)
    );

    const sessionsToClose = activeSessions.filter((session) => {
      const key = `${session.discord_guild_id}:${session.discord_user_id}`;
      return !expectedKeys.has(key);
    });

    for (const session of sessionsToClose) {
      await stopActiveVoiceSession(client, {
        userId: session.discord_user_id,
        guildId: session.discord_guild_id,
        endTime: payload.observedAt,
        reason: "reconciled_missing"
      });
    }

    for (const session of payload.sessions) {
      const key = `${session.guild.guildId}:${session.user.userId}`;
      const exists = activeSessions.some(
        (row) => `${row.discord_guild_id}:${row.discord_user_id}` === key
      );

      if (!exists) {
        await upsertUser(client, session.user);
        await upsertGuilds(client, [session.guild], { botPresent: true });
        await insertEvent(client, {
          userId: session.user.userId,
          guildId: session.guild.guildId,
          channelId: session.channel.channelId,
          idempotencyKey: `voice:${session.guild.guildId}:${session.user.userId}:${payload.observedAt}:reconcile-start`,
          type: EVENT_TYPES.VOICE_JOIN,
          timestamp: payload.observedAt,
          metadata: {
            channelName: session.channel.name || null,
            reason: "reconciled_present"
          }
        });
        await startVoiceSession(client, {
          userId: session.user.userId,
          guildId: session.guild.guildId,
          channelId: session.channel.channelId,
          startTime: payload.observedAt
        });
      }
    }

    return {
      activeSessions: payload.sessions.length,
      closedSessions: sessionsToClose.length
    };
  });
}

module.exports = {
  ingestMessageEvent,
  reconcileTrackedVoiceSessions,
  startTrackedVoiceSession,
  stopTrackedVoiceSession
};
