# Live owner-authorization verification

Verified 2026-11-03 against the connected `da-syllabus-auditor` Supabase project,
whose API host matches this checkout's `NEXT_PUBLIC_SUPABASE_URL`. These were
read-only catalog/function probes with transaction-local claim settings, not a
browser login. No student passages, passwords or tokens were returned or saved.

| Check | Observed result |
| --- | --- |
| Project status | Active and healthy |
| Public-table RLS | Enabled on all six listed public tables |
| Owner membership | One `app_owners` entry, linked to an existing auth account |
| RPC definition | `gap_report` is security-definer, pins `search_path=public`, and raises `not allowed` unless `auth.uid()` belongs to `app_owners` |
| Anonymous execution grant | Absent |
| Authenticated execution grant | Present; the function's membership check still applies |
| Owner claim-context probe | RPC returned an array, matching `verifyResearchOwner`'s expected response |
| Non-owner claim-context probe | RPC raised `P0001: not allowed` at the membership check |
| Probe cleanup | A subsequent request observed `auth.uid() IS NULL` |

The probes used the stored owner ID internally and a verified non-member UUID;
neither account identity nor gap contents was returned. Transaction-local claim
settings were cleared at request end. No database rows, grants, policies or schema
objects were changed. Management-tool access establishes the database-side gate;
an actual owner browser/JWT sign-in remains a separate outstanding verification.

The app also validates the incoming token with `getUser(token)` before checking
the RPC, using the same bearer token for its request-scoped Supabase client. It
does not authorize from user-editable profile metadata. This follows the documented
[request-scoped auth context and user lookup](https://supabase.com/docs/guides/functions/auth-legacy-jwt).

## Existing advisor notices

The live security advisor returned these notices. They were inspected without
changing provider settings or the existing app's access model.

| Notice | Assessment and reference |
| --- | --- |
| RLS enabled with no policy on `app_owners` and `policy_gaps` | Expected direct-client denial for these private tables; owner reads go through the checked RPC. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| Authenticated execution of security-definer `gap_report` | Intentional for the current owner-checked API. The live non-owner probe confirmed rejection; removing this grant would also stop owner RPC access. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| Leaked-password protection disabled | Existing auth-setting warning remains open. Plan/cost availability was not verified and no setting was enabled. [Password-protection reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

The official changelog index was fetched and the relevant
[TLS deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) and
[PostgreSQL 17.11 notes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
were reviewed. This check verified the existing owner RPC; it is not a complete
database upgrade or application security audit.
