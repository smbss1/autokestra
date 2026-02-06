## 1. Module Setup & Public Interfaces

- [x] 1.1 Create `packages/engine/src/worker/` module skeleton (queue, pool, executor contracts)
- [x] 1.2 Define core types: `WorkItemId`, `WorkItem`, `WorkResult`, `WorkerPoolStatus`
- [x] 1.3 Define interfaces: `TaskQueue`, `WorkerPool`, `TaskExecutor`
- [x] 1.4 Add public exports for worker modules

## 2. Bounded Local Queue + Backpressure (local-task-queue-backpressure)

- [x] 2.1 Implement bounded in-memory FIFO queue with configurable capacity
- [x] 2.2 Implement non-blocking enqueue (`tryEnqueue`) that fails deterministically when full
- [x] 2.3 Implement blocking enqueue (`enqueue`) that waits until capacity is available
- [x] 2.4 Implement deterministic dequeue API and empty-queue behavior
- [x] 2.5 Add queue metrics helpers (size, capacity, full/empty)

## 3. Worker Pool Execution (worker-pool-task-execution)

- [x] 3.1 Implement worker pool with configurable concurrency and in-flight tracking
- [x] 3.2 Implement worker loop: dequeue → execute → emit completion
- [x] 3.3 Implement executor contract wiring: `TaskExecutor.execute(workItem, abortSignal)`
- [x] 3.4 Add in-process de-dup guard to prevent concurrent duplicate execution of same work item
- [x] 3.5 Expose pool status (inFlight count, queued count)

## 4. Cancellation & Timeouts (task-cancellation-timeouts)

- [x] 4.1 Add cancellation API for work items (by id) that aborts in-flight via `AbortController`
- [x] 4.2 Add per-task timeout wrapper that aborts execution after deadline
- [x] 4.3 Implement graceful shutdown: stop consuming new work, await in-flight until deadline
- [x] 4.4 Implement forced shutdown: abort all in-flight, clear queue as needed

## 5. Test Suite

- [x] 5.1 Add unit tests for bounded queue (capacity, FIFO ordering)
- [x] 5.2 Add unit tests for backpressure (`tryEnqueue` fail when full, blocking enqueue waits)
- [x] 5.3 Add unit tests for concurrency limit (never exceed max in-flight)
- [x] 5.4 Add unit tests for in-flight tracking lifecycle (start/finish)
- [x] 5.5 Add unit tests for cancellation (cancelled work completes with terminal CANCELLED)
- [x] 5.6 Add unit tests for timeouts (abort after deadline)
- [x] 5.7 Add unit tests for shutdown modes (graceful waits; forced aborts)

## 6. Minimal Integration Hooks

- [x] 6.1 Provide a minimal in-memory `TaskExecutor` for harness tests (simulated duration + outcome)
- [x] 6.2 Add a test-only harness that saturates the queue to validate backpressure end-to-end
- [x] 6.3 Document intended integration point with scheduler dispatch (slots available, enqueue strategy)
