# RULES

## Purpose

This repository implements Phase 1 of Cube OS: a browser-based, plugin-first core engine. Its job is to provide the foundational runtime services that later phases can build on without introducing application-specific behavior.

The current codebase intentionally focuses on infrastructure:

- Application bootstrap
- Runtime lifecycle orchestration
- Configuration management
- Event dispatch
- Service registry
- Logging
- Error normalization and capture
- Storage abstraction
- Minimal DOM rendering to prove successful boot

It intentionally does not implement application modules, a workspace manager, a window system, a plugin loader, authentication, or cloud sync.

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
- `src/core/bootstrap/root-workspace.ts` renders the minimal Phase 1 workspace shell.

Core subsystems live under `src/core`:

- `bootstrap`: startup orchestration and root rendering
- `config`: immutable configuration defaults and merge logic
- `errors`: consistent error type and centralized error handling
- `events`: in-process event bus
- `logger`: structured logging with level filtering
- `registry`: runtime-owned service/object registry
- `runtime`: lifecycle state machine and service exposure
- `storage`: adapter contract and concrete storage implementations

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
      registry/
      runtime/
      storage/
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

`src/core/index.ts` is the public barrel for the core engine. New reusable core APIs should generally be exported there once they are intended for external consumption.

## Data Flow

The current runtime data flow is:

1. `src/main.ts` calls `bootstrapApplication()`.
2. Bootstrap derives environment config and applies optional runtime overrides.
3. Bootstrap creates `ConfigurationService`, `Registry`, `EventBus`, `Logger`, `ErrorManager`, `StorageService`, and `Runtime`.
4. `Runtime.initialize()` registers services, attaches global handlers, emits `runtime:initialized`, logs startup, and transitions to `running`.
5. Bootstrap resolves the root container and renders the root workspace view.
6. The DOM reflects the current runtime status and workspace text from config.

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
7. Create runtime with all services.
8. Initialize runtime.
9. Resolve the DOM container.
10. Render the root workspace.

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
- Service retrieval should go through `Runtime.getService()` or `Registry.get('services', ...)` rather than ad hoc globals.

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
  - Bootstrap success path, runtime registration, DOM rendering, and live runtime-status sync

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

- The runtime and registry already reserve a `plugins` registry category, but plugin loading is not implemented in Phase 1.
- Future plugin systems should consume stable core services through the runtime/registry rather than bypassing them.
- Any plugin loader must preserve the current separation between the core engine and feature modules.

Do not add plugin-specific behavior into the Phase 1 core without a deliberate architectural change.

## Architectural Invariants

The following must remain true unless `RULES.md` is explicitly updated to reflect a deliberate architectural change:

- The application remains a frontend/browser runtime, not a multi-service backend system.
- `src/main.ts` remains the entrypoint.
- Bootstrap remains the composition root.
- Runtime status changes remain explicit and inspectable.
- Core services remain registrable and accessible by canonical service IDs.
- Configuration remains immutable once built.
- Storage remains abstracted behind `StorageService` and `StorageAdapter`.
- Unexpected errors remain normalized and observable.
- The event bus remains lightweight and duplicate-listener safe.
- Phase 1 remains free of application modules and business-specific logic.

## Must-Not-Break Rules

- Do not remove or silently change `CORE_SERVICE_IDS` without updating all consumers and tests.
- Do not bypass `ConfigurationService` with mutable shared config objects.
- Do not make storage consumers depend directly on `window.localStorage`.
- Do not register duplicate services into the registry.
- Do not render the workspace before the runtime has initialized.
- Do not turn `src/main.ts` into a second composition root.
- Do not treat the presence of `plugins` and `commands` registry categories as proof that those systems already exist.

## Known Intentional Design Decisions

- The Phase 1 UI is intentionally minimal and only proves that the runtime boots.
- The runtime registers existing services in-place instead of recreating them on restart.
- `initialize()` avoids duplicate service registration by checking the registry before registering.
- `LocalStorageAdapter` is only selected when configured and when `window` exists; otherwise bootstrap falls back to memory storage.
- Global browser error handlers are attached only at runtime initialization, not at module import time.
