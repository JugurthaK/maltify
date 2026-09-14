import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { nowIso } from "../db/client.js";
import { findings, scans } from "../db/schema.js";
import type { NormalizedFinding } from "../sarif/normalize.js";

export interface ReconcileResult {
  new: number;
  open: number;
  reopened: number;
  resolved: number;
  totalOpen: number;
}

/**
 * Upsert this scan's findings against the repo's existing rows and resolve
 * anything no longer reported. Runs in one transaction; finding identity is
 * (repo_id, fingerprint), so qualifications/remediations survive re-scans.
 */
export function reconcileFindings(
  db: Db,
  repoId: number,
  scanId: number,
  incoming: NormalizedFinding[],
): ReconcileResult {
  return db.transaction((tx) => {
    const now = nowIso();
    const counts = { new: 0, open: 0, reopened: 0 };

    for (const nf of incoming) {
      const existing = tx
        .select({ id: findings.id, status: findings.status })
        .from(findings)
        .where(
          and(eq(findings.repoId, repoId), eq(findings.fingerprint, nf.fingerprint)),
        )
        .get();

      if (!existing) {
        tx.insert(findings)
          .values({
            repoId,
            fingerprint: nf.fingerprint,
            scanner: nf.scanner,
            category: nf.category,
            ruleId: nf.ruleId,
            message: nf.message,
            severity: nf.severity,
            filePath: nf.filePath,
            startLine: nf.startLine,
            endLine: nf.endLine,
            snippet: nf.snippet,
            status: "new",
            firstSeenScanId: scanId,
            lastSeenScanId: scanId,
            rawSarif: JSON.stringify(nf.raw),
            createdAt: now,
            updatedAt: now,
          })
          .run();
        counts.new++;
      } else {
        const nextStatus = existing.status === "resolved" ? "reopened" : "open";
        if (nextStatus === "reopened") counts.reopened++;
        else counts.open++;
        tx.update(findings)
          .set({
            status: nextStatus,
            severity: nf.severity,
            message: nf.message,
            filePath: nf.filePath,
            startLine: nf.startLine,
            endLine: nf.endLine,
            snippet: nf.snippet,
            lastSeenScanId: scanId,
            resolvedAt: null,
            rawSarif: JSON.stringify(nf.raw),
            updatedAt: now,
          })
          .where(eq(findings.id, existing.id))
          .run();
      }
    }

    // Anything not seen by this scan is resolved.
    const resolvedRows = tx
      .update(findings)
      .set({ status: "resolved", resolvedAt: now, updatedAt: now })
      .where(
        and(
          eq(findings.repoId, repoId),
          ne(findings.lastSeenScanId, scanId),
          inArray(findings.status, ["new", "open", "reopened"]),
        ),
      )
      .run();

    const totalOpen = tx
      .select({ count: sql<number>`count(*)` })
      .from(findings)
      .where(
        and(
          eq(findings.repoId, repoId),
          inArray(findings.status, ["new", "open", "reopened"]),
        ),
      )
      .get()!.count;

    tx.update(scans)
      .set({
        countsNew: counts.new,
        countsResolved: resolvedRows.changes,
        countsOpen: totalOpen,
      })
      .where(eq(scans.id, scanId))
      .run();

    return { ...counts, resolved: resolvedRows.changes, totalOpen };
  });
}
