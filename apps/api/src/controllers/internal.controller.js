const { withTransaction } = require("../db/pool");
const { syncBotGuilds } = require("../repositories/guild.repository");
const { getGuildStatsSummary } = require("../services/analytics.service");
const {
  ingestMessageEvent,
  reconcileTrackedVoiceSessions,
  startTrackedVoiceSession,
  stopTrackedVoiceSession
} = require("../services/eventIngestion.service");

async function ingestMessage(req, res) {
  const event = await ingestMessageEvent(req.validated);
  res.status(202).json({ event });
}

async function startVoiceSession(req, res) {
  const session = await startTrackedVoiceSession(req.validated);
  res.status(202).json({ session });
}

async function stopVoiceSession(req, res) {
  const session = await stopTrackedVoiceSession(req.validated);
  res.status(202).json({ session });
}

async function reconcileVoiceSessions(req, res) {
  const result = await reconcileTrackedVoiceSessions(req.validated);
  res.status(200).json(result);
}

async function syncGuildPresence(req, res) {
  await withTransaction((client) => syncBotGuilds(client, req.validated.guilds));
  res.status(200).json({ syncedGuilds: req.validated.guilds.length });
}

async function getGuildUserStats(req, res) {
  const result = await getGuildStatsSummary(
    req.validated.userId,
    req.validated.guildId,
    req.validated.period
  );

  res.status(200).json(result);
}

module.exports = {
  getGuildUserStats,
  ingestMessage,
  reconcileVoiceSessions,
  startVoiceSession,
  stopVoiceSession,
  syncGuildPresence
};
