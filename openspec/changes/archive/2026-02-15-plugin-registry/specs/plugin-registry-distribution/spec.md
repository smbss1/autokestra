## ADDED Requirements

### Requirement: Registry source resolution
The system MUST resolve plugin install references from three source types: official HTTP registry, GitHub release/repository source, and direct URL source.

#### Scenario: Resolve official registry reference
- **WHEN** user runs `workflow plugin install core/bash@0.1.0`
- **THEN** the resolver returns an immutable artifact descriptor including version, download URL, and checksum

#### Scenario: Resolve GitHub source reference
- **WHEN** user runs `workflow plugin install github:owner/repo@v1.2.3`
- **THEN** the resolver returns a concrete immutable artifact URL and checksum metadata

#### Scenario: Reject mutable GitHub references
- **WHEN** user runs `workflow plugin install github:owner/repo@main` or a non-release tarball reference
- **THEN** install fails with an error indicating that only immutable GitHub release assets are supported

#### Scenario: Resolve direct URL source
- **WHEN** user runs `workflow plugin install url:https://example.com/plugins/bash-0.1.0.tgz --checksum sha256:<hex>`
- **THEN** the resolver accepts the source only when a checksum is provided and checksum format is valid

#### Scenario: Reject direct URL without checksum
- **WHEN** user runs `workflow plugin install url:https://example.com/plugins/bash-0.1.0.tgz` without `--checksum`
- **THEN** install fails with an error requiring an explicit checksum for direct URL sources

### Requirement: Immutable version installation
The install workflow MUST install immutable plugin versions and MUST NOT mutate already installed version contents.

#### Scenario: Install specific immutable version
- **WHEN** user installs `core/bash@0.1.0`
- **THEN** the system installs that exact version and records it as immutable in local install state

#### Scenario: Reinstall same version
- **WHEN** user installs a plugin version that is already installed and validated
- **THEN** the system reuses existing installed artifact or cache content without mutating the version payload

### Requirement: Checksum verification gate
The system MUST verify artifact checksum before activation and MUST fail install when checksum validation fails.

#### Scenario: Checksum match
- **WHEN** downloaded artifact digest equals expected digest
- **THEN** install continues to unpack/validate/activate steps

#### Scenario: Checksum mismatch
- **WHEN** downloaded artifact digest differs from expected digest
- **THEN** install fails with integrity error and no activation occurs

### Requirement: Content-addressed artifact cache
The system MUST cache downloaded artifacts by digest and SHOULD reuse cache entries for subsequent installs of the same digest.

#### Scenario: Cache hit reuse
- **WHEN** an install request references a digest already present in cache
- **THEN** the system skips network download and reuses cached artifact bytes

#### Scenario: Cache miss fetch
- **WHEN** digest is absent from cache
- **THEN** the system downloads artifact, verifies checksum, and stores it under digest-addressed cache path

### Requirement: Rollback-capable activation
The system MUST activate plugin versions atomically and preserve rollback metadata for simple rollback.

#### Scenario: Successful activation
- **WHEN** staging validation succeeds
- **THEN** install state marks new version active atomically and records previous active version

#### Scenario: Minimum retained versions
- **WHEN** plugin install state is updated after activation
- **THEN** the system retains at least 2 installed versions per plugin (active and immediate previous)

#### Scenario: Rollback after remove or failed activation
- **WHEN** active version is removed or activation fails after staging
- **THEN** system can switch active pointer to previous installed version without re-downloading
