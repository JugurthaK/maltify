import type { Category, Scanner, Severity } from "../db/schema.js";
import {
  dedupeWithinScan,
  fingerprintFinding,
  normalizePath,
} from "./fingerprint.js";
import {
  securitySeverityOf,
  severityFromSarifLevel,
  severityFromSemgrep,
  severityFromTags,
} from "./severity.js";
import type { SarifLog, SarifResult, SarifRule } from "./types.js";

export interface NormalizedFinding {
  scanner: Scanner;
  category: Category;
  fingerprint: string;
  ruleId: string;
  message: string;
  severity: Severity;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
  raw: SarifResult;
}

function ruleFor(
  result: SarifResult,
  rules: SarifRule[] | undefined,
): SarifRule | undefined {
  if (!rules) return undefined;
  if (result.ruleIndex !== undefined) return rules[result.ruleIndex];
  return rules.find((r) => r.id === result.ruleId);
}

function locationOf(result: SarifResult) {
  const phys = result.locations?.[0]?.physicalLocation;
  return {
    filePath: normalizePath(phys?.artifactLocation?.uri ?? "<unknown>"),
    startLine: phys?.region?.startLine ?? null,
    endLine: phys?.region?.endLine ?? phys?.region?.startLine ?? null,
    snippet: phys?.region?.snippet?.text ?? null,
  };
}

function messageOf(result: SarifResult, rule: SarifRule | undefined): string {
  return (
    result.message.text ??
    rule?.shortDescription?.text ??
    rule?.fullDescription?.text ??
    result.ruleId ??
    "(no message)"
  );
}

/** Trivy misconfig rules look like AVD-AWS-0001 / DS002 / KSV001; vulns are CVE-/GHSA-/etc. */
function trivyCategory(ruleId: string): Category {
  if (/^(AVD-|DS\d|KSV|AVD_)/i.test(ruleId)) return "iac";
  if (/^(CVE-|GHSA-|RUSTSEC-|GO-|PYSEC-|NSWG-|OSV-)/i.test(ruleId)) return "sca";
  return "iac";
}

/** Trivy SCA messages embed "Package: <name>" — used for version-independent identity. */
function trivyPackageName(result: SarifResult): string | null {
  const text = result.message.text ?? "";
  const match = text.match(/Package:\s*([^\s\n]+)/);
  return match?.[1] ?? null;
}

export function normalizeSarif(
  log: SarifLog,
  scanner: Scanner,
): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];

  for (const run of log.runs) {
    const rules = run.tool.driver.rules;
    for (const result of run.results ?? []) {
      const rule = ruleFor(result, rules);
      const ruleId = result.ruleId ?? rule?.id ?? "unknown-rule";
      const loc = locationOf(result);

      let category: Category;
      let severity: Severity;
      let packageName: string | null = null;

      switch (scanner) {
        case "opengrep":
          category = "sast";
          severity =
            severityFromSemgrep(result, rule) ??
            securitySeverityOf(rule) ??
            severityFromSarifLevel(result.level ?? rule?.defaultConfiguration?.level);
          break;
        case "trivy":
          category = trivyCategory(ruleId);
          if (category === "sca") packageName = trivyPackageName(result);
          severity =
            securitySeverityOf(rule) ??
            severityFromTags(rule) ??
            severityFromSarifLevel(result.level ?? rule?.defaultConfiguration?.level);
          break;
        case "gitleaks":
          category = "secret";
          severity = "high";
          break;
      }

      findings.push({
        scanner,
        category,
        fingerprint: fingerprintFinding({
          scanner,
          ruleId,
          filePath: loc.filePath,
          snippet: loc.snippet,
          result,
          packageName,
        }),
        ruleId,
        message: messageOf(result, rule).slice(0, 4000),
        severity,
        filePath: loc.filePath,
        startLine: loc.startLine,
        endLine: loc.endLine,
        snippet: loc.snippet,
        raw: result,
      });
    }
  }

  findings.sort(
    (a, b) =>
      a.filePath.localeCompare(b.filePath) ||
      (a.startLine ?? 0) - (b.startLine ?? 0),
  );
  return dedupeWithinScan(findings);
}
