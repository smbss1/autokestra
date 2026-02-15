## 1. Manifest & Entrypoint Contract

- [x] 1.1 Extend plugin manifest schema/types with `runtime.entrypoint` required for registry artifacts and validation rules (relative non-empty path)
- [x] 1.2 Add manifest parser tests for valid declared entrypoint, invalid absolute path, and empty path
- [x] 1.3 Document compatibility behavior: registry artifacts require declared entrypoint; legacy local plugins fallback to `index.ts`

## 2. Runtime & CLI Entrypoint Resolution

- [x] 2.1 Implement shared entrypoint resolution helper (manifest-declared entrypoint + legacy fallback)
- [x] 2.2 Update plugin runtime process executor to use resolved entrypoint instead of hardcoded `index.ts`
- [x] 2.3 Update CLI plugin local execution paths (`validate`/`dev`) to use the same resolved entrypoint logic
- [x] 2.4 Add regression tests for declared entrypoint execution and fallback execution

## 3. Registry Distribution Core

- [x] 3.1 Implement source resolver abstraction for official registry, GitHub, and direct URL references
- [x] 3.2 Enforce immutable GitHub source policy (release assets only; reject branch/tarball refs)
- [x] 3.3 Implement artifact download with content-addressed cache keyed by checksum digest
- [x] 3.4 Implement checksum verification gate (`sha256:<hex>`) before unpack/activation
- [x] 3.5 Implement staged unpack + manifest validation + atomic activation
- [x] 3.6 Persist installed plugin metadata (source, version, checksum, active/previous versions)

## 4. CLI Install/List/Remove

- [x] 4.1 Implement `workflow plugin install` with deterministic exit codes and JSON output
- [x] 4.2 Implement `workflow plugin list` to show installed artifacts and active version metadata
- [x] 4.3 Implement `workflow plugin remove` with default auto-rollback and explicit `--no-rollback` opt-out
- [x] 4.4 Add CLI integration tests for source resolution errors, checksum mismatch, and successful install/list/remove flows

## 5. Rollback & Migration Safety

- [x] 5.1 Implement active-version rollback operation using preserved previous version metadata (default remove behavior)
- [x] 5.2 Enforce retention policy keeping at least 2 installed versions per plugin
- [x] 5.3 Add failure-path tests to ensure failed install never mutates active plugin state
- [x] 5.4 Add mixed-mode tests for legacy source plugins and new built-artifact plugins coexisting

## 6. Documentation & Release Gate

- [x] 6.1 Update plugin distribution docs with artifact format, checksum requirements, and publication options
- [x] 6.2 Add examples for built plugin package layout (`plugin.yaml` + `dist/index.js`)
- [x] 6.3 Add release-gate checklist entries for reproducible install, checksum verification, and rollback validation
