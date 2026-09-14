import { Link } from "react-router-dom";
import type { FindingRow } from "../api";
import { QualificationBadge, SeverityBadge, StatusBadge } from "./Badges";

export function FindingsTable({ findings }: { findings: FindingRow[] }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface-1 p-10 text-center text-ink-3">
        No findings match the current filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-1">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-4 py-2.5 font-medium">Severity</th>
            <th className="px-4 py-2.5 font-medium">Rule</th>
            <th className="px-4 py-2.5 font-medium">Location</th>
            <th className="px-4 py-2.5 font-medium">Repo</th>
            <th className="px-4 py-2.5 font-medium">Scanner</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Triage</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr
              key={f.id}
              className="border-b border-line last:border-b-0 hover:bg-surface-2"
            >
              <td className="px-4 py-2.5">
                <SeverityBadge severity={f.severity} />
              </td>
              <td className="max-w-64 px-4 py-2.5">
                <Link
                  to={`/findings/${f.id}`}
                  className="block truncate font-medium text-ink hover:text-accent"
                  title={f.ruleId}
                >
                  {f.ruleId}
                </Link>
                <span className="block max-w-64 truncate text-xs text-ink-3" title={f.message}>
                  {f.message}
                </span>
              </td>
              <td className="max-w-56 px-4 py-2.5">
                <span className="mono block truncate text-xs text-ink-2" title={f.filePath}>
                  {f.filePath}
                  {f.startLine ? `:${f.startLine}` : ""}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-ink-2">{f.repo}</td>
              <td className="px-4 py-2.5 text-xs text-ink-2">
                {f.scanner}
                <span className="text-ink-3"> · {f.category}</span>
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={f.status} />
              </td>
              <td className="px-4 py-2.5">
                <QualificationBadge qualification={f.qualification} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
