## Context

Autokestra runtime currently resolves plugins as local directories and executes a fixed source entrypoint (`index.ts`) through Bun. This model is effective for local development but not for remote distribution at scale: installs are not yet immutable, `plugin list` does not represent installed artifacts, and source-style plugin folders with per-plugin dependencies increase disk usage. The roadmap v0.2 requires registry installation with checksums and simple rollback.

## Goals / Non-Goals

**Goals:**
- Add a reproducible plugin distribution flow that installs immutable built artifacts from official HTTP registry, GitHub sources, and direct URL sources.
- Enforce checksum verification before plugin activation.
- Make runtime/CLI support a declared plugin entrypoint (e.g., `dist/index.js`) while keeping backward compatibility with existing `index.ts` plugins.
- Provide simple rollback by preserving previous installed versions and switching active version atomically.

**Non-Goals:**
- Adding plugin signing/trust policy enforcement in this change (deferred to signature-focused epic).
- Replacing plugin process runtime model with native binaries or a different execution technology.
- Implementing a plugin publishing service/UI; this change covers install/consume path.

## Decisions

1. **Distribution artifact contract is bundle-first and immutable**
   - Each installable plugin version is an immutable artifact archive containing `plugin.yaml`, declared entrypoint target (typically `dist/index.js`), and runtime files.
   - Rationale: drastically reduces storage versus source + `node_modules`, and supports deterministic installs.
   - Alternative considered: installing source plugin and running dependency install per plugin. Rejected due to storage growth and non-deterministic dependency graph over time.

2. **Manifest declares runtime entrypoint with backward-compatible fallback**
   - Add manifest metadata field for runtime entrypoint path relative to plugin root.
   - Runtime/CLI launch this declared entrypoint; if absent, fallback to `index.ts` for legacy plugins.
   - Alternative considered: keep hardcoded `index.ts` forever. Rejected because built artifacts need non-source entrypoint and this blocks disk-efficient distribution.

3. **Install pipeline uses staged activation with checksum gate**
   - Pipeline: resolve source -> fetch -> verify checksum -> unpack into staging -> validate manifest/entrypoint -> atomic activation.
   - Activation writes installed metadata and active pointer only after all checks pass.
   - Alternative considered: unpack directly into active plugin path. Rejected due to partial install risk and weak rollback behavior.

4. **Local cache is content-addressed by digest**
   - Cache stores fetched archives by SHA-256 digest and reuses previously verified content.
   - Installed state records source, version, digest, install time, and active/previous versions.
   - Alternative considered: cache by URL only. Rejected because URL may be mutable and does not guarantee integrity.

5. **CLI lifecycle is install-centric with deterministic outcomes**
   - `plugin install`: fetch/verify/install/activate.
   - `plugin list`: report installed artifacts and active version metadata.
   - `plugin remove`: remove active or selected version with rollback-safe behavior.
   - Alternative considered: keeping `list` as local-discovery-only. Rejected because it cannot represent source/version/integrity state required for reproducibility.

6. **Entrypoint policy is strict for registry artifacts in v0.2**
   - For newly published registry artifacts, `runtime.entrypoint` is mandatory in manifest metadata.
   - Backward compatibility remains for legacy local plugins discovered outside registry install state: missing entrypoint falls back to `index.ts`.
   - Alternative considered: keeping entrypoint optional for registry artifacts until v1.0. Rejected because it weakens distribution contract consistency and delays migration.

7. **GitHub source policy is immutable-only in v0.2**
   - GitHub installs support only immutable release assets tied to a specific version/tag.
   - Branch refs and generated tarball refs are rejected by default.
   - Alternative considered: allowing mutable refs for convenience. Rejected because it breaks reproducibility guarantees.

8. **Remove behavior defaults to safe rollback**
   - Removing an active plugin version auto-activates the previous installed version by default.
   - Install state keeps at least 2 installed versions per plugin (active + immediate previous) to guarantee rollback availability.
   - CLI exposes an explicit opt-out (`--no-rollback`) for forced removal behavior.
   - Alternative considered: requiring explicit `--rollback` every time. Rejected because safe default behavior is preferable for production operations.

## Risks / Trade-offs

- **[Risk] Mixed ecosystem during migration (legacy source plugins + built artifacts)** → Mitigation: keep fallback `index.ts` entrypoint resolution and include explicit `entrypoint` validation for newly installed artifacts.
- **[Risk] Registry source heterogeneity increases resolver complexity** → Mitigation: normalize all source types into a single resolved artifact model (`url`, `version`, `checksum`, `sourceType`) before install.
- **[Risk] Checksum handling errors could block valid installs** → Mitigation: require canonical digest format (`sha256:<hex>`), emit deterministic validation errors, add fixture tests per source type.
- **[Risk] Rollback metadata drift from filesystem state** → Mitigation: update state atomically with activation and verify target paths before switching active pointer.

## Migration Plan

1. Add manifest schema support for declared entrypoint with compatibility fallback behavior documented.
2. Add runtime/CLI entrypoint resolution utility: declared entrypoint first, fallback `index.ts`.
3. Introduce registry distribution module and install state/cache layout.
4. Implement CLI `plugin install|list|remove` over install state.
5. Keep existing local plugin discovery operational during migration.
6. Rollback strategy:
   - Runtime/CLI behavior rollback: keep fallback to legacy `index.ts`.
   - Install rollback: switch active version pointer to previous installed artifact; if unavailable, remove active pointer and fail plugin resolution explicitly.

## Open Questions

- None at this stage.
