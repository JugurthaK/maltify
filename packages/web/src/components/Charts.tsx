import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatsSummary, TimelinePoint } from "../api";

const AXIS = { fill: "var(--text-muted)", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12,
};

const SEV_COLORS: Record<string, string> = {
  critical: "var(--sev-critical)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
  info: "var(--sev-info)",
};
const SEV_ORDER = ["critical", "high", "medium", "low", "info"];

export function SeverityChart({ data }: { data: StatsSummary["bySeverity"] }) {
  const rows = SEV_ORDER.map((severity) => ({
    severity,
    count: data.find((d) => d.severity === severity)?.count ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis dataKey="severity" tick={AXIS} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" name="Open findings" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {rows.map((row) => (
            <Cell key={row.severity} fill={SEV_COLORS[row.severity]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Categorical slots 1-3 in fixed order: opengrep=blue, trivy=orange, gitleaks=aqua.
const SCANNER_COLORS: Record<string, string> = {
  opengrep: "var(--series-1)",
  trivy: "var(--series-2)",
  gitleaks: "var(--series-3)",
};
const SCANNER_ORDER = ["opengrep", "trivy", "gitleaks"];

export function ScannerChart({ data }: { data: StatsSummary["byScanner"] }) {
  const rows = SCANNER_ORDER.map((scanner) => ({
    scanner,
    count: data.find((d) => d.scanner === scanner)?.count ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis dataKey="scanner" tick={AXIS} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" name="Open findings" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {rows.map((row) => (
            <Cell key={row.scanner} fill={SCANNER_COLORS[row.scanner]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ScanTimeline({ data }: { data: TimelinePoint[] }) {
  const rows = data.map((p) => ({
    scan: `#${p.scanId}`,
    open: p.countsOpen ?? 0,
    new: p.countsNew ?? 0,
    resolved: p.countsResolved ?? 0,
  }));
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-3">No completed scans yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis dataKey="scan" tick={AXIS} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        <Line type="monotone" dataKey="open" name="Open" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="new" name="New" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="resolved" name="Resolved" stroke="var(--series-3)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
