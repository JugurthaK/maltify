import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Workspace packages export raw .ts — bundle them; real npm deps stay external.
  noExternal: ["@maltify/core", "@maltify/server"],
});
