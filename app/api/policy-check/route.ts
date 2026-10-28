import { callMeta, callMetaSearch } from "@/lib/meta";
import { comparePolicies } from "@/lib/policy/compare";
import { lookupPolicies, recheckPolicies } from "@/lib/policy/lookup";
import { corpusPolicies } from "@/lib/policy/corpus";
import { checkRequiredContents } from "@/lib/policy/contents";
import { createPolicyCheckHandler } from "@/lib/policy/check-handler";

export const maxDuration = 300;

export const POST = createPolicyCheckHandler({
  local: corpusPolicies,
  recheck: recheckPolicies,
  lookup: (school, topics) => lookupPolicies(school, topics, callMetaSearch, callMeta),
  compare: (pages, policies) => comparePolicies(pages, policies, callMeta),
  contents: (pages, coverage, context, deadline) => checkRequiredContents(pages, coverage, context, callMeta, {
    deadline,
    callBudgetMs: process.env.MODEL_PROVIDER === "baseten" ? 115_000 : 60_000,
  }),
});
