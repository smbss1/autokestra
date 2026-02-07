## Context

The Autokestra workflow engine requires a plugin system that allows third-party code execution without compromising host security. Currently, the engine has a worker pool capable of executing tasks, but no mechanism for loading and running plugin code. The core challenge is executing untrusted TypeScript code in a sandboxed environment with fine-grained permission controls.

**Current state:**
- Worker pool exists (`packages/engine/src/worker/`) with task execution infrastructure
- Task types reference plugins via `type: <namespace>/<plugin>.<action>` but no plugin loading exists
- No plugin SDK or build tooling for plugin authors
- No permission model implementation

**Constraints:**
- Must run on modest hardware (2 CPU / 4GB RAM)
- Bun runtime (not Node.js) - affects WASM runtime choices
- Must support TypeScript plugins (primary language for ecosystem)
- Zero permissions by default - explicit grants required

## Goals / Non-Goals

**Goals:**
- Secure WASM sandbox for plugin execution with memory isolation
- Permission enforcement for network, filesystem, and environment access
- TypeScript SDK for plugin authors with type-safe action definitions
- Plugin manifest validation for metadata and permission declarations
- Integration with existing worker pool for task dispatch
- Plugin lifecycle management (load, cache, execute, cleanup)

**Non-Goals:**
- Plugin registry/distribution (future milestone)
- Plugin versioning and dependency resolution
- Hot-reload of plugins during execution
- Multi-language plugin support (only TypeScript in v1)
- GUI for plugin management
- Plugin-to-plugin communication (v1 - future enhancement)

## Decisions

### 1. WASM Runtime: Extism

**Decision:** Use Extism as the WASM runtime layer.

**Rationale:**
- Built on Wasmtime with proven security model
- First-class TypeScript/JavaScript support via PDK
- Simple host function binding for permission checks
- Bun compatibility through native bindings
- Active community and good documentation

**Alternatives considered:**
- **Wasmer**: Good performance but more complex integration, less TypeScript-friendly
- **WasmEdge**: Excellent WASI support but heavier footprint
- **Raw Wasmtime**: Maximum control but requires building all abstractions ourselves

### 2. Plugin SDK Architecture: Action-Based with Context

**Decision:** SDK provides typed action handlers that receive a context object with controlled capabilities.

```typescript
// Plugin author interface
export interface PluginAction<TInput, TOutput> {
  (input: TInput, context: PluginContext): Promise<TOutput>;
}

export interface PluginContext {
  log: Logger;
  http: HttpClient;      // Only if network permission granted
  fs: FileSystem;        // Only if filesystem permission granted
  env: EnvReader;        // Only if env permission granted
  secrets: SecretReader; // Injected based on task config
}
```

**Rationale:**
- Type safety for plugin authors
- Permission-aware API surface (capabilities only present if granted)
- Familiar pattern for TypeScript developers
- Easy to test plugins in isolation

**Alternatives considered:**
- **Global imports**: Less explicit, harder to control permissions
- **Callback-based**: More complex for plugin authors

### 3. Permission Model: Declarative Allowlist

**Decision:** Permissions declared in plugin.yaml, enforced at runtime via host functions.

```yaml
# plugin.yaml
permissions:
  network:
    - "https://api.example.com/*"
    - "https://*.internal.corp/*"
  filesystem:
    read: ["/data/input"]
    write: ["/data/output"]
  env:
    - "API_KEY"
    - "DEBUG_*"
```

**Rationale:**
- Declarative permissions are auditable and reviewable
- Allowlist (not blocklist) follows zero-trust principle
- Glob patterns balance flexibility and security
- Can be displayed during plugin install for user review

**Enforcement:**
- Host functions check permissions before performing operations
- Missing permission → throw PermissionDeniedError
- All permission checks are logged for audit

### 4. Plugin Build Pipeline: esbuild + js2wasm

**Decision:** Use esbuild to bundle TypeScript, then compile to WASM using Extism js2wasm toolchain.

**Build flow:**
```
plugin-src/*.ts → esbuild bundle → plugin.js → js2wasm → plugin.wasm
```

**Rationale:**
- esbuild is fast and Bun-compatible
- Extism provides js2wasm for JavaScript → WASM compilation
- Single output artifact (plugin.wasm + plugin.yaml)
- Reproducible builds for supply chain security

### 5. Plugin Loading: On-Demand with Caching

**Decision:** Plugins loaded on first task execution, cached in memory for reuse.

**Lifecycle:**
1. Task dispatched with `type: namespace/plugin.action`
2. Check plugin cache by plugin ID
3. If not cached: load plugin.wasm, validate manifest, instantiate
4. Execute action with sandboxed context
5. Plugin instance remains cached until TTL or memory pressure

**Rationale:**
- Avoids loading unused plugins
- Amortizes WASM instantiation cost across executions
- Memory-bounded cache prevents resource exhaustion

### 6. Package Structure

**Decision:** Two new packages:
- `packages/plugin-sdk`: Published for plugin authors
- `packages/plugin-runtime`: Internal, handles WASM execution

**Rationale:**
- Clear separation of concerns
- SDK can be versioned independently for ecosystem stability
- Runtime implementation details hidden from plugin authors

## Risks / Trade-offs

**[Risk] Extism Bun compatibility issues**
→ Mitigation: Validate with spike before full implementation. Fallback to FFI bindings if needed.

**[Risk] WASM cold start latency**
→ Mitigation: Plugin caching, pre-warming for frequently used plugins. Measure and optimize during benchmarking.

**[Risk] JavaScript-to-WASM compilation limitations**
→ Mitigation: Document SDK constraints clearly. Avoid async patterns that don't compile well.

**[Risk] Permission bypass through WASI**
→ Mitigation: Disable default WASI capabilities, only enable via explicit host functions.

**[Trade-off] No plugin-to-plugin calls in v1**
→ Simplifies security model significantly. Can add later with explicit permission grants.

**[Trade-off] TypeScript-only plugins**
→ Covers primary use case. Other languages can be added later with same WASM interface.

## Open Questions

1. **Plugin artifact format**: Should we use a single `.wasm` file or a tarball with manifest and WASM?
2. **Resource limits**: What are appropriate defaults for memory (64MB?) and execution time (30s?)?
3. **Secret injection**: How should secrets be passed to plugin context - eager loading or lazy fetch?
4. **Error boundaries**: Should plugin panics/crashes affect only current task or require worker restart?
