export { buildApp, startServer } from "./app.js";

// Standalone entry: `tsx src/index.ts` starts the server directly.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { getLocalConfig } = await import("@maltify/core");
  const { startServer } = await import("./app.js");
  const { port } = getLocalConfig();
  await startServer(port);
  console.log(`maltify API running at http://localhost:${port}`);
}
