const { getRequestContext } = require("./requestContext");

const LEVEL_VALUES = Object.freeze({
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
});

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause ? serializeError(error.cause) : undefined
  };
}

function normalizeLevel(level) {
  return LEVEL_VALUES[level] ? level : "info";
}

function createLogger({ service, level = process.env.LOG_LEVEL || "info", bindings = {} }) {
  const currentLevel = normalizeLevel(level);
  const threshold = LEVEL_VALUES[currentLevel];

  function write(levelName, message, context = {}) {
    if (LEVEL_VALUES[levelName] < threshold) {
      return;
    }

    const runtimeContext = getRequestContext();
    const payload = {
      timestamp: new Date().toISOString(),
      level: levelName,
      service,
      pid: process.pid,
      ...bindings,
      ...runtimeContext,
      msg: message
    };

    Object.entries(context).forEach(([key, value]) => {
      payload[key] = value instanceof Error ? serializeError(value) : value;
    });

    const serialized = JSON.stringify(payload);

    if (LEVEL_VALUES[levelName] >= LEVEL_VALUES.error) {
      process.stderr.write(`${serialized}\n`);
      return;
    }

    process.stdout.write(`${serialized}\n`);
  }

  return {
    child(childBindings = {}) {
      return createLogger({
        service,
        level: currentLevel,
        bindings: {
          ...bindings,
          ...childBindings
        }
      });
    },
    trace(message, context) {
      write("trace", message, context);
    },
    debug(message, context) {
      write("debug", message, context);
    },
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
    error(message, context) {
      write("error", message, context);
    },
    fatal(message, context) {
      write("fatal", message, context);
    }
  };
}

module.exports = {
  createLogger,
  serializeError
};
