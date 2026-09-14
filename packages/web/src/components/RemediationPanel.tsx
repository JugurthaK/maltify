import type { RemediationRow } from "../api";
import { PatchViewer } from "./PatchViewer";

const STATUS_TEXT: Record<RemediationRow["status"], string> = {
  generating: "Generating fix with LLM…",
  patch_ready: "Patch generated — opening pull request…",
  branch_pushed: "Branch pushed — opening pull request…",
  pr_opened: "Pull request opened",
  failed: "Remediation failed",
};

export function RemediationPanel({ remediation }: { remediation: RemediationRow }) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4 text-sm">
      <div className="flex items-center gap-3">
        <span
          className={`font-semibold ${
            remediation.status === "pr_opened"
              ? "text-good"
              : remediation.status === "failed"
                ? "text-sev-critical"
                : "text-accent"
          }`}
        >
          {STATUS_TEXT[remediation.status]}
        </span>
        {remediation.model && (
          <span className="ml-auto text-xs text-ink-3">{remediation.model}</span>
        )}
      </div>
      {remediation.prUrl && (
        <p className="mt-2">
          <a
            href={remediation.prUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            {remediation.prUrl}
          </a>
          {remediation.usedFork && (
            <span className="ml-2 text-xs text-ink-3">
              via fork {remediation.forkFullName}
            </span>
          )}
        </p>
      )}
      {remediation.explanation && (
        <p className="mt-2 whitespace-pre-wrap text-ink-2">{remediation.explanation}</p>
      )}
      {remediation.error && (
        <p className="mt-2 text-xs text-sev-critical">{remediation.error}</p>
      )}
      {remediation.patchDiff && (
        <div className="mt-3">
          <PatchViewer diff={remediation.patchDiff} />
        </div>
      )}
    </div>
  );
}
