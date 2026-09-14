import { config as loadDotenv } from "dotenv";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { z } from "zod";

// Load .env from the current working directory and, as a fallback, from the
// monorepo root two levels up (when running from packages/*).
loadDotenv({ quiet: true });
loadDotenv({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, "GITHUB_TOKEN is required"),
  MALTIFY_REPO: z
    .string()
    .regex(/^[^/]+\/[^/]+$/, "MALTIFY_REPO must be owner/repo"),
  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  LLM_MODEL: z.string().default("claude-opus-5"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  MALTIFY_DB_PATH: z.string().default("~/.maltify/maltify.db"),
  PORT: z.coerce.number().int().positive().default(8790),
});

export type MaltifyConfig = z.infer<typeof envSchema> & {
  dbPath: string;
  maltifyOwner: string;
  maltifyRepo: string;
};

function expandHome(p: string): string {
  return p.startsWith("~/") || p === "~" ? p.replace("~", homedir()) : p;
}

let cached: MaltifyConfig | null = null;

/**
 * Validated configuration. `requireGithub`/`requireLlm` let read-only commands
 * (e.g. `maltify list`) run without a full .env.
 */
export function getConfig(): MaltifyConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid configuration (check your .env — see .env.example):\n${issues}`,
    );
  }
  const env = parsed.data;
  const [maltifyOwner, maltifyRepo] = env.MALTIFY_REPO.split("/") as [
    string,
    string,
  ];
  cached = {
    ...env,
    dbPath: resolve(expandHome(env.MALTIFY_DB_PATH)),
    maltifyOwner,
    maltifyRepo,
  };
  return cached;
}

/** Config for commands that only touch the local database. */
export function getLocalConfig(): { dbPath: string; port: number } {
  const dbPath = resolve(
    expandHome(process.env.MALTIFY_DB_PATH ?? "~/.maltify/maltify.db"),
  );
  const port = Number(process.env.PORT ?? 8790);
  return { dbPath, port };
}
