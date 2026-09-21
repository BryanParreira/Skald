import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { understandNotizRepo } from "../modal/understand";

export const understandNotizRepoTool = tool(
  async ({ request }: { request: string }) => {
    const result = await understandNotizRepo(request);
    const lines = [
      `success: ${result.success}`,
      `executionTimeMs: ${result.executionTimeMs}`,
      `report:\n${result.report}`,
    ];
    return lines.join("\n");
  },
  {
    name: "understandNotizRepo",
    description:
      "Analyze and understand the Notiz codebase using Claude CLI. Use this for questions about code structure, architecture, implementation details, or finding specific code. This tool is read-only and cannot make modifications.",
    schema: z.object({
      request: z
        .string()
        .describe(
          "The question or request about the Notiz codebase to investigate",
        ),
    }),
  },
);
