import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { CHECK_CODES } from "../server/audit/types.js";
import { describeRun } from "../server/tally/audit-runner.js";
import { TERM_KEYS } from "../server/tally/format.js";
import { ownerOf } from "../server/tally/session.js";
import { type RuleSpec, addVendorRule } from "../server/tally/steering.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date like 2026-04-01.");

export default defineAction({
  description:
    "Teach the audit something the documents don't say (an approved seat increase, an agreed price, a waived check), then re-run it. Attach proof — a quote from a pasted email or note — whenever the user has it.",
  schema: z.object({
    vendorId: z.string().describe("Vendor the rule applies to"),
    type: z.enum(["override_term", "waive_check"]).describe("override_term changes a term from a date; waive_check stops one check from flagging"),
    key: z.enum(TERM_KEYS).optional().describe("override_term: which term"),
    value: z.union([z.string(), z.number()]).optional().describe('override_term: the new value as written, e.g. "48", "26.16", "9%"'),
    check: z.enum(CHECK_CODES as [string, ...string[]]).optional().describe("waive_check: which check to stop flagging"),
    meter: z.string().optional().describe("Only for meter rates or a per-meter waiver"),
    effectiveFrom: isoDate.optional().describe("override_term: first day the new value applies (start of the first period it covers)"),
    effectiveTo: isoDate.optional().describe("override_term: last day it applies, if it ends"),
    periodFrom: isoDate.optional().describe("waive_check: first period start the waiver covers"),
    periodTo: isoDate.optional().describe("waive_check: last period start the waiver covers"),
    reason: z.string().min(1).max(1000).describe("The user's words, verbatim"),
    proof: z
      .object({
        documentId: z.string().describe("The note/email document (added with add-document) that proves the rule"),
        quotes: z.array(z.string().min(1)).min(1).max(3).describe("The approval line(s), copied exactly; must state the value"),
      })
      .optional()
      .describe("Evidence for the rule. Without it the rule shows as 'your word'"),
  }),
  deferLoading: false,
  run: async (args, ctx) => {
    const rule = toRuleSpec(args);
    const { ruleId, proven, run } = await addVendorRule(ownerOf(ctx), {
      vendorId: args.vendorId,
      rule,
      reason: args.reason,
      proof: args.proof,
      createdBy: "agent",
    });
    return {
      id: ruleId,
      proven,
      recoverableBefore: run.before.recoverableCents,
      recoverableAfter: run.after.recoverableCents,
      message: `Saved the rule${proven ? " (proven by the quoted document)" : " (on your word — no document attached)"}. ${describeRun(run)}`,
      nextRequiredAction: "Tell the user what the rule explained and the new totals, quoting the amounts above",
    };
  },
});

const toRuleSpec = (args: {
  type: "override_term" | "waive_check";
  key?: (typeof TERM_KEYS)[number] | undefined;
  value?: string | number | undefined;
  check?: string | undefined;
  meter?: string | undefined;
  effectiveFrom?: string | undefined;
  effectiveTo?: string | undefined;
  periodFrom?: string | undefined;
  periodTo?: string | undefined;
}): RuleSpec => {
  if (args.type === "override_term") {
    if (!args.key || args.value === undefined) fail("override_term needs key and value.", { errorCode: "invalid_rule", statusCode: 400 });
    return { type: "override_term", key: args.key, value: args.value, meter: args.meter, effectiveFrom: args.effectiveFrom, effectiveTo: args.effectiveTo };
  }
  const check = CHECK_CODES.find((code) => code === args.check);
  if (!check) fail("waive_check needs check.", { errorCode: "invalid_rule", statusCode: 400 });
  return { type: "waive_check", check, meter: args.meter, periodFrom: args.periodFrom, periodTo: args.periodTo };
};
