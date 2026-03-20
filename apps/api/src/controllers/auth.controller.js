const { env } = require("../config/env");
const { withTransaction } = require("../db/pool");
const { AppError } = require("../lib/appError");
const { upsertGuilds } = require("../repositories/guild.repository");
const { getUserById, replaceUserGuilds, upsertUser } = require("../repositories/user.repository");
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
  const user = await withTransaction((client) => getUserById(client, req.auth.userId));
  res.json({ user });
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
