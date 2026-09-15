// Standalone dev entry: `pnpm --filter @maltify/server dev`
import { getLocalConfig } from "@maltify/core";
import { startServer } from "./app.js";

const { port } = getLocalConfig();
await startServer(port);
console.log(`maltify API running at http://localhost:${port}`);
