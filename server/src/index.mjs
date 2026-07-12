import { createHttpServerAsync } from "./httpServer.mjs";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const { server, store } = await createHttpServerAsync();

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Mirage server received ${signal}, shutting down`);
  const forceExit = setTimeout(() => {
    console.error("Mirage server shutdown timed out");
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS || 10_000));
  forceExit.unref();
  server.close(async () => {
    try {
      await store.close?.();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

server.listen(port, host, () => {
  console.log(`Mirage server listening on http://${host}:${port}`);
});
