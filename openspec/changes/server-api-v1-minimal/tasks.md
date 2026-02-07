## 1. API Server Hardening

- [ ] 1.1 Require API key config at startup (refuse to start if empty)
- [ ] 1.2 Add auth middleware supporting `Authorization: Bearer` and `X-API-Key`
- [ ] 1.2a Ensure `Authorization` header has priority when both are present
- [ ] 1.3 Standardize JSON error helper `{ error: { code, message, details? } }`
- [ ] 1.4 Ensure `/health` is unauthenticated; keep `/api/v1/*` authenticated
- [ ] 1.5 Remove/avoid CORS middleware (no UI in v0.1)

## 2. Configuration

- [ ] 2.1 Extend config schema to support API keys (e.g. `server.apiKeys: string[]`)
- [ ] 2.2 Update `config.example.yaml` with API key configuration example

## 3. Workflow Endpoints

- [ ] 3.1 Implement `GET /api/v1/workflows` (pagination + total)
- [ ] 3.2 Implement `GET /api/v1/workflows/:id` (404 when missing)
- [ ] 3.3 Implement `PUT /api/v1/workflows/:id` accepting YAML only
- [ ] 3.4 Validate workflows via engine loader/validator; return structured diagnostics on 400
- [ ] 3.4a Reject workflow apply when URL `:id` does not match YAML `id`
- [ ] 3.5 Implement `DELETE /api/v1/workflows/:id` (204 on success)
- [ ] 3.6 Implement `PATCH /api/v1/workflows/:id` with `{ enabled: true|false }`

## 4. Execution Endpoints

- [ ] 4.1 Implement `GET /api/v1/executions` with `workflowId`, `state`, `limit`, `offset`
- [ ] 4.2 Implement `GET /api/v1/executions/:executionId` using engine inspection aggregation
- [ ] 4.3 Implement `GET /api/v1/executions/:executionId/logs` with pagination + filters (`taskId`, `level`)
- [ ] 4.4 Implement `POST /api/v1/executions/:executionId/cancel` (transition to CANCELLED)

## 5. Engine Integration & Response Shapes

- [ ] 5.1 Add server-side wiring to create/initialize engine and reuse `StateStore`
- [ ] 5.2 Ensure responses never include secrets (no secret fields; mask where applicable)
- [ ] 5.3 Define stable response DTOs for workflows/executions/logs

## 6. Tests

- [ ] 6.1 Add auth tests (missing/invalid/valid key)
- [ ] 6.2 Add endpoint smoke tests for workflows CRUD
- [ ] 6.3 Add endpoint smoke tests for executions list/inspect/logs
- [ ] 6.4 Add cancel execution test

## 7. Documentation

- [ ] 7.1 Document API v1 endpoints and auth usage in README or server docs
- [ ] 7.2 Add example `curl` commands for common operations
