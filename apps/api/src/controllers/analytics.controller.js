const { getDashboardAnalytics } = require("../services/analytics.service");

async function getDashboard(req, res) {
  const selectedDate = (
    typeof req.query.selectedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(req.query.selectedDate)
  )
    ? req.query.selectedDate
    : null;
  const dashboard = await getDashboardAnalytics(req.auth.userId, selectedDate);
  res.set("Cache-Control", "no-store");
  res.json(dashboard);
}

module.exports = { getDashboard };
