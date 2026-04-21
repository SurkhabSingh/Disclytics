const { Router } = require("express");

const {
  getDashboard,
  getHistory,
  getLifetime,
  getOverview
} = require("../controllers/analytics.controller");
const { asyncHandler } = require("../lib/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");

const router = Router();

router.get("/dashboard", requireAuth, asyncHandler(getDashboard));
router.get("/overview", requireAuth, asyncHandler(getOverview));
router.get("/history", requireAuth, asyncHandler(getHistory));
router.get("/lifetime", requireAuth, asyncHandler(getLifetime));

module.exports = router;
