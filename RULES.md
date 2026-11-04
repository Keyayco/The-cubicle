# RULES

## Purpose

This repository implements the Cube browser runtime foundation plus an initial workspace manager and plugin lifecycle manager. Its job is to provide the foundational runtime services that later phases can build on without introducing application-specific behavior.

The current codebase intentionally focuses on infrastructure:

- Application bootstrap
- Runtime lifecycle orchestration
- Configuration management
- Event dispatch
- Service registry
- Logging
- Error normalization and capture
- Storage abstraction
- Workspace state management
- Plugin registration and lifecycle control
- Minimal DOM rendering to prove successful boot and visualize workspace and plugin state

It intentionally does not implement application modules, a window system, dynamic plugin loading from external modules, authentication, or cloud sync.

## Architectural Philosophy

- Keep Phase 1 small and production-oriented.
- Prefer explicit service boundaries over hidden global state.
- Centralize orchestration in bootstrap and runtime code.
- Expose stable contracts before implementing higher-level features.
- Keep modules decoupled through interfaces, immutable config, and events.
- Default to browser execution, but keep core services testable in non-persistent or simulated environments.

## Current Architecture

The application is a single Vite-powered frontend entrypoint:

- `index.html` provides the `#app` mount point.
- `src/main.ts` imports styles and calls `bootstrapApplication()`.
- `src/core/bootstrap/bootstrap.ts` wires all core services together.
- `src/core/bootstrap/root-workspace.ts` renders the current workspace shell.

Core subsystems live under `src/core`:

- `bootstrap`: startup orchestration and root rendering
- `config`: immutable configuration defaults and merge logic
- `errors`: consistent error type and centralized error handling
- `events`: in-process event bus
- `logger`: structured logging with level filtering
- `plugins`: plugin registration, lifecycle control, and failure isolation
- `registry`: runtime-owned service/object registry
- `runtime`: lifecycle state machine and service exposure
- `storage`: adapter contract and concrete storage implementations
- `workspace`: persisted workspace state and active-item coordination

## Directory Structure

```text
/
  README.md
  RULES.md
  STATE.md
  HANDOVER.md
  LOGS.md
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts
    styles.css
    core/
      bootstrap/
      config/
      errors/
      events/
      logger/
      plugins/
      registry/
      runtime/
      storage/
      workspace/
      index.ts
  tests/
    core-engine.test.ts
```

## Module Responsibilities

### `src/core/bootstrap`

- Build the runtime configuration from defaults, environment-derived values, and optional runtime overrides.
- Instantiate the core services in a single place.
- Select the storage adapter from configuration and runtime environment.
- Initialize the runtime before rendering.
- Resolve the root DOM container and fail fast if it does not exist.

### `src/core/config`

- Define the public `CubeConfig` shape.
- Provide immutable default configuration via `DEFAULT_CONFIG`.
- Merge defaults, environment config, and runtime overrides.
- Freeze the resulting configuration snapshot before exposing it.

### `src/core/errors`

- Provide `CubeError` as the canonical error type.
- Normalize unknown thrown values into `CubeError`.
- Capture unexpected failures, log them, and emit `system:error`.
- Attach and detach browser-level global error handlers when running in the browser.

### `src/core/events`

- Provide a lightweight event bus for intra-runtime communication.
- Prevent duplicate listener registration by storing listeners in `Set`s.
- Emit event envelopes containing type, payload, and metadata.

### `src/core/logger`

- Provide structured log entries with a consistent level model.
- Filter messages by enabled state and minimum log level.
- Use a sink-based design so output behavior can be swapped in the future.

### `src/core/plugins`

- Define the `CubePlugin` lifecycle contract and the `PluginContext` handed to plugins.
- Register and track plugin definitions through the `plugins` registry category.
- Drive `register`, `activate`, `deactivate`, `activateAll`, and `deactivateAll` lifecycles.
- Isolate plugin failures by normalizing errors, emitting `plugin:failed`, and marking status `error`.
- Expose plugin descriptors, status, and lookup helpers.

### `src/core/registry`

- Provide categorized runtime storage for registrable objects.
- Support `services`, `plugins`, and `commands` categories.
- Reject duplicate registrations in a category.

### `src/core/runtime`

- Own lifecycle state transitions.
- Register core services into the registry.
- Expose service access helpers.
- Emit runtime lifecycle events.
- Coordinate error handler attachment and detachment.

### `src/core/storage`

- Define the `StorageAdapter` contract.
- Provide `StorageService` as the stable abstraction used by the rest of the runtime.
- Provide `LocalStorageAdapter` for browser persistence with namespacing.
- Provide `MemoryStorageAdapter` for tests and non-persistent execution.

### `src/core/workspace`

- Hydrate workspace state from storage and backfill default system items.
- Track registered workspace items and the active item.
- Persist workspace mutations through `StorageService`.
- Emit workspace lifecycle and state-change events.

## Important Abstractions

### `CubeConfig`

The runtime configuration contract. It currently covers:

- App identity
- Environment mode and debug flag
- Logging settings
- Storage driver and namespace
- Workspace root element and display text

### `ConfigurationService`

Owns the current immutable configuration snapshot. Callers can read the full config or a section, but should not mutate it.

### `EventBus`

Provides `on`, `off`, `emit`, `clear`, and `listenerCount` for process-local event communication.

### `Registry`

Provides `register`, `unregister`, `get`, `has`, `list`, and `entries` over fixed categories.

### `Runtime`

Coordinates startup, shutdown, restart, status tracking, service registration, and lifecycle events.

### `StorageAdapter` and `StorageService`

All runtime code should depend on `StorageService` or the `StorageAdapter` contract, not on `window.localStorage` directly.

### `WorkspaceManager`

Owns the current workspace snapshot, persists it, and exposes operations for item registration, activation, and removal.

### `PluginManager`

Owns the plugin registry and lifecycle. Plugins receive a `PluginContext` exposing the event bus, logger, registry, and workspace manager, so plugin surfaces register workspace items through `WorkspaceManager` rather than touching the DOM.

### `CubePlugin` and `PluginContext`

A plugin declares `id`, `name`, `version`, an optional `description`, an `activate(context)` hook, and an optional `deactivate(context)` hook. Hooks may be synchronous or asynchronous. The context is the only sanctioned channel for a plugin to reach core services.

### `CubeError` and `ErrorManager`

Errors should be normalized and routed through the central error manager for consistency and observability.

## Core Interfaces And Types

Important public contracts currently exported through `src/core/index.ts` include:

- `BootstrapOptions`
- `BootstrapResult`
- `CubeConfig`
- `DeepPartial`
- `ConfigurationService`
- `CubeError`
- `ErrorManager`
- `SystemEvent`
- `EventListener`
- `EventBus`
- `LogLevel`
- `LogEntry`
- `LoggerContract`
- `Logger`
- `RegistryCategory`
- `Registry`
- `CoreServiceId`
- `CORE_SERVICE_IDS`
- `RuntimeStatus`
- `RuntimeServices`
- `Runtime`
- `StorageAdapter`
- `StorageService`
- `LocalStorageAdapter`
- `MemoryStorageAdapter`
- `WorkspaceItem`
- `WorkspaceSnapshot`
- `WorkspaceManager`
- `CubePlugin`
- `PluginContext`
- `PluginDescriptor`
- `PluginStatus`
- `PluginManager`

`src/core/index.ts` is the public barrel for the core engine. New reusable core APIs should generally be exported there once they are intended for external consumption.

## Data Flow

The current runtime data flow is:

1. `src/main.ts` calls `bootstrapApplication()`.
2. Bootstrap derives environment config and applies optional runtime overrides.
3. Bootstrap creates `ConfigurationService`, `Registry`, `EventBus`, `Logger`, `ErrorManager`, `StorageService`, `WorkspaceManager`, and `PluginManager`.
4. `Runtime.initialize()` registers services, attaches global handlers, emits `runtime:initialized`, logs startup, and transitions to `running`.
5. `WorkspaceManager.initialize()` hydrates persisted workspace state and backfills seed items.
6. `PluginManager.activateAll()` activates registered plugins, which may contribute workspace items through the context.
7. Bootstrap resolves the root container and renders the root workspace view.
8. The DOM reflects the current runtime status, workspace summary, active workspace item, and plugin summary.

During failures:

1. Unknown errors are normalized into `CubeError`.
2. `ErrorManager.capture()` logs the error.
3. `ErrorManager.capture()` emits `system:error` when an event bus exists.
4. Runtime initialization additionally emits `runtime:failed` and rethrows the normalized error.

## Bootstrap Sequence

The initialization order in `bootstrapApplication()` is intentional:

1. Build configuration.
2. Create registry.
3. Create event bus.
4. Create logger using current logging config.
5. Create error manager using logger and event bus.
6. Create storage service using the selected adapter.
7. Create workspace manager.
8. Create plugin manager.
9. Create runtime with all services.
10. Initialize runtime.
11. Hydrate the workspace manager.
12. Activate registered plugins.
13. Resolve the DOM container.
14. Render the root workspace.

Do not render before `Runtime.initialize()` completes successfully.

## Runtime Lifecycle

The runtime uses these statuses:

- `created`
- `initializing`
- `running`
- `stopping`
- `stopped`
- `error`

Lifecycle behavior:

- `initialize()` is idempotent for `running` and `initializing`.
- `shutdown()` is idempotent for `stopping` and `stopped`.
- `restart()` emits `runtime:restart-requested`, then calls `shutdown()` and `initialize()` in sequence.

Lifecycle events currently emitted:

- `runtime:status-changed`
- `runtime:initialized`
- `runtime:failed`
- `runtime:shutdown-requested`
- `runtime:stopped`
- `runtime:restart-requested`
- `workspace:initialized`
- `workspace:state-changed`
- `workspace:item-registered`
- `workspace:item-removed`
- `workspace:active-item-changed`
- `plugin:registered`
- `plugin:activated`
- `plugin:deactivated`
- `plugin:failed`

## Event System

- Events are identified by freeform string types.
- Emitted events include metadata with a timestamp and optional source.
- Listeners are stored by event type.
- Duplicate subscriptions of the same listener to the same event type collapse naturally because the backing collection is a `Set`.
- The event bus is synchronous; listeners run during `emit()`.

If asynchronous or buffered delivery is added later, it must be introduced deliberately because it would change observable behavior.

## Registry System

- The registry owns fixed categories: `services`, `plugins`, `commands`.
- `register()` throws on duplicate identifiers in a category.
- Runtime core services are registered under the `services` category using `CORE_SERVICE_IDS`.
- Plugin definitions are stored under the `plugins` category, keyed by plugin id.
- Service retrieval should go through `Runtime.getService()` or `Registry.get('services', ...)` rather than ad hoc globals.
- The `commands` category remains reserved and unimplemented.

## Workspace System

- `WorkspaceManager` is the runtime-facing abstraction for workspace state.
- Workspace state is persisted under a storage key and restored on the next boot.
- Seed items are merged back in when missing so new system panels can appear after upgrades.
- The root workspace UI reflects the active workspace item and listens for `workspace:state-changed`.

## Plugin System

- `PluginManager` is the runtime-facing abstraction for plugin lifecycle.
- Plugin definitions live in the `plugins` registry category and are keyed by id; duplicates are rejected.
- Lifecycle status is tracked per plugin: `registered`, `activated`, `deactivated`, `error`.
- `activateAll()` activates plugins in registration order; `deactivateAll()` runs in reverse order.
- A plugin reaches core services only through `PluginContext`; it must not import browser globals or mutate the DOM directly.
- Plugin surfaces should contribute workspace items via `context.workspace.registerItem()` with `kind: 'plugin'`.
- A failing activation or deactivation is normalized to a `CubeError`, emitted as `plugin:failed`, marks the plugin `error`, and rethrows.
- Dynamic loading of plugin code from external modules is out of scope; plugins are registered programmatically.

## Storage System

- `StorageService` is the runtime-facing abstraction.
- `StorageAdapter` is the backend contract.
- Browser persistence is provided by `LocalStorageAdapter`.
- Tests and non-persistent execution use `MemoryStorageAdapter`.
- Local storage keys are namespaced as `<namespace>:<key>`.

Do not couple higher-level modules directly to a specific storage backend.

## Error Handling

- Normalize unknown throwables with `normalizeError()`.
- Use `CubeError` for consistent error codes and optional structured details.
- Route unexpected runtime failures through `ErrorManager.capture()` when feasible.
- Browser global handlers are attached only when `window` exists.

## Logging

- Logging is controlled by `enabled` and `level` from config.
- Levels are `debug`, `info`, `warn`, `error`, and `silent`.
- The logger writes structured entries through a sink.
- The default sink prefixes console output with `[Cube]`.

## Testing Architecture

- Tests use Vitest with the `jsdom` environment.
- Current coverage is integration-lite and focused on key core guarantees:
  - Event bus duplicate listener behavior and unsubscribe flow
  - Registry CRUD behavior
  - Storage service behavior via the memory adapter
  - Runtime lifecycle transition behavior across initialize, shutdown, and restart
  - Workspace hydration, persistence, and rehydration behavior
  - Plugin registration, activation/deactivation ordering, failure isolation, and workspace contribution
  - Bootstrap success path, runtime registration, DOM rendering, and live runtime-status, workspace, and plugin sync

Additional tests should focus on behavior contracts and lifecycle invariants rather than implementation trivia.

## Dependency Rules

- `src/main.ts` should remain thin and delegate orchestration to `src/core`.
- Cross-subsystem coupling should happen through exported contracts, not deep implicit knowledge.
- Bootstrap is allowed to know about all core subsystems because it is the composition root.
- Higher-level code should depend on `StorageService`, `LoggerContract`, `ConfigurationService`, `EventBus`, and `Registry` rather than browser globals or ad hoc singletons.
- Runtime service identifiers should come from `CORE_SERVICE_IDS`, not duplicated string literals.

## Import And Export Conventions

- Reusable public core APIs should be exported from `src/core/index.ts`.
- Prefer type-only imports where appropriate.
- Keep browser entry imports simple: `src/main.ts` should import the public core API rather than deep internal paths.
- Avoid reaching across subsystem boundaries through deep relative imports unless the dependency is part of the owning subsystem's internal implementation.

## Naming Conventions

- Use descriptive class names for services and managers.
- Use `*Adapter` for storage backends and similar boundary implementations.
- Use `*Service` for stable service abstractions.
- Use `*Manager` for orchestration of cross-cutting concerns.
- Use clear event names with domain prefixes such as `runtime:*` and `system:*`.

## Extension And Plugin Rules

- `PluginManager` implements the `plugins` registry category and the plugin lifecycle.
- Plugins consume stable core services through `PluginContext` rather than bypassing the runtime/registry.
- Plugin workspace surfaces register items through `WorkspaceManager` rather than mutating the DOM directly.
- Dynamic plugin loading from external modules is still out of scope; new plugin systems must preserve the separation between the core engine and feature modules.
- A plugin must never be able to break runtime boot; activation failures are isolated, recorded, and rethrown to the caller.

Do not add plugin-specific product behavior into the core without a deliberate architectural change.

## Architectural Invariants

The following must remain true unless `RULES.md` is explicitly updated to reflect a deliberate architectural change:

- The application remains a frontend/browser runtime, not a multi-service backend system.
- `src/main.ts` remains the entrypoint.
- Bootstrap remains the composition root.
- Runtime status changes remain explicit and inspectable.
- Core services remain registrable and accessible by canonical service IDs.
- Configuration remains immutable once built.
- Storage remains abstracted behind `StorageService` and `StorageAdapter`.
- Workspace state remains observable and persisted through `WorkspaceManager`.
- Plugin lifecycle remains observable through `PluginManager` and plugin events.
- Unexpected errors remain normalized and observable.
- The event bus remains lightweight and duplicate-listener safe.
- The runtime remains free of business-specific logic.

## Must-Not-Break Rules

- Do not remove or silently change `CORE_SERVICE_IDS` without updating all consumers and tests.
- Do not bypass `ConfigurationService` with mutable shared config objects.
- Do not make storage consumers depend directly on `window.localStorage`.
- Do not register duplicate services into the registry.
- Do not render the workspace before the runtime has initialized.
- Do not turn `src/main.ts` into a second composition root.
- Do not treat the presence of the `commands` registry category as proof that a command system exists.
- Do not let plugins bypass `PluginContext` to reach browser globals or internal module state.

## Known Intentional Design Decisions

- The Phase 1 UI is intentionally minimal and only proves that the runtime boots.
- The runtime registers existing services in-place instead of recreating them on restart.
- `initialize()` avoids duplicate service registration by checking the registry before registering.
- `LocalStorageAdapter` is only selected when configured and when `window` exists; otherwise bootstrap falls back to memory storage.
- Global browser error handlers are attached only at runtime initialization, not at module import time.
- Workspace seed items are backfilled into persisted state so new system panels can appear without destroying user state.
