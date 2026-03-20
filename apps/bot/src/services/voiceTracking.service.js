function serializeUser(user) {
  return {
    userId: user.id,
    username: user.username,
    globalName: user.globalName || null,
    avatar: user.avatar || null
  };
}

function serializeChannel(channel) {
  return {
    channelId: channel.id,
    name: channel.name || null
  };
}

function serializeGuild(guild) {
  return {
    guildId: guild.id,
    name: guild.name,
    icon: guild.icon
  };
}

function createVoiceTrackingService({ backendClient, logger, voiceSessionStore }) {
  async function startSession(member, channel, startTime) {
    const idempotencyKey = `voice:${member.guild.id}:${member.id}:${startTime}:start`;
    logger.info("Starting tracked voice session", {
      channelId: channel.id,
      guildId: member.guild.id,
      idempotencyKey,
      userId: member.id
    });

    voiceSessionStore.set({
      guildId: member.guild.id,
      userId: member.id,
      channelId: channel.id,
      startTime
    });

    await backendClient.post("/api/internal/voice-sessions/start", {
      user: serializeUser(member.user),
      guild: serializeGuild(member.guild),
      channel: serializeChannel(channel),
      idempotencyKey,
      startTime
    });
  }

  async function stopSession(member, channel, endTime, reason) {
    const activeSession = voiceSessionStore.get(member.guild.id, member.id);
    logger.info("Stopping tracked voice session", {
      channelId: channel.id,
      guildId: member.guild.id,
      reason: reason || "leave",
      userId: member.id
    });
    voiceSessionStore.delete(member.guild.id, member.id);

    await backendClient.post("/api/internal/voice-sessions/stop", {
      user: serializeUser(member.user),
      guild: serializeGuild(member.guild),
      channel: serializeChannel(channel),
      idempotencyKey: `voice:${member.guild.id}:${member.id}:${activeSession?.startTime || endTime}:${reason || "leave"}:stop`,
      endTime,
      reason,
      sessionStartTime: activeSession?.startTime
    });
  }

  async function handleVoiceStateUpdate(oldState, newState) {
    const member = newState.member || oldState.member;

    if (!member || member.user.bot) {
      return;
    }

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (!oldChannel && newChannel) {
      await startSession(member, newChannel, new Date().toISOString());
      return;
    }

    if (oldChannel && !newChannel) {
      await stopSession(member, oldChannel, new Date().toISOString(), "leave");
      return;
    }

    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      const changedAt = new Date().toISOString();
      await stopSession(member, oldChannel, changedAt, "switch");
      await startSession(member, newChannel, changedAt);
    }
  }

  async function reconcileFromGateway(client) {
    const observedAt = new Date().toISOString();
    const sessions = [];
    voiceSessionStore.clear();

    client.guilds.cache.forEach((guild) => {
      guild.voiceStates.cache.forEach((state) => {
        if (!state.channelId || !state.member || state.member.user.bot) {
          return;
        }

        voiceSessionStore.set({
          guildId: guild.id,
          userId: state.member.id,
          channelId: state.channelId,
          startTime: observedAt
        });

        sessions.push({
          user: serializeUser(state.member.user),
          guild: serializeGuild(guild),
          channel: serializeChannel(state.channel)
        });
      });
    });

    await backendClient.post("/api/internal/voice-sessions/reconcile", {
      observedAt,
      sessions
    });
    logger.info("Reconciled live voice state from gateway", {
      activeSessionCount: sessions.length,
      observedAt
    });
  }

  async function flushActiveSessions(client, reason = "bot_shutdown") {
    const endedAt = new Date().toISOString();
    const activeSessions = voiceSessionStore.all();

    for (const session of activeSessions) {
      const guild = client.guilds.cache.get(session.guildId);
      const member = guild ? await guild.members.fetch(session.userId).catch(() => null) : null;
      const channel = guild ? guild.channels.cache.get(session.channelId) : null;

      if (!member || !channel) {
        voiceSessionStore.delete(session.guildId, session.userId);
        continue;
      }

      await stopSession(member, channel, endedAt, reason).catch((error) => {
        logger.error("Failed to flush voice session", {
          error,
          guildId: session.guildId,
          userId: session.userId
        });
      });
    }
  }

  return {
    flushActiveSessions,
    handleVoiceStateUpdate,
    reconcileFromGateway
  };
}

module.exports = { createVoiceTrackingService };
