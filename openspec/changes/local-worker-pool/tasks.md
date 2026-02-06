## 1. Module Setup & Public Interfaces

- [ ] 1.1 Create `packages/engine/src/worker/` module skeleton (queue, pool, executor contracts)
- [ ] 1.2 Define core types: `WorkItemId`, `WorkItem`, `WorkResult`, `WorkerPoolStatus`
- [ ] 1.3 Define interfaces: `TaskQueue`, `WorkerPool`, `TaskExecutor`
- [ ] 1.4 Add public exports for worker modules

## 2. Bounded Local Queue + Backpressure (local-task-queue-backpressure)

- [ ] 2.1 Implement bounded in-memory FIFO queue with configurable capacity
- [ ] 2.2 Implement non-blocking enqueue (`tryEnqueue`) that fails deterministically when full
- [ ] 2.3 Implement blocking enqueue (`enqueue`) that waits until capacity is available
- [ ] 2.4 Implement deterministic dequeue API and empty-queue behavior
- [ ] 2.5 Add queue metrics helpers (size, capacity, full/empty)

## 3. Worker Pool Execution (worker-pool-task-execution)

- [ ] 3.1 Implement worker pool with configurable concurrency and in-flight tracking
- [ ] 3.2 Implement worker loop: dequeue → execute → emit completion
- [ ] 3.3 Implement executor contract wiring: `TaskExecutor.execute(workItem, abortSignal)`
- [ ] 3.4 Add in-process de-dup guard to prevent concurrent duplicate execution of same work item
- [ ] 3.5 Expose pool status (inFlight count, queued count)

## 4. Cancellation & Timeouts (task-cancellation-timeouts)

- [ ] 4.1 Add cancellation API for work items (by id) that aborts in-flight via `AbortController`
- [ ] 4.2 Add per-task timeout wrapper that aborts execution after deadline
- [ ] 4.3 Implement graceful shutdown: stop consuming new work, await in-flight until deadline
- [ ] 4.4 Implement forced shutdown: abort all in-flight, clear queue as needed

## 5. Test Suite

- [ ] 5.1 Add unit tests for bounded queue (capacity, FIFO ordering)
- [ ] 5.2 Add unit tests for backpressure (`tryEnqueue` fail when full, blocking enqueue waits)
- [ ] 5.3 Add unit tests for concurrency limit (never exceed max in-flight)
- [ ] 5.4 Add unit tests for in-flight tracking lifecycle (start/finish)
- [ ] 5.5 Add unit tests for cancellation (cancelled work completes with terminal CANCELLED)
- [ ] 5.6 Add unit tests for timeouts (abort after deadline)
- [ ] 5.7 Add unit tests for shutdown modes (graceful waits; forced aborts)

## 6. Minimal Integration Hooks

- [ ] 6.1 Provide a minimal in-memory `TaskExecutor` for harness tests (simulated duration + outcome)
- [ ] 6.2 Add a test-only harness that saturates the queue to validate backpressure end-to-end
- [ ] 6.3 Document intended integration point with scheduler dispatch (slots available, enqueue strategy)
