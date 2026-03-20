const { getDashboardAnalytics } = require("../services/analytics.service");

async function getDashboard(req, res) {
  const days = Math.min(Number(req.query.days || 7), 30);
  const dashboard = await getDashboardAnalytics(req.auth.userId, days);
  res.json(dashboard);
}

module.exports = { getDashboard };
