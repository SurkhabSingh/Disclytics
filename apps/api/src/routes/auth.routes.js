const { Router } = require("express");

const {
  getCurrentUser,
  handleDiscordCallback,
  logout,
  startDiscordInstall,
  startDiscordAuth
} = require("../controllers/auth.controller");
const { asyncHandler } = require("../lib/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");

const router = Router();

router.get("/discord/start", asyncHandler(startDiscordAuth));
router.get("/discord/install", asyncHandler(startDiscordInstall));
router.get("/discord/callback", asyncHandler(handleDiscordCallback));
router.get("/me", requireAuth, asyncHandler(getCurrentUser));
router.post("/logout", requireAuth, asyncHandler(logout));

module.exports = router;
