import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { getLocalConfig, openDb, type Db } from "@maltify/core";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerActionRoutes } from "./routes/actions.js";
import { registerFindingRoutes } from "./routes/findings.js";
import { registerRepoRoutes } from "./routes/repos.js";
import { registerScanRoutes } from "./routes/scans.js";
import { registerStatsRoutes } from "./routes/stats.js";

function findWebDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../web/dist"), // from server/src or cli/dist
    resolve(here, "../../../web/dist"), // from server/src/... nested builds
    resolve(process.cwd(), "packages/web/dist"),
  ];
  return candidates.find((c) => existsSync(resolve(c, "index.html"))) ?? null;
}

export function buildApp(db?: Db): FastifyInstance {
  const database = db ?? openDb(getLocalConfig().dbPath);
  const app = Fastify({ logger: false });

  app.register(fastifyCors, { origin: true });

  registerRepoRoutes(app, database);
  registerScanRoutes(app, database);
  registerFindingRoutes(app, database);
  registerStatsRoutes(app, database);
  registerActionRoutes(app, database);

  const webDist = findWebDist();
  if (webDist) {
    app.register(fastifyStatic, { root: webDist });
    // SPA fallback: serve index.html for non-API routes.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        reply.code(404).send({ error: "Not found" });
      } else {
        reply.sendFile("index.html");
      }
    });
  }

  return app;
}

export async function startServer(port: number): Promise<FastifyInstance> {
  const app = buildApp();
  await app.listen({ port, host: "127.0.0.1" });
  return app;
}
