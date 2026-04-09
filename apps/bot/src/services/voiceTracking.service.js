const VOICE_STATE_RECONCILE_INTERVAL_MS = 30_000;

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

function createSessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function createVoiceTrackingService({ backendClient, logger, voiceSessionStore }) {
  let reconcileIntervalId = null;
  let reconcileInFlight = false;

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

  function collectObservedVoiceSessions(client) {
    const sessions = [];

    client.guilds.cache.forEach((guild) => {
      guild.voiceStates.cache.forEach((state) => {
        if (!state.channelId || !state.member || state.member.user.bot) {
          return;
        }

        sessions.push({
          user: serializeUser(state.member.user),
          guild: serializeGuild(guild),
          channel: serializeChannel(state.channel)
        });
      });
    });

    return sessions;
  }

  function syncVoiceStoreFromObservedSessions(observedSessions, observedAt) {
    const observedKeys = new Set();

    for (const session of observedSessions) {
      const key = createSessionKey(session.guild.guildId, session.user.userId);
      const existingSession = voiceSessionStore.get(session.guild.guildId, session.user.userId);
      observedKeys.add(key);

      if (existingSession && existingSession.channelId === session.channel.channelId) {
        continue;
      }

      voiceSessionStore.set({
        guildId: session.guild.guildId,
        userId: session.user.userId,
        channelId: session.channel.channelId,
        startTime: observedAt
      });
    }

    for (const session of voiceSessionStore.all()) {
      const key = createSessionKey(session.guildId, session.userId);

      if (!observedKeys.has(key)) {
        voiceSessionStore.delete(session.guildId, session.userId);
      }
    }
  }

  async function reconcileFromGateway(client, reason = "manual") {
    if (typeof client.isReady === "function" && !client.isReady()) {
      logger.info("Skipping voice reconciliation because the Discord client is not ready", {
        reason
      });
      return;
    }

    const observedAt = new Date().toISOString();
    const sessions = collectObservedVoiceSessions(client);
    syncVoiceStoreFromObservedSessions(sessions, observedAt);

    await backendClient.post("/api/internal/voice-sessions/reconcile", {
      observedAt,
      sessions
    });
    logger.info("Reconciled live voice state from gateway", {
      activeSessionCount: sessions.length,
      observedAt,
      reason
    });
  }

  function startBackgroundSync(client) {
    if (reconcileIntervalId) {
      return;
    }

    const tick = async () => {
      if (reconcileInFlight) {
        return;
      }

      reconcileInFlight = true;

      try {
        await reconcileFromGateway(client, "interval");
      } catch (error) {
        logger.error("Failed background voice reconciliation", { error });
      } finally {
        reconcileInFlight = false;
      }
    };

    reconcileIntervalId = setInterval(() => {
      void tick();
    }, VOICE_STATE_RECONCILE_INTERVAL_MS);
    reconcileIntervalId.unref?.();
  }

  function stopBackgroundSync() {
    if (!reconcileIntervalId) {
      return;
    }

    clearInterval(reconcileIntervalId);
    reconcileIntervalId = null;
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
    reconcileFromGateway,
    startBackgroundSync,
    stopBackgroundSync
  };
}

module.exports = { createVoiceTrackingService };
