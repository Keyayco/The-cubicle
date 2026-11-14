# RULES

## Purpose

This repository implements the Phase 1 Cube OS core engine, Plugin Loader, Command System, persisted Workspace Manager, and the first Cube + Terminal shell. The shell is a focused browser interface over the existing runtime; it does not turn workspace metadata into applications or add a full desktop environment.

The current codebase intentionally focuses on infrastructure:

- Application bootstrap
- Runtime lifecycle orchestration
- Configuration management
- Event dispatch
- Service registry
- Logging
- Error normalization and capture
- Storage abstraction
- A CSS 3D cube status indicator and command terminal in `src/ui`
- Trusted plugin definition registration and lifecycle
- Command registration, lookup, and execution
- Persisted system/plugin workspace items and active-item selection

It intentionally does not implement command palette or keyboard shortcut UI, workspace sessions, windows, docks, sidebars, app modules, application rendering/activation, authentication, or cloud sync.

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
- `src/main.ts` imports styles and explicitly opts the sample Demo Plugin into `bootstrapApplication()`.
- `src/core/bootstrap/bootstrap.ts` wires all core services together.
- `src/ui/root-workspace.ts` mounts the shell after runtime initialization.
- `src/ui/cube-indicator.ts` and `src/ui/terminal.ts` consume the existing runtime, command, plugin, event, and workspace contracts.

Core subsystems live under `src/core`:

- `bootstrap`: startup orchestration and root rendering
- `config`: immutable configuration defaults and merge logic
- `commands`: command definitions, shared-registry operations, and dispatch
- `errors`: consistent error type and centralized error handling
- `events`: in-process event bus
- `logger`: structured logging with level filtering
- `plugins`: host-provided plugin definitions and runtime-managed lifecycle
- `registry`: runtime-owned service/object registry
- `runtime`: lifecycle state machine and service exposure
- `storage`: adapter contract and concrete storage implementations
- `workspace`: persisted workspace-item metadata and active-item state

Presentation code lives under `src/ui` and does not own core service state. The sample extension is outside core at `src/plugins/demo-plugin.ts`; the default `bootstrapApplication()` still loads no plugins, while the browser host explicitly passes the demo plugin in `BootstrapOptions.plugins`.

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
    ui/
      cube-indicator.ts
      root-workspace.ts
      terminal.ts
    plugins/
      demo-plugin.ts
    core/
      bootstrap/
      commands/
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
    core-hardening.test.ts
    plugin-loader.test.ts
    command-service.test.ts
    demo-plugin.test.ts
    workspace-manager.test.ts
    ui-shell.test.ts
```

### `src/ui`

- Render the Cube + Terminal shell using DOM APIs and text nodes.
- Dispatch registered command IDs through `CommandService.execute()`; do not execute arbitrary shell text or invent command handlers in the presentation layer.
- Display workspace metadata as a placeholder only. There is no application renderer contract.
- Subscribe to existing runtime, plugin, command, and workspace events and remove every subscription when disposed.
- Keep terminal history/logs session-only and bounded; redact sensitive-looking fields and do not store command output in persistent storage.

## Module Responsibilities

### `src/core/bootstrap`

- Build the runtime configuration from defaults, environment-derived values, and optional runtime overrides.
- Instantiate the core services in a single place.
- Select the storage adapter from configuration and runtime environment.
- Hydrate the Workspace Manager before runtime initialization, then render after runtime initialization.
- Resolve the root DOM container and fail fast if it does not exist.

### `src/core/config`

- Define the public `CubeConfig` shape.
- Provide immutable default configuration via `DEFAULT_CONFIG`.
- Merge defaults, environment config, and runtime overrides.
- Freeze the resulting configuration snapshot before exposing it.

### `src/core/commands`

- Register command definitions in the existing `commands` registry category.
- Validate command identifiers and metadata; rely on the shared Registry for duplicate rejection.
- Provide command lookup, listing, unregister, and sync/async execution.
- Emit `command:started`, `command:executed`, and `command:failed` with a matching operation ID; normalize handler failures through `ErrorManager`.
- Remain UI-agnostic: no palette, shortcuts, or workspace-specific commands.

### `src/plugins/demo-plugin.ts`

- Provide a small example `PluginDefinition` outside the core layer.
- Register one greeting command through `PluginContext.commands`.
- Remove that command in the plugin cleanup callback.
- Remain opt-in at the core API level: the default bootstrap does not import, register, or activate it. `src/main.ts` opts it into the browser host using `BootstrapOptions.plugins`.

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

### `src/core/plugins`

- Register trusted, host-provided plugin definitions in the existing `plugins` registry category.
- Activate and deactivate definitions using the shared configuration, event bus, logger, registry, and storage services.
- Report plugin lifecycle events and normalize activation/cleanup failures through `ErrorManager`.
- Keep activation and cleanup synchronous to preserve the current synchronous Runtime lifecycle contract.
- Do not dynamically import arbitrary module paths, sandbox plugin code, or add plugin UI.

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

- Own workspace-item metadata (`id`, `title`, `description`, `kind`) and the active item identifier.
- Load and persist state through `StorageService`; do not access browser storage directly.
- Add missing seed items while retaining saved items and a valid saved active selection.
- Reject malformed items, duplicate identifiers, unknown activation requests, and invalid persisted state with typed `CubeError`s.
- Emit workspace initialization, state, item-registration/removal, and active-item-change events through the shared `EventBus`.
- Be registered under the Runtime `services` category using `CORE_SERVICE_IDS.workspaceManager`; do not add a workspace registry category or parallel registry.
- Remain metadata-only: no sessions, windows, layout, rendering, palette, dock, sidebar, or tabs.

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

### `PluginLoader`

Owns plugin definition lookup and activation state in the central `Registry`. Runtime loads registered definitions during initialization, unloads them in reverse registration order during shutdown, and reloads them on restart.

### `CommandService`

Owns command definition lookup and execution through the same central `Registry`. It does not keep a parallel command map. Command metadata (`id`, `title`, `keywords`) matches the repository's historical workspace-command contract, while dispatch is handled by the core service rather than a UI.

### `WorkspaceManager`

Owns persisted workspace-item metadata and active-item selection. It uses the shared `StorageService` for persistence, `EventBus` for state notifications, and the Runtime service registry for exposure. Seed items are backfilled without replacing saved items or a still-valid saved active selection. It does not own a UI, named workspace sessions, or window state.

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
- `CommandService`
- `CommandExecutionOptions`
- `CommandDefinition`
- `CommandStartedEvent`
- `CommandExecutedEvent`
- `CommandFailedEvent`
- `PluginLoader`
- `PluginDefinition`
- `PluginContext`
- `PluginFailureEvent`
- `PluginStatus`
- `CoreServiceId`
- `CORE_SERVICE_IDS`
- `RuntimeStatus`
- `RuntimeServices`
- `Runtime`
- `StorageAdapter`
- `StorageService`
- `WorkspaceManager`
- `WorkspaceItem`
- `WorkspaceItemKind`
- `WorkspaceState`
- `WorkspaceSnapshot`
- `WorkspaceActiveItemChange`
- `WORKSPACE_STORAGE_KEY`
- `LocalStorageAdapter`
- `MemoryStorageAdapter`

`src/core/index.ts` is the public barrel for the core engine. New reusable core APIs should generally be exported there once they are intended for external consumption.

## Data Flow

The current runtime data flow is:

1. `src/main.ts` calls `bootstrapApplication({ plugins: [demoPlugin] })`; the core bootstrap remains opt-in when no plugin option is supplied.
2. Bootstrap derives environment config, applies optional runtime overrides, and registers only the host-provided plugin definitions.
3. Bootstrap creates core services, including `WorkspaceManager`, then asynchronously hydrates and persists workspace state through `StorageService`.
4. `Runtime.initialize()` registers core services, attaches global handlers, loads registered plugins, emits `runtime:initialized`, logs startup, and transitions to `running`.
5. Plugins register commands through `PluginContext.commands`; all definitions use the shared `Registry` `commands` bucket.
6. `CommandService.execute()` emits `command:started` before lookup/dispatch, then emits `command:executed` or `command:failed` with the same operation ID and event source.
7. Bootstrap resolves the root container and mounts the `src/ui` shell after runtime initialization.
8. The terminal submits exact registered command IDs through `CommandService`; its `help` view reads `CommandService.list()`. It does not interpret arbitrary shell text or arguments.
9. The cube reflects runtime status, active command operation IDs, and plugin outcomes. The workspace area shows the active item's metadata and states that no application renderer is mounted.

The optional demo plugin is not part of default core bootstrap. The browser host explicitly opts it in through `BootstrapOptions.plugins`; the rest of the app can use the same option to provide host-controlled plugins.

Application activation remains unsupported. `PluginDefinition` has lifecycle hooks, and `WorkspaceManager` has item metadata/selection, but there is no contract joining an application alias to a plugin, a workspace item, and a view renderer. Do not treat a workspace item as an installed app. `balances` is not registered and must remain unavailable until a real application is implemented.

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
7. Create `CommandService` with the shared registry, event bus, logger, and error manager.
8. Create the Plugin Loader with the shared registry and services, including `CommandService`.
9. Register only the host-provided definitions in `BootstrapOptions.plugins`.
10. Create `WorkspaceManager` with the shared `EventBus` and `StorageService`.
11. Await `WorkspaceManager.initialize()` with the default seed items; saved items and active selection are retained where valid.
12. Create and initialize Runtime with all core services, including the hydrated Workspace Manager.
13. Resolve the DOM container and mount the shell from `src/ui/root-workspace.ts`.

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
- `initialize()` loads registered plugins before the runtime enters `running`.
- `shutdown()` unloads loaded plugins in reverse registration order before detaching global handlers.

Lifecycle events currently emitted:

- `runtime:status-changed`
- `runtime:initialized`
- `runtime:failed`
- `runtime:shutdown-requested`
- `runtime:stopped`
- `runtime:restart-requested`
- `plugin:loaded`
- `plugin:unloaded`
- `plugin:failed`
- `command:started`
- `command:executed`
- `command:failed`
- `workspace:initialized`
- `workspace:state-changed`
- `workspace:item-registered`
- `workspace:item-removed`
- `workspace:active-item-changed`

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

## Command System

- `CommandService` uses the shared `Registry` `commands` category for storage and duplicate handling.
- Command definitions have an identifier, UI-neutral display metadata (`title`, `keywords`), and an execution handler.
- `CommandService.execute()` emits `command:started` before lookup/dispatch, then awaits synchronous or asynchronous handlers and returns the result.
- Start, success, and failure events carry the same operation ID; the event metadata source identifies the caller when provided.
- Unknown IDs throw `CubeError` with `COMMAND_NOT_FOUND`; handler failures are normalized and captured centrally.
- Plugins receive `CommandService` through `PluginContext.commands`; plugin cleanup owns unregistering commands it registered.
- No keyboard shortcuts, command palette, or workspace-specific commands are part of core.

## Storage System

- `StorageService` is the runtime-facing abstraction.
- `StorageAdapter` is the backend contract.
- Browser persistence is provided by `LocalStorageAdapter`.
- Tests and non-persistent execution use `MemoryStorageAdapter`.
- Local storage keys are namespaced as `<namespace>:<key>`.
- Workspace state is stored under `workspace:state` through the configured adapter.

Do not couple higher-level modules directly to a specific storage backend.

## Workspace Manager

- Workspace items have `id`, `title`, `description`, and `kind` (`system` or `plugin`).
- Default bootstrap seeds `overview`, `runtime`, and `storage` system items.
- Initialization merges missing seed items into saved state, preserving saved item order and a valid active item; a missing/invalid active identifier falls back to the first available item.
- Registration rejects duplicate identifiers; activation of an unknown identifier rejects with `WORKSPACE_ITEM_NOT_FOUND`.
- Removing the active item selects the first remaining item, or `null` when none remain.
- Mutations persist before updating the in-memory state and are serialized to prevent concurrent writes from losing items.
- Returned snapshots and item reads are copies; changing them does not mutate manager state.
- Invalid stored data fails initialization with `WORKSPACE_STATE_INVALID`; there is no automatic destructive recovery or schema migration.
- Plugin-kind items are supported by the manager, but automatic Plugin Loader registration/cleanup integration is not implemented.
- The manager is metadata-only; no UI or window/session model is part of this subsystem.

## Cube + Terminal Shell

- Presentation code remains in `src/ui`, separate from core service ownership.
- The cube derives activity from `command:started`/outcome events, runtime status changes, runtime failures, and plugin load/failure events. It does not claim unimplemented health checks.
- Runtime failure is tracked separately from the last command outcome. A successful command cannot clear an unhealthy Runtime; a later failure updates the cube even when no command is active.
- The cube starts as a neutral CSS 3D element, accelerates while command operations are active, and moves to a static compact corner indicator after success. It uses no canvas or rendering dependency.
- `document.visibilitychange` pauses decorative animation and defers cube DOM updates while hidden. `prefers-reduced-motion` disables motion.
- The terminal dispatches an exact registered command ID through `CommandService`; it does not execute shell text or infer argument types. `help` lists only IDs returned by the shared service.
- Terminal input is disabled while its own command is pending; command operation IDs let the cube track multiple callers concurrently.
- Output uses `textContent`, is session-only, capped at 200 lines and 4,000 characters per line, and redacts sensitive-looking fields and delimited tabular output.
- Terminal lines display the EventBus timestamp when sourced from an event, otherwise the local time when the line is created.
- Terminal event lines are queued in a bounded in-memory buffer while hidden and rendered when the document becomes visible.
- The compact-shrink Web Animation is paused while the document is hidden and canceled when the shell is disposed.
- The workspace area displays the active item's metadata and explicitly states that there is no application renderer.

Application activation is not yet supported. There is no contract joining an app name/command alias to a plugin lifecycle operation, a workspace item, and a renderer. Do not add a second plugin/command registry or claim that `balances` or another workspace item is an installed application.

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
  - Cube state changes for command activity, success/failure, runtime failure after success, concurrent operations, and disposal
  - Terminal submission, unknown and failed commands, command history, duplicate-submit prevention, log retention, and registry-backed help
  - Explicit demo plugin opt-in through bootstrap options; missing application handling
  - Command registration, lookup, validation, execution, events, and plugin integration
  - Workspace item hydration, seed backfill, persistence, mutations, event emission, validation, and concurrency
  - Plugin registration, lookup, activation, cleanup, error handling, and Runtime lifecycle integration
  - Optional Demo Plugin registration, greeting command execution, cleanup, and Runtime restart behavior

Additional tests should focus on behavior contracts and lifecycle invariants rather than implementation trivia.

## Dependency Rules

- Keep `src/main.ts` as a small browser-host entrypoint: it imports the sample plugin and passes the opt-in list to `bootstrapApplication()`.
- Core service wiring remains in `bootstrapApplication()`; host plugin selection is not a second composition root.
- Presentation belongs in `src/ui`; core services must not depend on presentation modules.
- Cross-subsystem coupling should happen through exported contracts, not deep implicit knowledge.
- Bootstrap is allowed to know about all core subsystems because it is the composition root.
- Higher-level code should depend on `StorageService`, `LoggerContract`, `ConfigurationService`, `EventBus`, and `Registry` rather than browser globals or ad hoc singletons.
- Runtime service identifiers should come from `CORE_SERVICE_IDS`, not duplicated string literals.
- Workspace state must use the existing `StorageService`, `EventBus`, and `services` registry category; do not add a second registry.

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

- Register plugin definitions through `PluginLoader`; the existing `Registry` remains the single source of truth for plugin identifiers.
- Plugin activation receives the shared `config`, `eventBus`, `logger`, `registry`, and `storage` services through `PluginContext`.
- Plugins receive the shared `CommandService` through `PluginContext.commands`; command definitions are stored in the same core `Registry`.
- Plugin definitions are trusted host-provided code. The Plugin Loader does not claim to provide isolation or sandboxing.
- `activate` and its optional cleanup callback are synchronous so Runtime lifecycle remains synchronous.
- Plugin failures are normalized, sent through `ErrorManager`, and emitted as `plugin:failed`.
- Keep the Plugin Loader separate from plugin feature modules; no Demo Plugin or application-specific behavior belongs in core.
- Plugin cleanup should unregister commands owned by that plugin through `CommandService.unregister()`.
- The sample Demo Plugin lives outside `src/core` and is not automatically registered or activated.

Do not add plugin-specific feature behavior into the core.

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
- Phase 1 remains free of application modules and business-specific logic; WorkspaceManager owns only item metadata and selection.
- Optional feature plugins remain outside `src/core`; the Demo Plugin is a sample definition, not a core service.
- Plugin lifecycle uses the shared registry and Runtime lifecycle; it does not create a parallel plugin registry.

## Must-Not-Break Rules

- Do not remove or silently change `CORE_SERVICE_IDS` without updating all consumers and tests.
- Do not bypass `ConfigurationService` with mutable shared config objects.
- Do not make storage consumers depend directly on `window.localStorage`.
- Do not register duplicate services into the registry.
- Do not render the workspace before the runtime has initialized.
- Do not turn `src/main.ts` into a second composition root.
- Do not bypass `PluginLoader` when activating registered plugins.

## Known Intentional Design Decisions

- The Cube + Terminal shell is the browser-facing Phase 2 interface. Keep it focused; do not add a desktop/window system or imply app views that are not implemented.
- The runtime registers existing services in-place instead of recreating them on restart.
- `initialize()` avoids duplicate service registration by checking the registry before registering.
- `LocalStorageAdapter` is only selected when configured and when `window` exists; otherwise bootstrap falls back to memory storage.
- Global browser error handlers are attached only at runtime initialization, not at module import time.
- Plugin definitions are registered explicitly through `BootstrapOptions.plugins`; the default core bootstrap loads none. The browser entrypoint opts into the sample Demo Plugin.
- WorkspaceManager hydration completes before Runtime initialization and plugin loading; the shell renders its metadata but does not treat it as an application renderer.
- Application activation is not implemented: no app alias-to-plugin/workspace/render contract exists. Until one is deliberately designed, missing apps such as Balances must remain unavailable.
