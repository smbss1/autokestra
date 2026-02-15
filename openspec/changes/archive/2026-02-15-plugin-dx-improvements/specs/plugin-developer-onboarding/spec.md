## ADDED Requirements

### Requirement: Canonical first-plugin onboarding path

Documentation MUST provide one canonical end-to-end path for creating, running, validating, and troubleshooting a first plugin.

#### Scenario: New user follows first-plugin guide
- **WHEN** a new plugin author follows the documented path
- **THEN** they can scaffold, run local dev loop, validate, and execute through workflow runtime without undocumented steps

#### Scenario: Onboarding command parity
- **WHEN** onboarding docs reference plugin CLI commands
- **THEN** documented commands and flags match implemented CLI behavior exactly

### Requirement: Plugin troubleshooting guide

Documentation MUST include a troubleshooting section for common plugin authoring failures.

#### Scenario: Manifest validation failure guidance
- **WHEN** user encounters manifest schema errors
- **THEN** docs provide cause categories and concrete fix patterns

#### Scenario: Runtime contract mismatch guidance
- **WHEN** plugin fails because of stdin/stdout contract mismatch
- **THEN** docs provide debugging steps and expected process I/O examples
