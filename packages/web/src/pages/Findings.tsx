import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { FindingsTable } from "../components/FindingsTable";

const FILTERS: { key: string; label: string; values: string[] }[] = [
  { key: "severity", label: "Severity", values: ["critical", "high", "medium", "low", "info"] },
  { key: "scanner", label: "Scanner", values: ["opengrep", "trivy", "gitleaks"] },
  { key: "category", label: "Category", values: ["sast", "sca", "iac", "secret"] },
  { key: "status", label: "Status", values: ["new", "open", "reopened", "resolved"] },
  {
    key: "qualification",
    label: "Triage",
    values: ["unqualified", "true_positive", "false_positive", "needs_review"],
  },
];

export default function Findings() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const { data: repos } = useQuery({ queryKey: ["repos"], queryFn: () => api.repos() });

  const queryParams: Record<string, string> = { page: String(page), page_size: "50" };
  for (const f of FILTERS) {
    const v = params.get(f.key);
    if (v) queryParams[f.key] = v;
  }
  if (params.get("repo_id")) queryParams.repo_id = params.get("repo_id")!;
  if (params.get("scan_id")) queryParams.scan_id = params.get("scan_id")!;

  const { data, isLoading } = useQuery({
    queryKey: ["findings", queryParams],
    queryFn: () => api.findings(queryParams),
  });

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={params.get("repo_id") ?? ""}
          onChange={(e) => {
            // A scan belongs to one repo — changing repo clears the scan filter.
            const next = new URLSearchParams(params);
            if (e.target.value) next.set("repo_id", e.target.value);
            else next.delete("repo_id");
            next.delete("scan_id");
            next.delete("page");
            setParams(next);
          }}
          className="rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink-2"
        >
          <option value="">Repository: all</option>
          {repos?.map((r) => (
            <option key={r.id} value={String(r.id)}>
              Repository: {r.fullName}
            </option>
          ))}
        </select>
        {params.get("scan_id") && (
          <span className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink-2">
            scan #{params.get("scan_id")}
            <button
              onClick={() => setFilter("scan_id", null)}
              className="text-ink-3 hover:text-ink"
              title="Clear scan filter"
            >
              ✕
            </button>
          </span>
        )}
        {FILTERS.map((f) => (
          <select
            key={f.key}
            value={params.get(f.key) ?? ""}
            onChange={(e) => setFilter(f.key, e.target.value || null)}
            className="rounded-md border border-line bg-surface-1 px-2 py-1.5 text-sm text-ink-2"
          >
            <option value="">{f.label}: all</option>
            {f.values.map((v) => (
              <option key={v} value={v}>
                {f.label}: {v.replace("_", " ")}
              </option>
            ))}
          </select>
        ))}
        {[...params.keys()].some((k) => k !== "page") && (
          <button
            onClick={() => setParams(new URLSearchParams())}
            className="text-sm text-ink-3 underline hover:text-ink"
          >
            clear filters
          </button>
        )}
        {data && (
          <span className="ml-auto text-sm text-ink-3">{data.total} finding(s)</span>
        )}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-ink-3">Loading…</p>
      ) : (
        data && <FindingsTable findings={data.findings} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setFilter("page", String(page - 1))}
            className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-ink-3">
            page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setFilter("page", String(page + 1))}
            className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
