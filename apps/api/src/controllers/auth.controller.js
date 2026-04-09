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

function isCrossOriginFrontendDeployment() {
  try {
    return new URL(env.WEB_APP_URL).origin !== new URL(env.DISCORD_REDIRECT_URI).origin;
  } catch {
    return false;
  }
}

function getSessionCookieOptions() {
  const crossOriginFrontend = isCrossOriginFrontendDeployment();
  const secure = env.SESSION_COOKIE_SECURE === "auto"
    ? (env.WEB_APP_URL.startsWith("https://") || env.DISCORD_REDIRECT_URI.startsWith("https://"))
    : env.SESSION_COOKIE_SECURE === "true";
  let sameSite = crossOriginFrontend ? "none" : env.SESSION_COOKIE_SAME_SITE;

  if (sameSite === "none" && !secure) {
    sameSite = "lax";
  }

  return {
    domain: env.SESSION_COOKIE_DOMAIN || undefined,
    httpOnly: true,
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: env.SESSION_COOKIE_PATH,
    sameSite,
    secure
  };
}

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

function getUserAvatarUrl(userId, avatarHash) {
  if (!userId || !avatarHash) {
    return null;
  }

  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=128`;
}

async function startDiscordAuth(req, res) {
  res.redirect(getDiscordAuthorizationUrl());
}

async function startDiscordInstall(req, res) {
  res.redirect(getDiscordBotInstallUrl());
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

  res.cookie(env.SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

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
    user: user ? {
      userId: user.discord_user_id,
      username: user.username,
      global_name: user.global_name,
      timezone: user.timezone,
      avatar_url: getUserAvatarUrl(user.discord_user_id, user.avatar)
    } : null,
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
  const { maxAge, ...clearOptions } = getSessionCookieOptions();
  res.clearCookie(env.SESSION_COOKIE_NAME, clearOptions);
  res.status(204).send();
}

module.exports = {
  getCurrentUser,
  handleDiscordCallback,
  logout,
  startDiscordInstall,
  startDiscordAuth
};
