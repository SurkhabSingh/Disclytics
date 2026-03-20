const cron = require("node-cron");

const { jobEnv } = require("../config/jobEnv");
const { pool } = require("../db/pool");
const { refreshRollingDailyStats } = require("../services/dailyStats.service");
const { dispatchDueReminders } = require("../services/reminder.service");

const JOB_LOCKS = Object.freeze({
  aggregateDailyStats: 8_101,
  dispatchReminders: 8_102
});

function createLockedJob(jobName, job, logger) {
  let isRunning = false;

  return async function runLockedJob() {
    if (isRunning) {
      logger.warn("Skipped overlapping in-process job execution", {
        jobName
      });
      return;
    }

    isRunning = true;

    try {
      await withAdvisoryLock(JOB_LOCKS[jobName], logger, jobName, job);
    } catch (error) {
      logger.error("Scheduled job failed", {
        error,
        jobName
      });
    } finally {
      isRunning = false;
    }
  };
}

async function withAdvisoryLock(lockId, logger, jobName, job) {
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [lockId]
    );

    if (!rows[0].locked) {
      logger.info("Skipped job because advisory lock is held elsewhere", {
        jobName,
        lockId
      });
      return;
    }

    try {
      logger.info("Starting scheduled job", {
        jobName,
        lockId
      });
      await job();
      logger.info("Scheduled job completed", {
        jobName,
        lockId
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    }
  } finally {
    client.release();
  }
}

function startJobs(logger) {
  const refreshStats = createLockedJob("aggregateDailyStats", refreshRollingDailyStats, logger);
  const sendReminders = createLockedJob("dispatchReminders", dispatchDueReminders, logger);

  const refreshStatsTask = cron.schedule("*/15 * * * *", refreshStats, {
    timezone: jobEnv.CRON_TIMEZONE
  });

  const sendRemindersTask = cron.schedule("* * * * *", sendReminders, {
    timezone: jobEnv.CRON_TIMEZONE
  });

  refreshStats().catch((error) => {
    logger.error("Initial stats refresh failed", {
      error
    });
  });
  sendReminders().catch((error) => {
    logger.error("Initial reminder dispatch failed", {
      error
    });
  });

  return {
    stop() {
      refreshStatsTask.stop();
      sendRemindersTask.stop();
    }
  };
}

module.exports = { startJobs };
