function registerGracefulShutdown({ logger, name, cleanup, timeoutMs = 15_000 }) {
  let shuttingDown = false;

  async function handle(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("Shutdown requested", {
      signal,
      target: name
    });

    const timeout = setTimeout(() => {
      logger.error("Shutdown timed out, forcing exit", {
        signal,
        target: name,
        timeoutMs
      });
      process.exit(1);
    }, timeoutMs);

    try {
      await cleanup(signal);
      clearTimeout(timeout);
      logger.info("Shutdown complete", {
        signal,
        target: name
      });
      process.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      logger.error("Shutdown failed", {
        error,
        signal,
        target: name
      });
      process.exit(1);
    }
  }

  process.once("SIGINT", () => {
    handle("SIGINT").catch(() => process.exit(1));
  });
  process.once("SIGTERM", () => {
    handle("SIGTERM").catch(() => process.exit(1));
  });
}

module.exports = {
  registerGracefulShutdown
};
