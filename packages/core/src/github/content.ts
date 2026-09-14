import { getOctokit, parseRepoSlug } from "./client.js";

/**
 * Fetch a file's content from a repo at a ref via the contents API.
 * Returns null for missing files, directories, or submodules.
 */
export async function fetchFileContent(
  repoSlug: string,
  path: string,
  ref?: string,
): Promise<string | null> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepoSlug(repoSlug);
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ...(ref ? { ref } : {}),
    });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
