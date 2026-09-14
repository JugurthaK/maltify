import { createHash } from "node:crypto";
import type { Scanner } from "../db/schema.js";
import type { SarifResult } from "./types.js";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Strip the GitHub Actions checkout prefix so paths are repo-relative and
 * stable across runners: "target/src/a.js" -> "src/a.js",
 * "file:///home/runner/work/.../target/src/a.js" -> "src/a.js".
 */
export function normalizePath(uri: string): string {
  let p = uri.replace(/^file:\/\//, "");
  p = p.replace(/^\/?home\/runner\/work\/[^/]+\/[^/]+\//, "");
  p = p.replace(/^\.?\//, "");
  p = p.replace(/^target\//, "");
  return p;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export interface FingerprintInput {
  scanner: Scanner;
  ruleId: string;
  filePath: string; // already normalized
  snippet?: string | null;
  result: SarifResult;
  /** For Trivy SCA results: the vulnerable package name. */
  packageName?: string | null;
}

/**
 * Stable identity for a finding across scans. Line numbers are deliberately
 * excluded so edits elsewhere in a file don't churn identity; for SCA the
 * package version is excluded so a non-fixing version bump keeps the finding.
 */
export function fingerprintFinding(input: FingerprintInput): string {
  const { scanner, ruleId, filePath, snippet, result, packageName } = input;

  const pf = result.partialFingerprints;
  if (pf && Object.keys(pf).length > 0) {
    const joined = Object.keys(pf)
      .sort()
      .map((k) => `${k}=${pf[k]}`)
      .join(",");
    return sha256(`${scanner}|pf|${joined}`);
  }

  if (packageName) {
    return sha256(`${scanner}|pkg|${ruleId}|${packageName}|${filePath}`);
  }

  const snippetHash = snippet ? sha256(collapseWhitespace(snippet)) : "";
  return sha256(`${scanner}|${ruleId}|${filePath}|${snippetHash}`);
}

/**
 * Disambiguate identical fingerprints within one scan (e.g. the same
 * vulnerable line duplicated in a file) with a stable occurrence suffix.
 */
export function dedupeWithinScan<T extends { fingerprint: string }>(
  items: T[],
): T[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = seen.get(item.fingerprint) ?? 0;
    seen.set(item.fingerprint, count + 1);
    return count === 0
      ? item
      : { ...item, fingerprint: `${item.fingerprint}#${count + 1}` };
  });
}
