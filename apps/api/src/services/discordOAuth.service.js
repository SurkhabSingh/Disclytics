const { AppError } = require("../lib/appError");
const { logger } = require("../lib/logger");
const { createHttpClient } = require("@analytics-platform/runtime");

const discordHttpClient = createHttpClient({
  baseUrl: "https://discord.com/api",
  logger: logger.child({
    component: "discord-oauth"
  }),
  retries: 1,
  serviceName: "api",
  timeoutMs: 8_000
});

async function exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri
  });

  try {
    const response = await discordHttpClient.request("/oauth2/token", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST",
      rawBody: body
    });

    return response.data;
  } catch (error) {
    throw new AppError("Discord OAuth token exchange failed", 502, {
      message: error.message,
      requestId: error.requestId || null
    });
  }
}

async function fetchDiscordUser(accessToken) {
  return fetchDiscordResource("/users/@me", accessToken);
}

async function fetchDiscordGuilds(accessToken) {
  return fetchDiscordResource("/users/@me/guilds", accessToken);
}

async function fetchDiscordResource(path, accessToken) {
  try {
    const response = await discordHttpClient.get(path, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    throw new AppError("Discord API request failed", 502, {
      message: error.message,
      requestId: error.requestId || null
    });
  }
}

module.exports = {
  exchangeCodeForToken,
  fetchDiscordGuilds,
  fetchDiscordUser
};
