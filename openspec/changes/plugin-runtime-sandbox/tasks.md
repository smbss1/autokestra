## 1. Package Structure & Dependencies

- [ ] 1.1 Create `packages/plugin-runtime` directory with package.json and tsconfig
- [ ] 1.2 Create `packages/plugin-sdk` directory with package.json and tsconfig
- [ ] 1.3 Add Extism dependency to plugin-runtime package
- [ ] 1.4 Configure plugin-runtime exports in index.ts
- [ ] 1.5 Configure plugin-sdk exports in index.ts

## 2. Plugin Manifest Schema

- [ ] 2.1 Define TypeScript types for plugin manifest (PluginManifest, PluginAction, PluginPermissions)
- [ ] 2.2 Create JSON Schema for plugin.yaml validation
- [ ] 2.3 Implement manifest parser with YAML loading
- [ ] 2.4 Implement manifest validation with descriptive error messages
- [ ] 2.5 Add tests for valid manifest parsing
- [ ] 2.6 Add tests for invalid manifest rejection (missing fields, invalid formats)

## 3. Permission Model

- [ ] 3.1 Define permission types (NetworkPermission, FilesystemPermission, EnvPermission)
- [ ] 3.2 Implement URL pattern matching for network allowlist
- [ ] 3.3 Implement path pattern matching for filesystem permissions
- [ ] 3.4 Implement glob pattern matching for environment variables
- [ ] 3.5 Create PermissionChecker class with check methods for each permission type
- [ ] 3.6 Implement path traversal prevention for filesystem access
- [ ] 3.7 Add tests for permission checking (allowed, denied, patterns)
- [ ] 3.8 Add tests for path traversal attack prevention

## 4. WASM Sandbox Runtime

- [ ] 4.1 Create WasmRuntime class wrapping Extism plugin API
- [ ] 4.2 Implement plugin loading from WASM file
- [ ] 4.3 Configure resource limits (memory, timeout, stack size)
- [ ] 4.4 Implement host function bindings for permitted operations
- [ ] 4.5 Implement error containment for plugin panics/traps
- [ ] 4.6 Add timeout enforcement with execution termination
- [ ] 4.7 Implement resource cleanup on completion/failure
- [ ] 4.8 Add tests for memory limit enforcement
- [ ] 4.9 Add tests for timeout enforcement
- [ ] 4.10 Add tests for error containment (plugin crash doesn't crash host)

## 5. Host Functions

- [ ] 5.1 Define host function interface for HTTP requests
- [ ] 5.2 Implement HTTP host function with permission checking
- [ ] 5.3 Define host function interface for filesystem operations
- [ ] 5.4 Implement filesystem host functions with permission checking
- [ ] 5.5 Define host function interface for environment variable access
- [ ] 5.6 Implement env host function with permission checking
- [ ] 5.7 Implement logging host function (no permission required)
- [ ] 5.8 Add tests for host function permission enforcement
- [ ] 5.9 Add tests for HTTP host function request/response handling

## 6. Plugin SDK - Core Interface

- [ ] 6.1 Define PluginContext interface with optional capabilities
- [ ] 6.2 Define PluginAction<TInput, TOutput> type
- [ ] 6.3 Implement definePlugin() function for plugin definition
- [ ] 6.4 Implement defineAction<TInput, TOutput>() function for action definition
- [ ] 6.5 Create HTTP client wrapper for context.http
- [ ] 6.6 Create filesystem wrapper for context.fs
- [ ] 6.7 Create environment wrapper for context.env
- [ ] 6.8 Create logger wrapper for context.log
- [ ] 6.9 Add tests for SDK type definitions

## 7. Plugin SDK - Validation

- [ ] 7.1 Implement input validation using JSON Schema
- [ ] 7.2 Implement output validation using JSON Schema
- [ ] 7.3 Add validation error formatting with field paths
- [ ] 7.4 Add tests for input validation (valid/invalid)
- [ ] 7.5 Add tests for output validation (valid/invalid)

## 8. Plugin Lifecycle Management

- [ ] 8.1 Create PluginManager class for plugin lifecycle
- [ ] 8.2 Implement plugin resolution from task type to plugin path
- [ ] 8.3 Implement on-demand plugin loading
- [ ] 8.4 Implement LRU cache for loaded plugins
- [ ] 8.5 Configure cache TTL and size limits
- [ ] 8.6 Implement plugin unloading and resource cleanup
- [ ] 8.7 Implement engine shutdown cleanup
- [ ] 8.8 Add tests for plugin resolution
- [ ] 8.9 Add tests for cache behavior (hit, miss, eviction)
- [ ] 8.10 Add tests for cleanup on shutdown

## 9. Plugin Execution

- [ ] 9.1 Create PluginExecutor class for action invocation
- [ ] 9.2 Implement execution context creation with permissions
- [ ] 9.3 Implement action invocation with input/output marshaling
- [ ] 9.4 Handle plugin errors and convert to task failures
- [ ] 9.5 Implement execution metrics collection
- [ ] 9.6 Add tests for successful action execution
- [ ] 9.7 Add tests for action error handling
- [ ] 9.8 Add tests for context isolation between invocations

## 10. Worker Pool Integration

- [ ] 10.1 Extend worker pool to detect plugin task types
- [ ] 10.2 Route plugin tasks to PluginExecutor
- [ ] 10.3 Pass task inputs and secrets to plugin context
- [ ] 10.4 Capture plugin outputs for task completion
- [ ] 10.5 Add integration tests for end-to-end plugin task execution

## 11. Audit Logging

- [ ] 11.1 Define audit log event types for permission checks
- [ ] 11.2 Implement permission check logging (granted/denied)
- [ ] 11.3 Configure audit log level (verbose vs security-only)
- [ ] 11.4 Add tests for audit log generation

## 12. CLI Plugin Commands

- [ ] 12.1 Implement `workflow plugin list` command
- [ ] 12.2 Implement `workflow plugin inspect <plugin>` command with permission display
- [ ] 12.3 Add security warning for overly broad permissions
- [ ] 12.4 Add tests for CLI commands

## 13. Documentation

- [ ] 13.1 Document plugin.yaml manifest format
- [ ] 13.2 Document SDK usage with examples
- [ ] 13.3 Document permission model and security considerations
- [ ] 13.4 Document plugin build process

## 14. Example Plugin

- [ ] 14.1 Create example HTTP plugin using SDK
- [ ] 14.2 Add plugin.yaml manifest for example plugin
- [ ] 14.3 Add build script for example plugin
- [ ] 14.4 Add integration test using example plugin
