export function PatchViewer({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-surface-1 p-4 text-xs leading-5">
      {lines.map((line, i) => {
        let cls = "text-ink-2";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-good";
        else if (line.startsWith("-") && !line.startsWith("---"))
          cls = "text-sev-critical";
        else if (line.startsWith("@@")) cls = "text-accent";
        else if (
          line.startsWith("+++") ||
          line.startsWith("---") ||
          line.startsWith("Index:") ||
          line.startsWith("====")
        )
          cls = "text-ink-3";
        return (
          <span key={i} className={`block ${cls}`}>
            {line || " "}
          </span>
        );
      })}
    </pre>
  );
}
