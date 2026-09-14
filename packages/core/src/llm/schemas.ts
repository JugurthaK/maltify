import { z } from "zod";

export const qualificationSchema = z.object({
  verdict: z
    .enum(["true_positive", "false_positive", "needs_review"])
    .describe(
      "true_positive if the finding is a real, exploitable or policy-relevant issue; " +
        "false_positive if it is clearly not a real issue in this context; " +
        "needs_review only when the provided context is genuinely insufficient to decide",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the verdict, 0 to 1"),
  reasoning: z
    .string()
    .describe(
      "Concise justification citing the actual code/context provided (file paths, line numbers, code behavior)",
    ),
  exploit_scenario: z
    .string()
    .optional()
    .describe(
      "For true positives: a concrete scenario describing how an attacker could exploit this",
    ),
});
export type QualificationResult = z.infer<typeof qualificationSchema>;

export const remediationSchema = z.object({
  explanation: z
    .string()
    .describe("What the fix changes and why it resolves the finding"),
  files: z
    .array(
      z.object({
        path: z.string().describe("Repo-relative path of the file to replace"),
        new_content: z
          .string()
          .describe("The COMPLETE new content of the file after the fix"),
      }),
    )
    .min(1),
  rotation_required: z
    .boolean()
    .optional()
    .describe(
      "True when the finding is a leaked credential that must also be rotated (a code change cannot un-leak it)",
    ),
});
export type RemediationResult = z.infer<typeof remediationSchema>;
