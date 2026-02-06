## ADDED Requirements

### Requirement: Resolve workflow tasks into a directed acyclic graph
The system MUST transform a workflow definition (tasks + `needs`) into an in-memory directed graph where each task is a node identified by `taskId`, and each dependency is an edge from dependency to dependent task.

#### Scenario: Successful graph resolution
- **WHEN** a workflow contains tasks with unique ids and valid `needs` references
- **THEN** the system produces a graph containing all tasks as nodes and all `needs` as directed edges

### Requirement: Validate task identifiers and dependency references
The system MUST reject workflows where:
- a `taskId` is duplicated,
- a `needs` reference points to a non-existent task,
- a task declares a dependency on itself.

#### Scenario: Duplicate task ids
- **WHEN** two tasks in the same workflow share the same `taskId`
- **THEN** the system fails graph resolution with a validation error that identifies the duplicated id

#### Scenario: Missing dependency reference
- **WHEN** a task declares `needs: ["missing-task"]` and no task has id `missing-task`
- **THEN** the system fails graph resolution with a validation error that identifies the missing dependency id

#### Scenario: Self-dependency
- **WHEN** a task declares `needs: ["itself"]` where `taskId` is `itself`
- **THEN** the system fails graph resolution with a validation error

### Requirement: Detect and reject dependency cycles
The system MUST detect cycles in the dependency graph and MUST reject the workflow if any cycle exists.

#### Scenario: Cycle detection
- **WHEN** tasks form a cycle through `needs` (e.g., A needs B, B needs A)
- **THEN** the system fails graph resolution with an error indicating that a cycle was detected

### Requirement: Provide a deterministic topological ordering
The system MUST be able to produce a deterministic topological ordering of tasks for the resolved graph. When multiple valid next nodes exist, the tie-breaker MUST be stable (e.g., lexical order of `taskId`).

#### Scenario: Deterministic ordering with multiple roots
- **WHEN** two tasks have no dependencies and are both eligible as the next node
- **THEN** the system returns them in a stable deterministic order
