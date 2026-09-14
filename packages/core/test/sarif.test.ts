import { describe, expect, it } from "vitest";
import { normalizePath } from "../src/sarif/fingerprint.js";
import { normalizeSarif } from "../src/sarif/normalize.js";
import { parseSarif } from "../src/sarif/parse.js";

const opengrepSarif = JSON.stringify({
  version: "2.1.0",
  runs: [
    {
      tool: {
        driver: {
          name: "Opengrep",
          rules: [
            {
              id: "javascript.express.sqli",
              shortDescription: { text: "SQL injection" },
              properties: { severity: "ERROR" },
            },
          ],
        },
      },
      results: [
        {
          ruleId: "javascript.express.sqli",
          ruleIndex: 0,
          level: "error",
          message: { text: "Detected SQL injection" },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: "target/src/db.js" },
                region: {
                  startLine: 10,
                  endLine: 10,
                  snippet: { text: 'db.query("SELECT * FROM users WHERE id=" + id)' },
                },
              },
            },
          ],
        },
      ],
    },
  ],
});

const trivySarif = JSON.stringify({
  version: "2.1.0",
  runs: [
    {
      tool: {
        driver: {
          name: "Trivy",
          rules: [
            {
              id: "CVE-2021-23337",
              shortDescription: { text: "lodash command injection" },
              properties: { "security-severity": "7.2", tags: ["HIGH"] },
            },
            {
              id: "AVD-DS-0002",
              shortDescription: { text: "root user in Dockerfile" },
              properties: { tags: ["HIGH"] },
              defaultConfiguration: { level: "error" },
            },
          ],
        },
      },
      results: [
        {
          ruleId: "CVE-2021-23337",
          ruleIndex: 0,
          level: "error",
          message: {
            text: "Package: lodash\nInstalled Version: 4.17.4\nVulnerability CVE-2021-23337",
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: "package-lock.json" },
                region: { startLine: 1 },
              },
            },
          ],
        },
        {
          ruleId: "AVD-DS-0002",
          ruleIndex: 1,
          level: "error",
          message: { text: "Image runs as root" },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: "Dockerfile" },
                region: { startLine: 1 },
              },
            },
          ],
        },
      ],
    },
  ],
});

const gitleaksSarif = JSON.stringify({
  version: "2.1.0",
  runs: [
    {
      tool: { driver: { name: "gitleaks" } },
      results: [
        {
          ruleId: "aws-access-token",
          level: "error",
          message: { text: "AWS access key detected" },
          partialFingerprints: { commitSha: "abc123", secretHash: "deadbeef" },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: "config/creds.txt" },
                region: { startLine: 3, snippet: { text: "AKIA****************" } },
              },
            },
          ],
        },
      ],
    },
  ],
});

describe("normalizePath", () => {
  it("strips checkout prefixes", () => {
    expect(normalizePath("target/src/a.js")).toBe("src/a.js");
    expect(normalizePath("./src/a.js")).toBe("src/a.js");
    expect(
      normalizePath("file:///home/runner/work/maltify/maltify/src/a.js"),
    ).toBe("src/a.js");
  });
});

describe("normalizeSarif", () => {
  it("normalizes opengrep results as sast/high", () => {
    const [f] = normalizeSarif(parseSarif(opengrepSarif), "opengrep");
    expect(f).toMatchObject({
      scanner: "opengrep",
      category: "sast",
      severity: "high",
      ruleId: "javascript.express.sqli",
      filePath: "src/db.js",
      startLine: 10,
    });
    expect(f!.fingerprint).toHaveLength(64);
  });

  it("splits trivy into sca and iac with cvss severity", () => {
    const results = normalizeSarif(parseSarif(trivySarif), "trivy");
    const sca = results.find((f) => f.category === "sca")!;
    const iac = results.find((f) => f.category === "iac")!;
    expect(sca.ruleId).toBe("CVE-2021-23337");
    expect(sca.severity).toBe("high"); // 7.2 cvss
    expect(iac.ruleId).toBe("AVD-DS-0002");
    expect(iac.severity).toBe("high"); // HIGH tag
  });

  it("trivy sca fingerprint is stable across version bumps", () => {
    const original = normalizeSarif(parseSarif(trivySarif), "trivy");
    const bumped = normalizeSarif(
      parseSarif(trivySarif.replace("4.17.4", "4.17.10")),
      "trivy",
    );
    const fpOf = (fs: typeof original) =>
      fs.find((f) => f.category === "sca")!.fingerprint;
    expect(fpOf(bumped)).toBe(fpOf(original));
  });

  it("gitleaks uses partialFingerprints and fixed high severity", () => {
    const [f] = normalizeSarif(parseSarif(gitleaksSarif), "gitleaks");
    expect(f).toMatchObject({ category: "secret", severity: "high" });
    // Same secret at a different line keeps its identity via partialFingerprints.
    const moved = gitleaksSarif.replace('"startLine": 3', '"startLine": 30');
    const [f2] = normalizeSarif(parseSarif(moved), "gitleaks");
    expect(f2!.fingerprint).toBe(f!.fingerprint);
  });

  it("fingerprint ignores line drift for snippet-based findings", () => {
    const moved = opengrepSarif
      .replace('"startLine": 10', '"startLine": 42')
      .replace('"endLine": 10', '"endLine": 42');
    const [a] = normalizeSarif(parseSarif(opengrepSarif), "opengrep");
    const [b] = normalizeSarif(parseSarif(moved), "opengrep");
    expect(b!.fingerprint).toBe(a!.fingerprint);
  });

  it("disambiguates duplicate findings within one scan", () => {
    const log = JSON.parse(opengrepSarif);
    const dup = structuredClone(log.runs[0].results[0]);
    dup.locations[0].physicalLocation.region.startLine = 99;
    log.runs[0].results.push(dup);
    const results = normalizeSarif(log, "opengrep");
    expect(results).toHaveLength(2);
    expect(results[0]!.fingerprint).not.toBe(results[1]!.fingerprint);
    expect(results[1]!.fingerprint.endsWith("#2")).toBe(true);
  });
});
