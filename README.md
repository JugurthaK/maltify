# maltify

Security scanning for GitHub repositories with LLM-assisted triage.

Maltify scans any GitHub repo (passed as a parameter — nothing is installed in
target repos) using a GitHub Actions pipeline, stores deduplicated findings in
a local SQLite database, and gives you a web UI to browse them, qualify each
finding with an LLM (true positive vs false positive), and open automated fix
pull requests for confirmed issues.

```
maltify scan owner/repo
   └─ dispatches .github/workflows/scan.yml (in THIS repo) with the target as input
        ├─ Opengrep  → SAST          → SARIF artifact
        ├─ Trivy     → SCA + IaC     → SARIF artifact
        └─ GitLeaks  → secrets (full git history) → SARIF artifact
   └─ downloads artifacts, normalizes SARIF, upserts findings into SQLite

maltify serve
   └─ web UI: dashboards, filterable findings, per-finding LLM triage
        Qualify → LLM verdict (true/false positive + reasoning)
        Remediate → LLM patch → branch + PR on the target repo
                    (direct push if you have write access, fork fallback otherwise)
```

## Architecture

- **`packages/core`** — shared library: SQLite schema (drizzle + better-sqlite3),
  SARIF parsing/normalization, finding fingerprinting & re-scan reconciliation,
  GitHub API (workflow dispatch, artifact download, PR creation), LLM
  qualification & remediation (provider-agnostic via the Vercel AI SDK).
- **`packages/cli`** — the `maltify` command (commander).
- **`packages/server`** — Fastify API, serves the built web UI.
- **`packages/web`** — Vite + React frontend (TanStack Query, Recharts).
- **`.github/workflows/scan.yml`** — the scan pipeline. Lives in this repo;
  takes `target_repo` / `target_ref` / `correlation_id` as inputs.

Findings are fingerprinted (SARIF `partialFingerprints` when present, else a
line-number-independent hash of scanner + rule + path + snippet; package-based
identity for dependency CVEs) so re-scans update existing rows and track status
transitions: `new → open → resolved → reopened`. Qualifications and
remediations survive re-scans.

## Setup

Prereqs: Node 22+, pnpm, a GitHub account.

1. **Install and build**

   ```sh
   pnpm install
   pnpm build
   ```

2. **Push this repo to GitHub** — the scan workflow runs there:

   ```sh
   gh repo create <you>/maltify --private --source=. --push
   ```

3. **Configure `.env`** (copy `.env.example`):

   - `GITHUB_TOKEN` — classic PAT with `repo` + `workflow` scopes
   - `MALTIFY_REPO` — `<you>/maltify` (where scan.yml lives)
   - `LLM_PROVIDER` / `LLM_MODEL` — default `anthropic` / `claude-opus-5`
   - `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` with `LLM_PROVIDER=openai`)

4. **(Private targets only)** add a repo secret `TARGET_REPO_TOKEN` in the
   maltify GitHub repo: a PAT that can read the private target repos.

## Usage

```sh
pnpm maltify scan owner/repo        # dispatch a scan, wait, ingest findings
pnpm maltify list --severity high   # query findings from the terminal
pnpm maltify repos                  # scanned repos + open counts
pnpm maltify serve                  # web UI at http://localhost:8790

# LLM triage (also available from the web UI)
pnpm maltify qualify <finding-id>
pnpm maltify remediate <finding-id> # generates a fix and opens a PR
```

For development: `pnpm --filter @maltify/server dev` (API) and
`pnpm --filter @maltify/web dev` (frontend with proxy) in two terminals.

## Scan from your own CI (composite action)

Instead of central dispatch, any repo can run the same scanners in its own
workflow and push results to a hosted maltify backend:

```yaml
# .github/workflows/maltify.yml in the target repo
name: maltify
on: [push]
jobs:
  maltify:
    runs-on: ubuntu-latest # required (docker is used for GitLeaks)
    concurrency: maltify-${{ github.ref }} # avoid out-of-order ingests
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # full history so GitLeaks can scan past commits
      - uses: <you>/maltify/action@v1
        with:
          api_url: https://your-maltify.example.com
          api_token: ${{ secrets.MALTIFY_INGEST_TOKEN }}
          # scanners: opengrep,trivy,gitleaks   # optional subset
          # fail_on: high    # fail the job on NEW findings >= this severity
```

Set the `MALTIFY_INGEST_TOKEN` secret in the consumer repo to the same value
as the server's `MALTIFY_INGEST_TOKEN` env var. Scans ingested this way show
up with an `action` badge; central-dispatch scans show `dispatch`.

Caveat: prefer one mode (action OR dispatch) per repo — opengrep's SARIF
fingerprints can embed the scanned path, which differs between modes, so
mixing them may double-count the same finding.

## Hosting the backend

The server is a single Node process with a SQLite file — deploy it anywhere
with a persistent volume. A multi-stage `Dockerfile` is included:

```sh
docker build -t maltify .
docker run -p 8790:8790 -v maltify-data:/data \
  -e MALTIFY_API_TOKEN=$(openssl rand -hex 32) \
  -e MALTIFY_INGEST_TOKEN=$(openssl rand -hex 32) \
  maltify
```

- `MALTIFY_API_TOKEN` protects the UI and all API routes (the web app shows a
  login screen asking for it). `MALTIFY_INGEST_TOKEN` protects `POST
  /api/ingest`. Leave both unset for a local, open instance.
- Health check endpoint: `GET /api/health` (public).
- Fly.io: `fly launch --no-deploy`, `fly volumes create maltify_data`, mount
  it at `/data` in fly.toml (`internal_port = 8790`), then
  `fly secrets set MALTIFY_API_TOKEN=... MALTIFY_INGEST_TOKEN=...`.
- To use qualify/remediate/rescan on the hosted instance, also set
  `GITHUB_TOKEN`, `MALTIFY_REPO`, and your LLM key there; without them the
  instance is ingest + dashboard only.
- SQLite means one machine — do not scale horizontally.
- Token changes require a server restart (env is read at startup).

## Testing with the fixture repo

`fixtures/maltify-fixture/` is a deliberately vulnerable mini-app (SQLi, XSS,
vulnerable lodash, root Dockerfile, public S3 bucket, an AWS key committed and
then deleted so it only exists in git history, and a false-positive-shaped
snippet in a test file).

```sh
cd fixtures/maltify-fixture && ./setup.sh
cd repo && gh repo create <you>/maltify-fixture --private --source=. --push
pnpm maltify scan <you>/maltify-fixture
```

Expected: scan twice → all findings go `new` → `open`; fix one and re-scan →
it becomes `resolved`. Qualifying the test-file finding should yield
`false_positive`; the SQLi in `src/server.js` should yield `true_positive`.

## Notes

- Remediation PRs replace whole files (the LLM returns full file contents; the
  diff shown in the UI is computed locally). Review before merging.
- A leaked-secret fix PR removes the secret from code, but the credential must
  still be rotated — the PR body says so.
- Fine-grained PATs don't work for the fork-based PR path; use a classic PAT.
