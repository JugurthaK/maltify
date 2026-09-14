import type { Severity } from "../db/schema.js";
import type { SarifResult, SarifRule } from "./types.js";

export function severityFromCvss(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "info";
}

export function severityFromSarifLevel(level: string | undefined): Severity {
  switch (level) {
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "note":
      return "low";
    default:
      return "info";
  }
}

/** Reads rule.properties["security-severity"] (a CVSS-style 0-10 score). */
export function securitySeverityOf(rule: SarifRule | undefined): Severity | null {
  const raw = rule?.properties?.["security-severity"];
  if (raw === undefined || raw === null) return null;
  const score = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (Number.isNaN(score)) return null;
  return severityFromCvss(score);
}

const SEVERITY_TAGS: Record<string, Severity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
  informational: "info",
};

/** Trivy tags results with e.g. "CRITICAL" in rule properties.tags. */
export function severityFromTags(rule: SarifRule | undefined): Severity | null {
  for (const tag of rule?.properties?.tags ?? []) {
    const mapped = SEVERITY_TAGS[tag.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

/** Opengrep/semgrep severity in result or rule properties (ERROR/WARNING/INFO). */
export function severityFromSemgrep(
  result: SarifResult,
  rule: SarifRule | undefined,
): Severity | null {
  const raw =
    (result.properties?.["severity"] as string | undefined) ??
    (rule?.properties?.["severity"] as string | undefined);
  switch (raw?.toUpperCase()) {
    case "ERROR":
    case "CRITICAL":
      return "high";
    case "WARNING":
      return "medium";
    case "INFO":
      return "low";
    default:
      return null;
  }
}
