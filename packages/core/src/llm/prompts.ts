import type { Finding, Repo } from "../db/schema.js";

export const QUALIFY_SYSTEM = `You are a senior application security engineer triaging static-analysis findings.

Decide whether each finding is a true positive (a real, relevant security issue) or a false positive in the context of the actual code you are shown. Be decisive: reserve needs_review for cases where the provided context is genuinely insufficient.

Common false-positive patterns to check for:
- The flagged code is in tests, fixtures, examples, or documentation
- Input is already sanitized, validated, or parameterized before reaching the sink
- The "vulnerable" configuration is unreachable, dev-only, or intentionally permissive
- The secret is a placeholder, example, or dummy value
- The vulnerable dependency's affected code path is not used (only claim this if visible)

Common true-positive confirmations:
- Untrusted input reaches a dangerous sink without effective sanitization
- A real credential (structurally valid, not a placeholder) is committed
- The vulnerable dependency version is actually resolved by the lockfile
- The misconfiguration applies to production infrastructure

Ground your reasoning in the provided code — cite file paths and line numbers.`;

export function buildQualifyPrompt(
  finding: Finding,
  repo: Repo,
  contextText: string,
): string {
  return `Triage this static-analysis finding.

## Finding
- Repository: ${repo.fullName}
- Scanner: ${finding.scanner} (category: ${finding.category})
- Rule: ${finding.ruleId}
- Severity (scanner-reported): ${finding.severity}
- Location: ${finding.filePath}${finding.startLine ? `:${finding.startLine}` : ""}
- Message: ${finding.message}
${finding.snippet ? `- Flagged snippet:\n\`\`\`\n${finding.snippet}\n\`\`\`` : ""}

## Code context
Lines marked with >>> are the flagged region.

${contextText}`;
}

export const REMEDIATE_SYSTEM = `You are a senior software engineer writing a minimal security fix.

Rules:
- Make the smallest change that fully resolves the security issue.
- Preserve the file's existing formatting, style, and behavior. No drive-by refactors, no reformatting, no unrelated changes.
- Return the COMPLETE new content of every file you change — not a diff, not an excerpt.
- For leaked secrets: remove the secret from the code, read it from an environment variable instead (e.g. process.env.MY_SECRET or the language's equivalent), and set rotation_required to true — a code change alone cannot un-leak a credential.
- For vulnerable dependencies: update the version constraint in the manifest to the nearest fixed version.
- For SAST findings: fix the root cause (e.g. parameterize the query, escape the output, validate the input), not just the symptom.`;

export function buildRemediatePrompt(
  finding: Finding,
  repo: Repo,
  qualificationReasoning: string | null,
  contextText: string,
): string {
  return `Write a fix for this confirmed security finding.

## Finding
- Repository: ${repo.fullName}
- Scanner: ${finding.scanner} (category: ${finding.category})
- Rule: ${finding.ruleId}
- Severity: ${finding.severity}
- Location: ${finding.filePath}${finding.startLine ? `:${finding.startLine}` : ""}
- Message: ${finding.message}
${qualificationReasoning ? `\n## Triage analysis (why this is a true positive)\n${qualificationReasoning}\n` : ""}
## Current code
Lines marked with >>> are the flagged region.

${contextText}`;
}
