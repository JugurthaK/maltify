import type { QualificationRow } from "../api";

export function QualifyPanel({ qualification }: { qualification: QualificationRow }) {
  if (qualification.status === "running") {
    return (
      <div className="rounded-lg border border-line bg-surface-1 p-4 text-sm text-accent">
        LLM triage in progress…
      </div>
    );
  }
  if (qualification.status === "failed") {
    return (
      <div className="rounded-lg border border-line bg-surface-1 p-4 text-sm">
        <p className="text-sev-critical">Qualification failed</p>
        {qualification.error && (
          <p className="mt-1 text-xs text-ink-3">{qualification.error}</p>
        )}
      </div>
    );
  }
  const verdictCls =
    qualification.verdict === "true_positive"
      ? "text-sev-critical"
      : qualification.verdict === "false_positive"
        ? "text-good"
        : "text-sev-medium";
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4 text-sm">
      <div className="flex items-center gap-3">
        <span className={`font-semibold ${verdictCls}`}>
          {qualification.verdict?.replace("_", " ")}
        </span>
        {qualification.confidence !== null && (
          <span className="text-xs text-ink-3">
            confidence {(qualification.confidence * 100).toFixed(0)}%
          </span>
        )}
        {qualification.model && (
          <span className="ml-auto text-xs text-ink-3">{qualification.model}</span>
        )}
      </div>
      {qualification.reasoning && (
        <p className="mt-2 whitespace-pre-wrap text-ink-2">{qualification.reasoning}</p>
      )}
      {qualification.exploitScenario && (
        <div className="mt-3 rounded-md bg-surface-2 p-3">
          <p className="text-xs font-medium text-sev-high">Exploit scenario</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-ink-2">
            {qualification.exploitScenario}
          </p>
        </div>
      )}
    </div>
  );
}
