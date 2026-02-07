## ADDED Requirements

### Requirement: API v1 routes are versioned and JSON-only
The system MUST expose the HTTP API under the `/api/v1` prefix and respond with `application/json` for all `/api/v1/*` routes.

#### Scenario: Request to API v1 endpoint
- **WHEN** a client calls an `/api/v1/*` endpoint
- **THEN** the server responds with a JSON document and an appropriate HTTP status code

### Requirement: Health endpoint is unauthenticated
The system MUST expose a health endpoint at `GET /health` that does not require authentication.

#### Scenario: Health check
- **WHEN** a client calls `GET /health`
- **THEN** the server responds `200` with JSON containing at least `status` and `timestamp`

### Requirement: API key authentication protects API v1
The system MUST require API key authentication for all `/api/v1/*` routes.

The system MUST accept either:
- `Authorization: Bearer <apiKey>`
- `X-API-Key: <apiKey>`

If both headers are present, the system MUST use `Authorization`.

The system MUST load the allowed API keys from YAML configuration only (e.g. `server.apiKeys`).
The system MUST support multiple valid API keys.

The system MUST reject requests with missing or invalid keys.

#### Scenario: Missing API key
- **WHEN** a client calls any `/api/v1/*` endpoint without an API key
- **THEN** the server responds `401` with a JSON error object

#### Scenario: Invalid API key
- **WHEN** a client calls any `/api/v1/*` endpoint with an invalid API key
- **THEN** the server responds `401` with a JSON error object

#### Scenario: Valid API key
- **WHEN** a client calls any `/api/v1/*` endpoint with a valid API key
- **THEN** the server processes the request and responds with a non-`401` status

#### Scenario: Both auth headers provided
- **WHEN** a client sends both `Authorization: Bearer <apiKey>` and `X-API-Key: <apiKey>`
- **THEN** the server authenticates using the key from `Authorization`

### Requirement: Server refuses to start without configured API keys
The system MUST fail to start the API server when no API keys are configured.

#### Scenario: No API keys configured
- **WHEN** the server starts with an empty API key configuration
- **THEN** the server exits with an error explaining that API keys are required

### Requirement: Error responses are consistent
The system MUST return errors in the shape:
`{ "error": { "code": string, "message": string, "details"?: unknown } }`.

#### Scenario: Validation error
- **WHEN** a request fails input validation
- **THEN** the server responds with an error JSON including `code` and `message`

### Requirement: List workflows
The system MUST expose `GET /api/v1/workflows` to list stored workflows.

The response MUST include workflows and pagination metadata.

#### Scenario: List workflows
- **WHEN** a client calls `GET /api/v1/workflows`
- **THEN** the server responds `200` with JSON containing a `workflows` array and `total`

### Requirement: Get workflow by id
The system MUST expose `GET /api/v1/workflows/:id` to retrieve a stored workflow by id.

#### Scenario: Workflow exists
- **WHEN** a client calls `GET /api/v1/workflows/:id` for an existing workflow
- **THEN** the server responds `200` with the workflow data

#### Scenario: Workflow missing
- **WHEN** a client calls `GET /api/v1/workflows/:id` for a non-existent workflow
- **THEN** the server responds `404` with a JSON error object

### Requirement: Apply (create/update) a workflow
The system MUST expose `PUT /api/v1/workflows/:id` to create or update a workflow.

The request body MUST be accepted as YAML workflow definition text (content-type `text/yaml` or `application/yaml`).

The system MUST validate the workflow definition according to the workflow DSL schema and reject invalid workflows.

The system MUST reject the request if the workflow id declared in the YAML does not match the `:id` path parameter.

#### Scenario: Apply valid workflow
- **WHEN** a client sends a valid workflow definition to `PUT /api/v1/workflows/:id`
- **THEN** the server responds `200` (or `201`) and the workflow is persisted

#### Scenario: Apply invalid workflow
- **WHEN** a client sends an invalid workflow definition to `PUT /api/v1/workflows/:id`
- **THEN** the server responds `400` with validation details in the error JSON

#### Scenario: Workflow id mismatch
- **WHEN** a client sends a workflow YAML whose `id` does not match `:id` in the URL
- **THEN** the server responds `400` with an error explaining that the URL id does not match the YAML id

### Requirement: Delete a workflow
The system MUST expose `DELETE /api/v1/workflows/:id` to delete a workflow.

#### Scenario: Delete existing workflow
- **WHEN** a client calls `DELETE /api/v1/workflows/:id` for an existing workflow
- **THEN** the server responds `204` and the workflow is removed

### Requirement: Enable/disable a workflow
The system MUST expose `PATCH /api/v1/workflows/:id` to update the `enabled` flag.

The request body MUST be JSON containing `{ "enabled": boolean }`.

#### Scenario: Disable workflow
- **WHEN** a client sends `PATCH /api/v1/workflows/:id` with `{ "enabled": false }`
- **THEN** the server persists `enabled=false` and responds `200`

#### Scenario: Enable workflow
- **WHEN** a client sends `PATCH /api/v1/workflows/:id` with `{ "enabled": true }`
- **THEN** the server persists `enabled=true` and responds `200`

### Requirement: List executions
The system MUST expose `GET /api/v1/executions` to list executions.

The endpoint MUST support filtering by at least `workflowId` and `state` and MUST support pagination via `limit` and `offset`.

#### Scenario: List executions
- **WHEN** a client calls `GET /api/v1/executions`
- **THEN** the server responds `200` with JSON containing `executions` and `total`

#### Scenario: Filter executions
- **WHEN** a client calls `GET /api/v1/executions` with a `workflowId` filter
- **THEN** the server returns only executions for that workflow

### Requirement: Inspect execution
The system MUST expose `GET /api/v1/executions/:executionId` to retrieve execution details.

The response MUST include execution state, timestamps, and task run information sufficient to debug an execution.

#### Scenario: Inspect existing execution
- **WHEN** a client calls `GET /api/v1/executions/:executionId` for an existing execution
- **THEN** the server responds `200` with execution details

#### Scenario: Inspect missing execution
- **WHEN** a client calls `GET /api/v1/executions/:executionId` for a non-existent execution
- **THEN** the server responds `404` with a JSON error object

### Requirement: Query execution logs
The system MUST expose `GET /api/v1/executions/:executionId/logs` to retrieve execution logs.

The endpoint MUST support bounded queries via pagination (`limit`, `offset`) and MUST allow filtering by `taskId` and/or `level`.

The system MUST return logs ordered from most recent to least recent.

The response body MUST be a JSON object containing `{ items, limit, offset, hasMore }`.

#### Scenario: Get execution logs
- **WHEN** a client calls `GET /api/v1/executions/:executionId/logs`
- **THEN** the server responds `200` with `{ items, limit, offset, hasMore }` and `items` contains log entries

#### Scenario: Logs are newest-first
- **WHEN** a client calls `GET /api/v1/executions/:executionId/logs`
- **THEN** the first item in `items` is the most recent log entry

### Requirement: Cancel execution
The system MUST expose `POST /api/v1/executions/:executionId/cancel` to cancel an execution.

#### Scenario: Cancel running execution
- **WHEN** a client calls `POST /api/v1/executions/:executionId/cancel` for a running execution
- **THEN** the server transitions the execution to `CANCELLED` and responds `200`
