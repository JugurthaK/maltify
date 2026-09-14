import type { FindingStatus, Qualification, Severity } from "../api";

const SEV_COLORS: Record<Severity, string> = {
  critical: "var(--sev-critical)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
  info: "var(--sev-info)",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: SEV_COLORS[severity],
        border: `1px solid color-mix(in oklab, ${SEV_COLORS[severity]} 45%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: SEV_COLORS[severity] }}
      />
      {severity}
    </span>
  );
}

const STATUS_LABELS: Record<FindingStatus, { label: string; cls: string }> = {
  new: { label: "new", cls: "text-sev-high" },
  open: { label: "open", cls: "text-ink-2" },
  reopened: { label: "reopened", cls: "text-sev-medium" },
  resolved: { label: "resolved", cls: "text-good" },
};

export function StatusBadge({ status }: { status: FindingStatus }) {
  const { label, cls } = STATUS_LABELS[status];
  return (
    <span className={`rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

const QUAL_LABELS: Record<Qualification, { label: string; cls: string }> = {
  unqualified: { label: "—", cls: "text-ink-3" },
  qualifying: { label: "qualifying…", cls: "text-accent animate-pulse" },
  true_positive: { label: "true positive", cls: "text-sev-critical" },
  false_positive: { label: "false positive", cls: "text-good" },
  needs_review: { label: "needs review", cls: "text-sev-medium" },
};

export function QualificationBadge({ qualification }: { qualification: Qualification }) {
  const { label, cls } = QUAL_LABELS[qualification];
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}
