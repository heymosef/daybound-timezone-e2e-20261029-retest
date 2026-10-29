# Resource and context efficiency

## User-owned model selection

Model and reasoning-effort selection belong to the user. Never edit global or
default model settings, reasoning-effort settings, or model-routing settings
unless the user explicitly requests that exact configuration change.

## Long-running work and monitoring

- Never keep a model turn alive by repeatedly polling a process, CI run,
  deployment, browser job, external service, or subagent at a fixed cadence.
- Put the wait inside one programmatic or deferred tool execution whenever the
  available tooling supports it. The waiting process may query internally, but
  it should return control to the model only for a meaningful state transition,
  actionable anomaly or failure, terminal completion, or new user input.
- Do not narrate unchanged state. A running process with no new information is
  not a progress update.
- Prefer semantic, terminal-only monitors over watch commands or repeated status
  commands. Fetch logs only for failed or anomalous work, scoped to the relevant
  step.
- If no suitable waiter exists, use the product's recurring-monitor or wait
  mechanism and yield control. Do not simulate waiting with frequent model/tool
  round trips.

## Retrieval, delegation, and validation budgets

- Batch independent file reads, searches, and read-only checks. Stop retrieving
  once the evidence is sufficient for the decision; do not repeat searches only
  to obtain alternate wording.
- Delegate only a distinct, bounded unit of work that can run independently.
  Do not create observer agents whose sole task is to poll or restate another
  process. Keep handoffs compact and reconstruct durable state from the source
  of truth.
- Assign one owner to each validation layer. During implementation, run focused
  checks for the changed area; run the complete required suite once on the final
  candidate; use independent review for risk-appropriate inspection rather than
  automatically duplicating the entire suite.
- Review boundaries, commit boundaries, PR boundaries, and release boundaries
  are separate decisions. Batch compatible, independently reviewed changes into
  one tested PR or release when doing so preserves safety and traceability.

# Project operation

Use Node24 (see `.nvmrc`) and npm with `npm ci`. Commands: `npm run dev`,
`npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
`node scripts/browser-fixtures.mjs` builds ignored offline browser fixtures;
see README and `docs/browser-testing.md`. Keep fixture controls out of product
code. Never use real analytics credentials for verification.

For this maintenance effort, work in the assigned isolated worktree and make
local commits only. Do not push, open PRs, deploy, change external dashboards,
or change global runtime/model settings. The primary integrator owns plan status
and complete final validation. Plans010/011 are deferred design work only.
