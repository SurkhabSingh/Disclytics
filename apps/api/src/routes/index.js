const { Router } = require("express");

const analyticsRoutes = require("./analytics.routes");
const authRoutes = require("./auth.routes");
const healthRoutes = require("./health.routes");
const internalRoutes = require("./internal.routes");
const remindersRoutes = require("./reminders.routes");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/reminders", remindersRoutes);
router.use("/internal", internalRoutes);

module.exports = router;
