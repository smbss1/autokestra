## 1. Engine Module Setup

- [ ] 1.1 Create `packages/engine/src/scheduler/` module skeleton (graph, runnable, dispatcher)
- [ ] 1.2 Add public exports (barrel) for scheduler types/functions
- [ ] 1.3 Define core types: `TaskId`, `WorkflowTask`, `WorkflowGraph`, `TaskRunStatus`, `TaskRunState`

## 2. DAG Resolution (dag-task-graph-resolution)

- [ ] 2.1 Implement task id validation (unique ids, no self-deps)
- [ ] 2.2 Implement dependency validation (missing `needs` references)
- [ ] 2.3 Implement cycle detection (Kahn or DFS) with deterministic behavior
- [ ] 2.4 Implement graph builder that produces nodes + edges from workflow tasks
- [ ] 2.5 Implement deterministic topological ordering with stable tie-breaker

## 3. Runnable Selection (runnable-task-selection)

- [ ] 3.1 Implement `selectRunnableTasks(graph, state, now)` as a pure function
- [ ] 3.2 Encode dependency success rules (all deps terminal success required)
- [ ] 3.3 Encode failure-blocking rules (failed deps prevent runnable)
- [ ] 3.4 Add retry gating fields to state (attempt count, max, nextEligibleAt)
- [ ] 3.5 Implement time-gated retry behavior in runnable selection

## 4. Scheduler Dispatch Loop (scheduler-dispatch-loop)

- [ ] 4.1 Define scheduler interfaces: `TaskQueue`, `TaskDispatcher`, and `SchedulerLimits`
- [ ] 4.2 Implement deterministic selection under contention (stable ordering + truncation)
- [ ] 4.3 Implement concurrency limit enforcement (global + per-execution)
- [ ] 4.4 Implement idempotent scheduler tick (no duplicate dispatch without state change)
- [ ] 4.5 Add a minimal in-memory queue/dispatcher implementation for early testing

## 5. Tests

- [ ] 5.1 Add unit tests for DAG validation (duplicate ids, missing deps, self-deps)
- [ ] 5.2 Add unit tests for cycle detection
- [ ] 5.3 Add unit tests for deterministic topo ordering (multiple roots)
- [ ] 5.4 Add unit tests for runnable selection (roots, dependency completion, failure blocking)
- [ ] 5.5 Add unit tests for retry gating (before/after backoff)
- [ ] 5.6 Add unit tests for scheduler tick (capacity limits, deterministic selection, idempotency)

## 6. Integration Hook (Minimal)

- [ ] 6.1 Add a small in-process harness (test-only) that resolves a graph + runs scheduler ticks over synthetic state transitions
- [ ] 6.2 Document intended integration points with the execution state store (placeholders only, no full persistence)
