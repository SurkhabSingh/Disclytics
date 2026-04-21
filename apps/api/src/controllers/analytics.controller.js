const {
  getDashboardAnalytics,
  getDashboardOverview,
  getHistoryAnalytics,
  getLifetimeAnalytics
} = require("../services/analytics.service");

function getSelectedDate(query) {
  return (
    typeof query.selectedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(query.selectedDate)
  )
    ? query.selectedDate
    : null;
}

function getTimezone(query) {
  return typeof query.timezone === "string" && query.timezone.trim()
    ? query.timezone.trim()
    : null;
}

async function getDashboard(req, res) {
  const selectedDate = getSelectedDate(req.query);
  const timezone = getTimezone(req.query);
  const dashboard = await getDashboardAnalytics(req.auth.userId, selectedDate, timezone);
  res.set("Cache-Control", "no-store");
  res.json(dashboard);
}

async function getOverview(req, res) {
  const selectedDate = getSelectedDate(req.query);
  const timezone = getTimezone(req.query);
  const overview = await getDashboardOverview(req.auth.userId, selectedDate, timezone);
  res.set("Cache-Control", "no-store");
  res.json(overview);
}

async function getHistory(req, res) {
  const selectedDate = getSelectedDate(req.query);
  const timezone = getTimezone(req.query);
  const history = await getHistoryAnalytics(req.auth.userId, selectedDate, timezone);
  res.set("Cache-Control", "no-store");
  res.json(history);
}

async function getLifetime(req, res) {
  const timezone = getTimezone(req.query);
  const lifetime = await getLifetimeAnalytics(req.auth.userId, timezone);
  res.set("Cache-Control", "no-store");
  res.json(lifetime);
}

module.exports = { getDashboard, getHistory, getLifetime, getOverview };
