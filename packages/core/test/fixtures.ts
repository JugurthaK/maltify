export const opengrepSarif = JSON.stringify({
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

export const trivySarif = JSON.stringify({
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

export const gitleaksSarif = JSON.stringify({
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
