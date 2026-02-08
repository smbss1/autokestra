## Context

v0.1 is the first “shippable” milestone: users should be able to start the server, apply a workflow, run an execution deterministically, inspect/log it, and rely on SQLite + local plugins/secrets on a single machine.

The codebase already contains most core building blocks (engine, state store, secrets, minimal server API, CLI), but the release DoD is not yet encoded as a single, verifiable contract. This creates risk of regressions and ambiguous “done” criteria.

Constraints:
- CLI-first, no GUI.
- Must run locally on modest hardware.
- Secrets must never leak via logs/DTOs.
- Plugins must remain sandboxed via out-of-process execution (process and/or Docker) and permissions enforced.

## Goals / Non-Goals

**Goals:**
- Define and enforce a v0.1 release contract via a small set of end-to-end smoke scenarios.
- Make “getting started” deterministic: one config, one example workflow, clear commands.
- Ensure CI can gate the release (tests + docs correctness signals).

**Non-Goals:**
- Production-grade multi-node orchestration.
- Full plugin registry / install UX (targeted for v0.2).
- Advanced observability exporters (OTel/Prometheus).

## Decisions

- Release contract lives as a dedicated spec capability (`release-dod-v0-1`) to avoid scattering acceptance criteria across many unrelated capability specs.
  - Alternative: update many existing specs (engine, scheduler, secrets, plugins). Rejected for now because it increases scope and diff surface; we can evolve those specs later once the integration path is stable.

- “DoD verification” uses integration-style tests that exercise:
  - server start with config
  - workflow apply/list/describe
  - execution run and terminal states
  - logs/inspect and secret masking
  - plugin execution boundary (process and/or Docker container runtime)
  - Alternative: manual checklist only. Rejected because it does not prevent regressions.

- Prefer lightweight fixtures:
  - Example workflows (YAML) checked into repo.
  - Minimal secret(s) injected via SecretStore for tests.
  - SQLite uses temp DB per test run.

## Risks / Trade-offs

- Risk: The umbrella DoD spec overlaps existing capability specs and can drift.
  - Mitigation: Keep the DoD spec narrowly focused on cross-capability integration scenarios and link to existing specs where applicable.

- Risk: Integration tests become flaky or slow.
  - Mitigation: Keep the number of scenarios small (2–4), use in-process server/engine wiring, and avoid network dependencies.

- Risk: Plugin runtime is the hardest part to “smoke test” deterministically.
  - Mitigation: Start with a minimal “hello world” plugin path in the process/container runtime with strict permission checks, then tighten isolation controls as it stabilizes.
