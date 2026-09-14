import { readFileSync } from "node:fs";
import type { SarifLog } from "./types.js";

export function parseSarifFile(path: string): SarifLog {
  const raw = readFileSync(path, "utf8");
  return parseSarif(raw);
}

export function parseSarif(raw: string): SarifLog {
  const log = JSON.parse(raw) as SarifLog;
  if (!log.runs || !Array.isArray(log.runs)) {
    throw new Error("Not a SARIF log: missing runs[]");
  }
  return log;
}
