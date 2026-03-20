const { env } = require("../config/env");
const { AppError } = require("../lib/appError");
const { verifySessionToken } = require("../services/jwt.service");

function requireAuth(req, res, next) {
  const authHeader = req.get("authorization");
  const bearerToken = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const token = bearerToken || req.cookies[env.SESSION_COOKIE_NAME];

  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  try {
    const payload = verifySessionToken(token);
    req.auth = { userId: payload.sub };
    return next();
  } catch (error) {
    return next(new AppError("Invalid session", 401));
  }
}

module.exports = { requireAuth };
