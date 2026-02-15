## 1. Manifest & Entrypoint Contract

- [ ] 1.1 Extend plugin manifest schema/types with `runtime.entrypoint` required for registry artifacts and validation rules (relative non-empty path)
- [ ] 1.2 Add manifest parser tests for valid declared entrypoint, invalid absolute path, and empty path
- [ ] 1.3 Document compatibility behavior: registry artifacts require declared entrypoint; legacy local plugins fallback to `index.ts`

## 2. Runtime & CLI Entrypoint Resolution

- [ ] 2.1 Implement shared entrypoint resolution helper (manifest-declared entrypoint + legacy fallback)
- [ ] 2.2 Update plugin runtime process executor to use resolved entrypoint instead of hardcoded `index.ts`
- [ ] 2.3 Update CLI plugin local execution paths (`validate`/`dev`) to use the same resolved entrypoint logic
- [ ] 2.4 Add regression tests for declared entrypoint execution and fallback execution

## 3. Registry Distribution Core

- [ ] 3.1 Implement source resolver abstraction for official registry, GitHub, and direct URL references
- [ ] 3.2 Enforce immutable GitHub source policy (release assets only; reject branch/tarball refs)
- [ ] 3.3 Implement artifact download with content-addressed cache keyed by checksum digest
- [ ] 3.4 Implement checksum verification gate (`sha256:<hex>`) before unpack/activation
- [ ] 3.5 Implement staged unpack + manifest validation + atomic activation
- [ ] 3.6 Persist installed plugin metadata (source, version, checksum, active/previous versions)

## 4. CLI Install/List/Remove

- [ ] 4.1 Implement `workflow plugin install` with deterministic exit codes and JSON output
- [ ] 4.2 Implement `workflow plugin list` to show installed artifacts and active version metadata
- [ ] 4.3 Implement `workflow plugin remove` with default auto-rollback and explicit `--no-rollback` opt-out
- [ ] 4.4 Add CLI integration tests for source resolution errors, checksum mismatch, and successful install/list/remove flows

## 5. Rollback & Migration Safety

- [ ] 5.1 Implement active-version rollback operation using preserved previous version metadata (default remove behavior)
- [ ] 5.2 Enforce retention policy keeping at least 2 installed versions per plugin
- [ ] 5.3 Add failure-path tests to ensure failed install never mutates active plugin state
- [ ] 5.4 Add mixed-mode tests for legacy source plugins and new built-artifact plugins coexisting

## 6. Documentation & Release Gate

- [ ] 6.1 Update plugin distribution docs with artifact format, checksum requirements, and publication options
- [ ] 6.2 Add examples for built plugin package layout (`plugin.yaml` + `dist/index.js`)
- [ ] 6.3 Add release-gate checklist entries for reproducible install, checksum verification, and rollback validation
