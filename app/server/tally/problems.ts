import { fail } from "@agent-native/core/action";

import type { ItemProblem } from "./grounding.js";

/**
 * Reports items that failed grounding after the good ones were saved. The
 * agent gets one code to branch on and the exact items to fix and resend.
 */
export const failWithProblems = (what: string, recorded: number, problems: readonly ItemProblem[]): never => {
  const codes = new Set(problems.map((problem) => problem.errorCode));
  const [first] = problems;
  const errorCode = codes.size === 1 && first ? first.errorCode : "items_not_grounded";
  const list = problems.map((problem) => `- [${problem.index}] ${problem.item}: ${problem.message}`).join("\n");
  return fail(
    `Recorded ${recorded} ${what}; ${problems.length} could not be proven from the document. ` +
      `Fix only these and call again with just them:\n${list}`,
    { errorCode, statusCode: 422, details: { recorded, failed: problems } },
  );
};
