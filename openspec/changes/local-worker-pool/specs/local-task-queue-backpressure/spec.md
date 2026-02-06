## ADDED Requirements

### Requirement: Provide a bounded local task queue
The system MUST provide an in-memory task queue with a configurable capacity limit.

#### Scenario: Enqueue succeeds when queue has capacity
- **WHEN** a work item is enqueued and the queue is below capacity
- **THEN** the enqueue operation succeeds and the item becomes available for dequeue

#### Scenario: Queue reports full when at capacity
- **WHEN** the queue has reached its configured capacity
- **THEN** the queue reports that it is full

### Requirement: Support deterministic FIFO dequeue order
The queue MUST return items in deterministic FIFO order.

#### Scenario: FIFO dequeue ordering
- **WHEN** three work items are enqueued in order A then B then C
- **THEN** dequeuing returns A then B then C

### Requirement: Expose backpressure behavior
The queue MUST expose a deterministic backpressure mechanism for producers.

#### Scenario: Try-enqueue fails when full
- **WHEN** a producer calls a non-blocking enqueue operation while the queue is full
- **THEN** the operation fails without modifying the queue

#### Scenario: Blocking enqueue waits for capacity
- **WHEN** a producer calls a blocking enqueue operation while the queue is full
- **THEN** the operation waits until capacity is available and then enqueues the item
