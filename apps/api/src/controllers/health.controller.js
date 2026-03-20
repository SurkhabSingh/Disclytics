const { pool } = require("../db/pool");

async function getHealth(req, res) {
  res.json({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString()
  });
}

async function getReadiness(req, res) {
  await pool.query("SELECT 1");

  res.json({
    status: "ready",
    service: "api",
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  getHealth,
  getReadiness
};
