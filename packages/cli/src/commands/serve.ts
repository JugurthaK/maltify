import { getLocalConfig } from "@maltify/core";
import { startServer } from "@maltify/server";
import type { Command } from "commander";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the maltify web UI and API")
    .option("--port <port>", "port to listen on")
    .action(async (options: { port?: string }) => {
      const port = options.port ? Number(options.port) : getLocalConfig().port;
      await startServer(port);
      console.log(`maltify UI running at http://localhost:${port}`);
    });
}
