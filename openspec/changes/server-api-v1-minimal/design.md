## Context

Autokestra is currently CLI-first, with state persisted via the engine `StateStore` (SQLite by default) and core observability (execution logs, audit trail, inspection) already implemented in the engine package.

The repo already contains a minimal `@autokestra/server` package using Hono + Bun’s native server with placeholder endpoints under `/api/v1/*`.

This change turns those placeholders into a small, production-safe (secure-by-default) API v1 that exposes workflow and execution operations already available through the engine’s storage + inspection layers.

Constraints:
- Keep API surface minimal and stable; avoid “half-implemented” endpoints.
- Do not expose secrets in responses.
- Prefer reusing engine logic (validation, inspectors, log store) rather than re-implementing behavior in server.

## Goals / Non-Goals

**Goals:**
- Provide a minimal HTTP API under `/api/v1` for:
  - Health/status
  - Workflow CRUD (list/get/apply/delete, enable/disable)
  - Execution list + inspect
  - Execution logs (bounded query; optionally tail-like polling)
  - Execution cancel
- Enforce authentication via API key and fail fast if not configured.
- Validate and normalize workflow definitions using the engine’s workflow loader/validator.
- Return consistent JSON responses and errors.

**Non-Goals:**
- No UI, WebSocket streaming, or SSE in v1 minimal.
- No OAuth/JWT/SSO.
- No multi-tenant authz model (single shared API key set).
- No long-running server-side scheduling changes; API should call into existing engine components.
- No remote plugin installation/build endpoints.

## Decisions

1) HTTP framework: Hono + Bun native server
- Decision: Keep Hono (already present) and continue using Bun’s `Bun.serve`.
- Rationale: Minimal footprint, fits current server skeleton, good middleware ecosystem.
- Alternatives: Express/Fastify (heavier), raw Bun routing (more boilerplate).

2) API versioning and routing
- Decision: All non-health endpoints live under `/api/v1/*`.
- Rationale: Explicit versioning supports future expansion without breaking clients.

3) Authentication: API key required (secure-by-default)
- Decision: Require an API key for all `/api/v1/*` routes.
- Mechanism:
  - Accept `Authorization: Bearer <key>` and `X-API-Key: <key>`.
  - If both headers are present, `Authorization` takes precedence.
  - Configure allowed keys via YAML config only (`server.apiKeys: string[]`).
  - Multiple keys are allowed.
  - Key rotation/revocation requires a server restart in v0.1.
  - If no key configured, the server refuses to start with a clear error.
- Rationale: Minimal implementation while meeting “secure by default”.
- Alternatives: Allow unauthenticated by default (not acceptable), JWT/OAuth (too large).

4) Config integration
- Decision: Extend engine/shared config to include API auth configuration:
  - `server.apiKeys: string[]` in YAML config.
- Rationale: Keep configuration centralized and scriptable.

5) Data access layer: Engine `StateStore` + inspectors
- Decision: Server handlers should:
  - Create an `Engine`, call `initialize()`, then use `engine.getStateStore()`.
  - For inspection/logs, reuse engine utilities (e.g. `ExecutionInspector`, `LogStore`).
- Rationale: Avoid duplicating query logic; keep behavior consistent with CLI.

6) Workflow apply input format
- Decision: Accept workflow definitions as YAML text in request body (content-type `text/yaml` or `application/yaml`) only.
  - Validate and normalize using engine workflow loader/validator.
  - The workflow id in the YAML MUST match `:id` in the URL; otherwise return `400` with a clear error message.
  - Store normalized workflow object in `workflows.definition`.
- Rationale: Aligns with DSL-first workflows and avoids supporting multiple input formats in v0.1.

7) Logs query shape
- Decision: Execution logs are paginated, newest-first.
  - The logs response is an object: `{ items, limit, offset, hasMore }`.
- Rationale: Avoids unstable `total` counts while executions are running and keeps pagination robust.

8) Workflow enable/disable shape
- Decision: Use `PATCH /api/v1/workflows/:id` with body `{ enabled: true|false }`.

9) Health and status
- Decision: `/health` is public; `/api/v1/status` is authenticated and returns minimal `{ state, version, uptimeMs }` (or equivalent).

10) CORS
- Decision: Do not enable CORS middleware in v0.1 (no UI/browser use-case).

7) Response formats
- Decision: JSON only for v1 minimal.
  - Success responses return `{ ... }` objects.
  - Errors return `{ error: { code, message, details? } }`.
- Rationale: Predictable for scripting and future SDK generation.

## Risks / Trade-offs

- [Auth key management complexity] → Keep to a single mechanism (API keys only) and fail fast when missing.
- [Breaking existing “placeholder” behavior] → Treat this as stabilizing; placeholders returning empty arrays are not a supported contract.
- [Workflow validation complexity] → Reuse engine validation and return structured diagnostics in errors.
- [Over-coupling server to engine internals] → Use exported engine APIs only; avoid reaching into private fields.

## Migration Plan

- Add/extend config schema to support `server.apiKeys` (and env override).
- Update `config.example.yaml` to include an example API key configuration.
- Implement server handlers and middleware in `packages/server`.
- Add server-focused tests (minimal smoke/integration tests for auth + core endpoints).
- Rollback strategy: revert server routes to placeholders; no DB schema changes required for this change.

## Open Questions

- None for v0.1 scope. v1 may revisit stronger auth, key management, and streaming logs.
