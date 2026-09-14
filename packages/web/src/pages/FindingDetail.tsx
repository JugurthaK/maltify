import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { QualificationBadge, SeverityBadge, StatusBadge } from "../components/Badges";
import { QualifyPanel } from "../components/QualifyPanel";
import { RemediationPanel } from "../components/RemediationPanel";

export default function FindingDetailPage() {
  const { id } = useParams();
  const findingId = Number(id);
  const queryClient = useQueryClient();
  const [showRaw, setShowRaw] = useState(false);

  const { data: finding } = useQuery({
    queryKey: ["finding", findingId],
    queryFn: () => api.finding(findingId),
    // Poll while an LLM action is running so verdicts/PRs appear live.
    refetchInterval: (query) => {
      const f = query.state.data;
      if (!f) return false;
      const busy =
        f.qualification === "qualifying" ||
        f.qualifications.some((q) => q.status === "running") ||
        f.remediations.some((r) =>
          ["generating", "patch_ready", "branch_pushed"].includes(r.status),
        );
      return busy ? 2000 : false;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
  const qualify = useMutation({
    mutationFn: () => api.qualify(findingId),
    onSuccess: invalidate,
  });
  const remediate = useMutation({
    mutationFn: () => api.remediate(findingId),
    onSuccess: invalidate,
  });

  if (!finding) return <p className="py-10 text-center text-ink-3">Loading…</p>;

  const latestQual = finding.qualifications[0];
  const latestRemed = finding.remediations[0];
  const busy =
    finding.qualification === "qualifying" ||
    latestQual?.status === "running" ||
    (latestRemed && ["generating", "patch_ready", "branch_pushed"].includes(latestRemed.status));
  const canRemediate =
    finding.qualification === "true_positive" && !busy;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/findings" className="text-sm text-ink-3 hover:text-ink">
          ← findings
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-surface-1 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
          <QualificationBadge qualification={finding.qualification} />
          <span className="ml-auto text-xs text-ink-3">
            {finding.scanner} · {finding.category} · finding #{finding.id}
          </span>
        </div>
        <h1 className="mono mt-3 text-lg font-semibold">{finding.ruleId}</h1>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{finding.message}</p>
        <p className="mono mt-3 text-sm text-ink-2">
          {finding.repo?.fullName} — {finding.filePath}
          {finding.startLine ? `:${finding.startLine}` : ""}
        </p>
        {finding.snippet && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs text-ink-2">
            {finding.snippet}
          </pre>
        )}
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="mt-3 text-xs text-ink-3 underline hover:text-ink"
        >
          {showRaw ? "hide" : "show"} raw SARIF
        </button>
        {showRaw && finding.rawSarif && (
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-surface-2 p-3 text-xs text-ink-3">
            {JSON.stringify(JSON.parse(finding.rawSarif), null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => qualify.mutate()}
          disabled={!!busy || qualify.isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {finding.qualifications.length > 0 ? "Re-qualify with LLM" : "Qualify with LLM"}
        </button>
        <button
          onClick={() => remediate.mutate()}
          disabled={!canRemediate || remediate.isPending}
          title={
            finding.qualification !== "true_positive"
              ? "Qualify as true positive first"
              : undefined
          }
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          Create fix PR
        </button>
      </div>
      {(qualify.error || remediate.error) && (
        <p className="text-sm text-sev-critical">
          {String(qualify.error ?? remediate.error)}
        </p>
      )}

      {latestQual && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-2">LLM triage</h2>
          <QualifyPanel qualification={latestQual} />
        </section>
      )}

      {latestRemed && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-2">Remediation</h2>
          <RemediationPanel remediation={latestRemed} />
        </section>
      )}
    </div>
  );
}
