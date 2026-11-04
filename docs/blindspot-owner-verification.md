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
the owner subsequently verified browser sign-in as recorded below.

## Local owner-session entry point

On 2026-11-03 the actual checkout was started with
`npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, loading `.env.local`.
The compiled development client contains the expected project host, not the
mocked browser-test host. No key, token or account identity was printed.

- `http://127.0.0.1:3000/blindspot` returned HTTP 200 with `Cache-Control: no-store`.
- An anonymous `/api/research` request returned HTTP 401 and
  `Cache-Control: private, no-store`, with the readable sign-in requirement.
- The owner was asked to sign in directly through the existing app form and
  report whether the dashboard opens. Credentials stay in their browser.

On November 3, 2026, the owner reported signing in through the browser and
confirmed that the dashboard was present at the local Blindspot URL. This closes
the owner sign-in/dashboard-opening check with owner-reported browser evidence.
The agent did not extract browser credentials or tokens. The owner then confirmed that a saved review remains visible after refreshing
the page. A read-only database check independently found three persisted reviews
linked to existing findings, with nonempty actor and note fields. Note contents
and account identifiers were not returned. This closes the finding-review save
and reload check; originating-lineage review and scan passage admission remain
separate workflows.

The server is bound to loopback on this computer; it was not deployed to UO or
made available to other devices on the UO network. Runtime availability must be
rechecked after this server stops or the computer restarts.

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
