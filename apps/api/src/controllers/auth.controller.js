const { env } = require("../config/env");
const { withTransaction } = require("../db/pool");
const { AppError } = require("../lib/appError");
const { logger } = require("../lib/logger");
const { upsertGuilds } = require("../repositories/guild.repository");
const { getUserById, getUserGuilds, replaceUserGuilds, upsertUser } = require("../repositories/user.repository");
const {
  exchangeCodeForToken,
  fetchDiscordGuilds,
  fetchDiscordUser
} = require("../services/discordOAuth.service");
const {
  signOAuthState,
  signSessionToken,
  verifyOAuthState
} = require("../services/jwt.service");

const BOT_INVITE_PERMISSIONS = "3214336";

function getDiscordAuthorizationUrl() {
  const state = signOAuthState();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.DISCORD_REDIRECT_URI,
    scope: "identify guilds",
    state
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function getDiscordBotInstallUrl(guildId) {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    permissions: BOT_INVITE_PERMISSIONS,
    scope: "bot applications.commands"
  });

  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function getGuildIconUrl(guildId, iconHash) {
  if (!iconHash) {
    return null;
  }

  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
}

async function startDiscordAuth(req, res) {
  res.redirect(getDiscordAuthorizationUrl());
}

async function handleDiscordCallback(req, res, next) {
  const { code, state } = req.query;

  if (!code || !state) {
    throw new AppError("Missing OAuth callback parameters", 400);
  }

  try {
    verifyOAuthState(state);
  } catch (error) {
    return next(new AppError("Invalid OAuth state", 400));
  }

  const tokenPayload = await exchangeCodeForToken({
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: env.DISCORD_REDIRECT_URI,
    code
  });

  const accessToken = tokenPayload.access_token;
  const [discordUser, discordGuilds] = await Promise.all([
    fetchDiscordUser(accessToken),
    fetchDiscordGuilds(accessToken)
  ]);

  try {
    await withTransaction(async (client) => {
      await upsertUser(client, {
        userId: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.global_name,
        avatar: discordUser.avatar
      });

      await upsertGuilds(
        client,
        discordGuilds.map((guild) => ({
          guildId: guild.id,
          name: guild.name,
          icon: guild.icon
        })),
        {
          botPresent: false,
          preserveExistingBotPresence: true
        }
      );

      await replaceUserGuilds(
        client,
        discordUser.id,
        discordGuilds.map((guild) => ({
          guildId: guild.id,
          permissions: guild.permissions
        }))
      );
    });
  } catch (error) {
    logger.error("Failed to persist Discord OAuth callback data", {
      error,
      guildCount: discordGuilds.length,
      userId: discordUser.id
    });

    throw new AppError("Failed to persist Discord OAuth data", 500, {
      code: error.code || null,
      message: error.message
    });
  }

  const sessionToken = signSessionToken(discordUser.id);

  res.cookie(env.SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.WEB_APP_URL.startsWith("https://"),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.redirect(`${env.WEB_APP_URL}/dashboard`);
}

async function getCurrentUser(req, res) {
  const { user, guilds } = await withTransaction(async (client) => {
    const [user, guilds] = await Promise.all([
      getUserById(client, req.auth.userId),
      getUserGuilds(client, req.auth.userId)
    ]);

    return { guilds, user };
  });

  res.json({
    user,
    botInstallUrl: getDiscordBotInstallUrl(),
    guilds: guilds.map((guild) => ({
      guildId: guild.guild_id,
      name: guild.name,
      iconUrl: getGuildIconUrl(guild.guild_id, guild.icon),
      botPresent: guild.bot_present,
      canInstall: guild.can_install,
      installUrl: guild.can_install ? getDiscordBotInstallUrl(guild.guild_id) : null
    }))
  });
}

async function logout(req, res) {
  res.clearCookie(env.SESSION_COOKIE_NAME);
  res.status(204).send();
}

module.exports = {
  getCurrentUser,
  handleDiscordCallback,
  logout,
  startDiscordAuth
};
