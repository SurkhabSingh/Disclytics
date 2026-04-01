const jwt = require("jsonwebtoken");

const { env } = require("../config/env");

function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_TTL_DAYS}d`
  });
}

function verifySessionToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function signOAuthState() {
  return jwt.sign({ kind: "discord_oauth_state" }, env.OAUTH_STATE_SECRET, {
    expiresIn: "10m"
  });
}

function verifyOAuthState(token) {
  return jwt.verify(token, env.OAUTH_STATE_SECRET);
}

module.exports = {
  signOAuthState,
  signSessionToken,
  verifyOAuthState,
  verifySessionToken
};
