# execution-state-machine Specification

## Purpose
TBD - created by archiving change execution-model-states. Update Purpose after archive.
## Requirements
### Requirement: Execution states are explicitly defined
The system SHALL represent the lifecycle of a workflow execution using the states: PENDING, RUNNING, WAITING, SUCCESS, FAILED, CANCELLED.

#### Scenario: Execution created
- **WHEN** an execution instance is created
- **THEN** its initial state is PENDING

### Requirement: Task run states are explicitly defined
The system SHALL represent the lifecycle of a task run using the states: PENDING, RUNNING, WAITING, SUCCESS, FAILED, CANCELLED.

#### Scenario: Task run created
- **WHEN** a task run is created for an execution
- **THEN** its initial state is PENDING

### Requirement: Transitions are controlled by a state machine
The system SHALL apply state transitions via a single, explicit state machine that enforces allowed transitions and invariants.

#### Scenario: Invalid transition is rejected
- **WHEN** a transition is requested that is not allowed by the state machine
- **THEN** the transition is rejected and an error is returned

### Requirement: Terminal states are immutable
The system SHALL treat SUCCESS, FAILED, and CANCELLED as terminal states.

#### Scenario: Transition from terminal state
- **WHEN** an execution is in a terminal state
- **THEN** any further transition request is rejected as invalid

### Requirement: Transitions are idempotent
The system SHALL ensure transitions are idempotent such that applying the same transition event multiple times yields the same resulting state.

#### Scenario: Duplicate event replay
- **WHEN** the same transition event is applied more than once
- **THEN** the final state remains unchanged after the first application

### Requirement: WAITING state has explicit reasons
The system SHALL require WAITING state transitions to carry a reason indicating why progress is paused (e.g., dependency, backoff, external event).

#### Scenario: Task run enters WAITING
- **WHEN** a task run transitions to WAITING
- **THEN** the state includes a machine-readable reason code

