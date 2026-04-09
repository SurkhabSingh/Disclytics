const path = require("node:path");
const { spawn } = require("node:child_process");

const { createLogger } = require("@analytics-platform/runtime");

const ROOT_DIR = path.resolve(__dirname, "..");
const RESTART_BASE_DELAY_MS = 2_000;
const RESTART_MAX_DELAY_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const STABLE_UPTIME_MS = 60_000;

const logger = createLogger({
  service: "backend-supervisor",
  level: process.env.LOG_LEVEL || "info"
});

const SERVICES = [
  {
    name: "api",
    cwd: "apps/api",
    entry: "src/server.js"
  },
  {
    name: "bot",
    cwd: "apps/bot",
    entry: "src/index.js"
  },
  {
    name: "worker",
    cwd: "apps/worker",
    entry: "src/index.js"
  }
];

const stateByService = new Map();
let shuttingDown = false;
let shutdownTimer = null;

function getRestartDelayMs(consecutiveFailures) {
  return Math.min(
    RESTART_MAX_DELAY_MS,
    RESTART_BASE_DELAY_MS * Math.max(1, consecutiveFailures)
  );
}

function ensureState(serviceName) {
  if (!stateByService.has(serviceName)) {
    stateByService.set(serviceName, {
      child: null,
      consecutiveFailures: 0,
      restartTimer: null,
      startedAt: null
    });
  }

  return stateByService.get(serviceName);
}

function clearRestartTimer(serviceState) {
  if (!serviceState.restartTimer) {
    return;
  }

  clearTimeout(serviceState.restartTimer);
  serviceState.restartTimer = null;
}

function startService(service) {
  const serviceState = ensureState(service.name);
  clearRestartTimer(serviceState);

  logger.info("Starting backend child service", {
    childService: service.name,
    cwd: service.cwd,
    entry: service.entry
  });

  const child = spawn(process.execPath, [service.entry], {
    cwd: path.join(ROOT_DIR, service.cwd),
    env: process.env,
    stdio: "inherit"
  });

  serviceState.child = child;
  serviceState.startedAt = Date.now();

  child.on("error", (error) => {
    logger.error("Failed to spawn backend child service", {
      childService: service.name,
      error
    });
  });

  child.on("exit", (code, signal) => {
    const uptimeMs = serviceState.startedAt ? Date.now() - serviceState.startedAt : 0;
    serviceState.child = null;
    serviceState.startedAt = null;

    if (shuttingDown) {
      logger.info("Backend child service stopped during shutdown", {
        childService: service.name,
        code,
        signal
      });
      return;
    }

    serviceState.consecutiveFailures = uptimeMs >= STABLE_UPTIME_MS
      ? 0
      : serviceState.consecutiveFailures + 1;

    const restartDelayMs = getRestartDelayMs(serviceState.consecutiveFailures);
    logger.warn("Backend child service exited unexpectedly; scheduling restart", {
      childService: service.name,
      code,
      signal,
      uptimeMs,
      restartDelayMs
    });

    serviceState.restartTimer = setTimeout(() => {
      serviceState.restartTimer = null;
      startService(service);
    }, restartDelayMs);
  });
}

function terminateChildren(signalName) {
  for (const service of SERVICES) {
    const serviceState = ensureState(service.name);
    clearRestartTimer(serviceState);

    if (!serviceState.child || serviceState.child.killed) {
      continue;
    }

    logger.info("Stopping backend child service", {
      childService: service.name,
      signal: signalName
    });
    serviceState.child.kill(signalName);
  }
}

function shutdown(signalName) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.warn("Shutting down combined backend service", {
    signal: signalName
  });

  terminateChildren("SIGTERM");

  shutdownTimer = setTimeout(() => {
    logger.error("Forcing shutdown for remaining backend child services", {
      timeoutMs: SHUTDOWN_TIMEOUT_MS
    });
    terminateChildren("SIGKILL");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  const intervalId = setInterval(() => {
    const activeChildren = SERVICES.filter((service) => ensureState(service.name).child);

    if (activeChildren.length > 0) {
      return;
    }

    clearInterval(intervalId);

    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }

    logger.info("Combined backend service stopped cleanly");
    process.exit(0);
  }, 250);
}

logger.info("Starting combined backend service", {
  services: SERVICES.map((service) => service.name)
});

for (const service of SERVICES) {
  startService(service);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
