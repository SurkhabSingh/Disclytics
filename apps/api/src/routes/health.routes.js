const { Router } = require("express");

const { getHealth, getReadiness } = require("../controllers/health.controller");
const { asyncHandler } = require("../lib/asyncHandler");

const router = Router();

router.get("/", asyncHandler(getHealth));
router.get("/live", asyncHandler(getHealth));
router.get("/ready", asyncHandler(getReadiness));

module.exports = router;
