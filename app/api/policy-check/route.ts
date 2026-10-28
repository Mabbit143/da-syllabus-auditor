import { callBaseten, callMeta, callMetaSearch, isBaseten } from "@/lib/meta";
import { comparePoliciesAgreed } from "@/lib/policy/compare";
import { lookupPolicies, recheckPolicies } from "@/lib/policy/lookup";
import { corpusPolicies } from "@/lib/policy/corpus";
import { checkRequiredContents } from "@/lib/policy/contents";
import { createPolicyCheckHandler } from "@/lib/policy/check-handler";

export const maxDuration = 300;

export const POST = createPolicyCheckHandler({
  local: corpusPolicies,
  recheck: recheckPolicies,
  lookup: (school, topics) => lookupPolicies(school, topics, callMetaSearch, callMeta),
  // With both providers configured, every comparison is read by two models and shown only where they agree.
  compare: (pages, policies) => comparePoliciesAgreed(pages, policies, callMeta, !isBaseten() && process.env.BASETEN_API_KEY ? callBaseten : undefined),
  contents: (pages, coverage, context, deadline) => checkRequiredContents(pages, coverage, context, callMeta, {
    deadline,
    callBudgetMs: process.env.MODEL_PROVIDER === "baseten" ? 115_000 : 60_000,
  }),
});
