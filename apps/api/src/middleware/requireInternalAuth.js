const { env } = require("../config/env");
const { AppError } = require("../lib/appError");

function requireInternalAuth(req, res, next) {
  const secret = req.get("x-internal-secret");

  if (!secret || secret !== env.INTERNAL_API_SECRET) {
    return next(new AppError("Forbidden", 403));
  }

  return next();
}

module.exports = { requireInternalAuth };
