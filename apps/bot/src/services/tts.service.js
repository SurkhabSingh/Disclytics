const { once } = require("node:events");
const { Readable } = require("node:stream");

const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel
} = require("@discordjs/voice");
const googleTTS = require("google-tts-api");

const { env } = require("../config/env");

async function createTtsResource(text) {
  const audioUrl = googleTTS.getAudioUrl(text, {
    lang: env.GOOGLE_TTS_LANG,
    slow: false,
    host: "https://translate.google.com"
  });

  const response = await fetch(audioUrl);

  if (!response.ok || !response.body) {
    throw new Error("Unable to fetch TTS audio");
  }

  const stream = Readable.fromWeb(response.body);
  return createAudioResource(stream);
}

async function playTextInChannel(channel, text) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    const player = createAudioPlayer();
    const resource = await createTtsResource(text.slice(0, 180));
    connection.subscribe(player);
    player.play(resource);

    await Promise.race([
      once(player, AudioPlayerStatus.Idle),
      once(player, "error").then(([error]) => Promise.reject(error))
    ]);
  } finally {
    connection.destroy();
  }
}

async function playTextToMemberVoiceChannel(client, { guildId, userId, text }) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    return {
      delivered: false,
      reason: "user_not_in_voice"
    };
  }

  await playTextInChannel(voiceChannel, text);

  return {
    delivered: true,
    channelId: voiceChannel.id
  };
}

module.exports = {
  playTextInChannel,
  playTextToMemberVoiceChannel
};
