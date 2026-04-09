const test = require("node:test");
const assert = require("node:assert/strict");

const { createVoiceSessionStore } = require("../src/state/voiceSessions");
const { createVoiceTrackingService } = require("../src/services/voiceTracking.service");

function createLoggerStub() {
  return {
    error() {},
    info() {}
  };
}

function createMember() {
  const guild = {
    channels: {
      cache: new Map()
    },
    id: "guild-1",
    icon: null,
    members: {
      fetch: async () => member
    },
    name: "Guild One"
  };

  const member = {
    guild,
    id: "user-1",
    user: {
      avatar: null,
      bot: false,
      globalName: "User One",
      id: "user-1",
      username: "user-one"
    }
  };

  return member;
}

function createChannel(id, name, guild) {
  const channel = { guild, id, name };
  guild.channels.cache.set(id, channel);
  return channel;
}

function createClientWithVoiceState(member, channel) {
  return {
    guilds: {
      cache: new Map([
        [
          member.guild.id,
          {
            ...member.guild,
            voiceStates: {
              cache: new Map([
                [
                  member.id,
                  {
                    channel,
                    channelId: channel.id,
                    member
                  }
                ]
              ])
            }
          }
        ]
      ])
    },
    isReady() {
      return true;
    }
  };
}

test("voice tracking starts a session when a user joins voice", async () => {
  const calls = [];
  const voiceSessionStore = createVoiceSessionStore();
  const member = createMember();
  const general = createChannel("voice-1", "General", member.guild);
  const service = createVoiceTrackingService({
    backendClient: {
      post: async (path, payload) => {
        calls.push({ path, payload });
      }
    },
    logger: createLoggerStub(),
    voiceSessionStore
  });

  await service.handleVoiceStateUpdate(
    { channel: null, member },
    { channel: general, member }
  );

  const session = voiceSessionStore.get(member.guild.id, member.id);

  assert.equal(calls[0].path, "/api/internal/voice-sessions/start");
  assert.equal(session.channelId, "voice-1");
  assert.ok(calls[0].payload.idempotencyKey.includes(":start"));
});

test("voice tracking stops the old session and starts a new one on channel switch", async () => {
  const calls = [];
  const voiceSessionStore = createVoiceSessionStore();
  const member = createMember();
  const general = createChannel("voice-1", "General", member.guild);
  const focus = createChannel("voice-2", "Focus", member.guild);
  const service = createVoiceTrackingService({
    backendClient: {
      post: async (path, payload) => {
        calls.push({ path, payload });
      }
    },
    logger: createLoggerStub(),
    voiceSessionStore
  });

  await service.handleVoiceStateUpdate(
    { channel: null, member },
    { channel: general, member }
  );

  const firstSession = voiceSessionStore.get(member.guild.id, member.id);

  await service.handleVoiceStateUpdate(
    { channel: general, member },
    { channel: focus, member }
  );

  const activeSession = voiceSessionStore.get(member.guild.id, member.id);

  assert.equal(calls[1].path, "/api/internal/voice-sessions/stop");
  assert.equal(calls[1].payload.sessionStartTime, firstSession.startTime);
  assert.equal(calls[2].path, "/api/internal/voice-sessions/start");
  assert.equal(activeSession.channelId, "voice-2");
});

test("voice tracking reconciles users already in voice when the bot becomes ready", async () => {
  const calls = [];
  const voiceSessionStore = createVoiceSessionStore();
  const member = createMember();
  const general = createChannel("voice-1", "General", member.guild);
  const client = createClientWithVoiceState(member, general);
  const service = createVoiceTrackingService({
    backendClient: {
      post: async (path, payload) => {
        calls.push({ path, payload });
      }
    },
    logger: createLoggerStub(),
    voiceSessionStore
  });

  await service.reconcileFromGateway(client, "ready");

  const session = voiceSessionStore.get(member.guild.id, member.id);

  assert.equal(calls[0].path, "/api/internal/voice-sessions/reconcile");
  assert.equal(calls[0].payload.sessions.length, 1);
  assert.equal(calls[0].payload.sessions[0].channel.channelId, "voice-1");
  assert.equal(session.channelId, "voice-1");
});

test("voice tracking keeps the original store start time during repeated reconciliation", async () => {
  const calls = [];
  const voiceSessionStore = createVoiceSessionStore();
  const member = createMember();
  const general = createChannel("voice-1", "General", member.guild);
  const client = createClientWithVoiceState(member, general);
  const service = createVoiceTrackingService({
    backendClient: {
      post: async (path, payload) => {
        calls.push({ path, payload });
      }
    },
    logger: createLoggerStub(),
    voiceSessionStore
  });

  await service.handleVoiceStateUpdate(
    { channel: null, member },
    { channel: general, member }
  );
  const firstSession = voiceSessionStore.get(member.guild.id, member.id);

  await service.reconcileFromGateway(client, "interval");

  const reconciledSession = voiceSessionStore.get(member.guild.id, member.id);

  assert.equal(reconciledSession.startTime, firstSession.startTime);
  assert.equal(calls[calls.length - 1].path, "/api/internal/voice-sessions/reconcile");
});
