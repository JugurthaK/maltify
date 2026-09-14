import { getOctokit, parseRepoSlug } from "./client.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FileChange {
  path: string;
  newContent: string;
}

export interface CreatedPr {
  prUrl: string;
  prNumber: number;
  branchName: string;
  usedFork: boolean;
  forkFullName: string | null;
}

/**
 * Open a fix PR against `targetRepo`. Pushes the branch directly when the
 * token has write access; otherwise forks and opens a cross-fork PR.
 */
export async function createFixPr(options: {
  targetRepo: string;
  branchName: string;
  files: FileChange[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
  onProgress?: (msg: string) => void;
}): Promise<CreatedPr> {
  const octokit = getOctokit();
  const upstream = parseRepoSlug(options.targetRepo);
  const progress = options.onProgress ?? (() => {});

  const { data: upstreamRepo } = await octokit.rest.repos.get(upstream);
  const baseBranch = upstreamRepo.default_branch;
  const canPush = upstreamRepo.permissions?.push === true;

  let head: { owner: string; repo: string };
  let usedFork = false;
  let forkFullName: string | null = null;

  if (canPush) {
    head = upstream;
    progress(`Write access confirmed — pushing branch directly to ${options.targetRepo}`);
  } else {
    progress(`No write access to ${options.targetRepo} — using fork`);
    const { data: fork } = await octokit.rest.repos.createFork(upstream);
    forkFullName = fork.full_name;
    head = parseRepoSlug(fork.full_name);
    usedFork = true;

    // Fork creation is async: poll until its git data is reachable.
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        await octokit.rest.git.getRef({
          ...head,
          ref: `heads/${fork.default_branch ?? baseBranch}`,
        });
        ready = true;
        break;
      } catch {
        await sleep(3000);
      }
    }
    if (!ready) throw new Error(`Fork ${fork.full_name} not ready after 60s`);

    // A pre-existing stale fork must be synced to upstream HEAD first.
    try {
      await octokit.rest.repos.mergeUpstream({
        ...head,
        branch: fork.default_branch ?? baseBranch,
      });
      progress(`Synced fork ${fork.full_name} with upstream`);
    } catch {
      progress(`Warning: could not sync fork with upstream (continuing)`);
    }
  }

  // Branch from the head repo's default-branch tip.
  const { data: baseRef } = await octokit.rest.git.getRef({
    ...head,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = baseRef.object.sha;

  try {
    await octokit.rest.git.createRef({
      ...head,
      ref: `refs/heads/${options.branchName}`,
      sha: baseSha,
    });
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 422) {
      throw new Error(
        `Branch ${options.branchName} already exists on ${head.owner}/${head.repo}`,
      );
    }
    throw err;
  }
  progress(`Created branch ${options.branchName}`);

  // Commit all files atomically via the Git Data API.
  const { data: baseCommit } = await octokit.rest.git.getCommit({
    ...head,
    commit_sha: baseSha,
  });
  const blobs = await Promise.all(
    options.files.map(async (file) => {
      const { data } = await octokit.rest.git.createBlob({
        ...head,
        content: Buffer.from(file.newContent, "utf8").toString("base64"),
        encoding: "base64",
      });
      return { path: file.path, sha: data.sha };
    }),
  );
  const { data: tree } = await octokit.rest.git.createTree({
    ...head,
    base_tree: baseCommit.tree.sha,
    tree: blobs.map((b) => ({
      path: b.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: b.sha,
    })),
  });
  const { data: commit } = await octokit.rest.git.createCommit({
    ...head,
    message: options.commitMessage,
    tree: tree.sha,
    parents: [baseSha],
  });
  await octokit.rest.git.updateRef({
    ...head,
    ref: `heads/${options.branchName}`,
    sha: commit.sha,
  });
  progress(`Committed ${options.files.length} file(s): ${commit.sha.slice(0, 8)}`);

  const { data: pr } = await octokit.rest.pulls.create({
    ...upstream,
    base: baseBranch,
    head: usedFork ? `${head.owner}:${options.branchName}` : options.branchName,
    title: options.prTitle,
    body: options.prBody,
  });
  progress(`Opened PR #${pr.number}: ${pr.html_url}`);

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    branchName: options.branchName,
    usedFork,
    forkFullName,
  };
}
