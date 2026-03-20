const { Router } = require("express");

const { getDashboard } = require("../controllers/analytics.controller");
const { asyncHandler } = require("../lib/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");

const router = Router();

router.get("/dashboard", requireAuth, asyncHandler(getDashboard));

module.exports = router;
