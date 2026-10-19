# LOGS

## 2026-09-03 - AI Handover Initialization

### Issue

The repository did not contain persistent AI-to-AI handover infrastructure. Only `README.md` existed at the root, which described scope but not enough operational context for a new coding agent to resume work with minimal context loss.

### Finding

The codebase is a focused Phase 1 frontend core engine:

- TypeScript + Vite + Vitest
- Browser entry at `src/main.ts`
- Core bootstrap at `src/core/bootstrap/bootstrap.ts`
- Core services under `src/core`
- Tests under `tests`
- No backend or multi-service architecture detected

The existing implementation already encoded useful invariants that were not yet captured in dedicated repository infrastructure:

- Bootstrap is the composition root
- Runtime status is explicit
- Core service IDs are canonical
- Storage is adapter-based
- Plugin and command registry categories exist but the systems themselves do not

### Resolution

Created the following root-level handover files:

- `RULES.md`
- `STATE.md`
- `HANDOVER.md`
- `LOGS.md`

### Impact

Future AI agents now have persistent repo-local context for:

- permanent architecture rules
- current implementation state
- operational handoff instructions
- engineering discoveries and lessons

### Notes

- Verification details were added in a follow-up entry on the same date

## 2026-09-03 - Verification Pass

### Issue

Initial verification failed before dependencies were installed in the sandbox.

### Finding

- `npm test` initially failed with `vitest: not found`
- `npm run build` initially failed because Vite and Vitest type declarations were unavailable before install
- The repository already contained a valid `package-lock.json` and `src/vite-env.d.ts`
- After running `npm ci`, both verification commands passed

### Resolution

- Ran `npm ci`
- Re-ran `npm test`
- Re-ran `npm run build`

### Impact

- The codebase is currently buildable and testable
- Fresh environments should install dependencies before verification

### Notes

- `npm ci` reported 1 high severity vulnerability in the dependency tree
- Vulnerability investigation was out of scope for this pass

## 2026-09-05 - Runtime Lifecycle Hardening

### Issue

The runtime exposed restart and shutdown APIs, but the minimal root workspace only reflected the status captured at initial render. The repo also lacked explicit lifecycle-transition coverage for initialize, shutdown, and restart behavior.

### Finding

- `Runtime` tracked status internally but did not emit a generic event for each status transition
- `src/core/bootstrap/root-workspace.ts` rendered the runtime status once and did not react to later lifecycle changes
- Existing tests covered bootstrap success but not runtime transition sequencing or live DOM status updates

### Resolution

- Added a `runtime:status-changed` event emitted on every runtime status transition
- Centralized runtime status transitions in `Runtime` to keep event emission consistent
- Updated the root workspace shell to subscribe to lifecycle changes and keep its displayed status synchronized
- Expanded tests to cover initialize/shutdown/restart transitions and live status updates in the rendered workspace
- Re-ran `npm test` and `npm run build` after the change

### Impact

- Runtime lifecycle changes are now observable through a stable generic event in addition to existing specific lifecycle events
- The minimal Phase 1 UI remains intentionally small, but now mirrors runtime lifecycle state accurately
- Phase 1 verification has better protection against regressions in lifecycle behavior

### Notes

- `npm ci` still reports 1 high severity vulnerability in the dependency tree
- Failure-path and config override edge-case coverage remain good candidates for the next hardening pass

## 2026-09-28 - Activated Phase 1 Hardening Coverage

### Issue

The repository contained `tests/core-hardening-file.ts` with runtime failure, configuration override, global error handler, logger filtering, and local-storage tests, but Vitest only discovers files matching its `*.test.*` or `*.spec.*` patterns.

### Finding

- The normal `npm test` command reported 7 tests in `tests/core-engine.test.ts`
- The hardening file was not discovered and could not be run through Vitest's normal test selection
- The existing hardening tests passed once the filename matched the configured discovery pattern

### Resolution

- Renamed `tests/core-hardening-file.ts` to `tests/core-hardening.test.ts`
- Updated `STATE.md` and `HANDOVER.md` to reflect the active coverage
- Re-ran the full test suite and production build

### Verification

- `npm test`: 17 tests passing across 2 test files
- `npm run build`: passing
- `npm ci`: completed; npm reported 3 vulnerabilities (2 moderate, 1 high)

### Impact

Phase 1 now has automated coverage for runtime failure normalization, configuration override merging and immutability, browser error handler attachment/detachment, logger filtering, and local-storage namespacing. No production source behavior required changes.

## 2026-10-09 - Restored Plugin Loader on Main

### Issue

The requested architecture sequence identified Plugin Loader as complete, but inspection of `main`, all five visible branch heads, and all four pull requests found no Plugin Loader source or tests. `RULES.md`, `STATE.md`, `HANDOVER.md`, and `README.md` also explicitly described it as unimplemented.

### Resolution

- Added `PluginLoader` using the existing `Registry` `plugins` category as the single source of truth
- Added trusted host-provided `PluginDefinition` activation and optional synchronous cleanup through a stable `PluginContext`
- Registered the loader as a core runtime service
- Load registered plugins during `Runtime.initialize()`, unload in reverse registration order on shutdown, and reload on restart
- Emit `plugin:loaded`, `plugin:unloaded`, and `plugin:failed`; normalize activation and cleanup errors through `ErrorManager`
- Added focused lifecycle, lookup, duplicate, invalid-definition, reentrancy, and error tests
- Updated `README.md`, `RULES.md`, `STATE.md`, and `HANDOVER.md`

### Verification

- Baseline at `d34ef9d`: 17 tests passing; production build passing
- Plugin Loader: 26 tests passing across 3 files; production build passing
- `npm ci` was attempted but the package firewall blocked the pinned `tinypool@1.1.1`; verification used the matching preinstalled dependency tree

### Limitations

- Plugins are trusted host-provided definitions; no sandbox or dynamic import path support
- Activation and cleanup are synchronous to preserve the current Runtime lifecycle contract
- No Demo Plugin, Command System, or Workspace Manager was added in this prerequisite commit

### Next

Implement the Command System using the existing `commands` registry category and Plugin Loader integration. Keep Demo Plugin and Workspace Manager out of scope.

## 2026-10-09 - Implemented Core Command System

### Scope and Design

- Inspected the `main` branch: it had no command definition or dispatcher; its existing `commands` Registry category was reserved.
- Inspected the historical Workspace/UI branch: its `WorkspaceCommand` contract used `id`, `title`, `keywords`, and `execute`; reused that metadata shape without importing its Workspace Manager or command-palette UI.
- Added `CommandService` as the single registration, lookup, execution, and unregister API over the existing Registry `commands` category. No parallel command map was added.
- Registered it as a stable Runtime core service and exposed it to plugins through `PluginContext.commands`.
- Added `command:executed` and `command:failed` events; unknown IDs return `COMMAND_NOT_FOUND`, and handler failures are normalized through `ErrorManager`.
- Plugin cleanup unregisters commands owned by that plugin. Runtime shutdown/restart behavior is covered by the existing Plugin Loader integration.

### Files Changed

- Added `src/core/commands/command-service.ts` and `tests/command-service.test.ts`
- Updated core bootstrap, exports, Runtime service identifiers/wiring, and PluginContext
- Updated `tests/core-engine.test.ts`, `tests/core-hardening.test.ts`, and `tests/plugin-loader.test.ts` for the new required service/context
- Updated `README.md`, `RULES.md`, `STATE.md`, and `HANDOVER.md`

### Verification

- `npm test`: 34 passing across 4 files
- `npm run build`: passing (TypeScript check and Vite production build)
- `git diff --check`: passing
- Verification used the matching preinstalled dependency tree; a clean install remains blocked by the package firewall rejecting pinned `tinypool@1.1.1`

### Limitations

- No command palette, keyboard shortcut handling, or built-in commands were added.
- Commands are trusted in-process handlers; plugins must remove their registered commands in their synchronous cleanup callback.

### Next

Implement the Demo Plugin using PluginLoader and CommandService. Do not begin Workspace Manager yet.

## 2026-10-12 - Added Optional Demo Plugin

### Scope and Design

- Checked the current `main`, visible branches, and pull requests; no Demo Plugin implementation was present.
- Added `demoPlugin` in `src/plugins/demo-plugin.ts`, outside `src/core`.
- The host must explicitly register and load the plugin; default bootstrap remains unchanged and starts with no plugins or commands.
- The plugin registers one `demo.greeter.sayHello` command, returns a greeting, and unregisters the command during cleanup.
- No UI, palette, shortcuts, workspace behavior, or other application features were added.

### Files Changed

- Added `src/plugins/demo-plugin.ts` and `tests/demo-plugin.test.ts`
- Updated `README.md`, `RULES.md`, `STATE.md`, and `HANDOVER.md`

### Verification

- Baseline before changes: 34 tests passing; production build passing
- After changes: `npm test` passed (35 tests across 5 files)
- `npm run build`: passing (TypeScript check and Vite production build)
- `git diff --check`: passing
- Verification used the matching preinstalled dependency tree; a clean install remains blocked by the package firewall rejecting pinned `tinypool@1.1.1`

### Limitations

- The Demo Plugin is opt-in and not loaded by default.
- Its only command is a sample greeting; there is no UI to discover or invoke it.

### Next

Workspace Manager is next in the planned sequence. Keep its scope aligned with `RULES.md`.

## 2026-10-18 - Implemented Persisted Workspace Manager

### Scope and Design

- Inspected the current architecture and historical workspace-item precedent; the requested model was persisted workspace items, not named workspace sessions.
- Added `WorkspaceManager` for `system`/`plugin` item metadata, active-item selection, storage hydration, seed backfill, validation, serialized persistence, and state events.
- Reused `StorageService`, `EventBus`, and the existing Registry `services` category with `CORE_SERVICE_IDS.workspaceManager`; no parallel registry was introduced.
- Bootstrap now awaits workspace hydration before Runtime initialization. `src/main.ts` awaits the asynchronous bootstrap.
- Default seed items are `overview`, `runtime`, and `storage`; existing saved items and a valid active selection are retained.
- No windows, sessions, layout, UI, tabs, dock, sidebar, command palette, Demo Plugin changes, or automatic plugin lifecycle wiring were added.

### Files Changed

- Added `src/core/workspace/workspace-manager.ts` and `tests/workspace-manager.test.ts`
- Updated `src/core/bootstrap/bootstrap.ts`, `src/core/index.ts`, `src/core/runtime/runtime.ts`, and `src/core/runtime/service-identifiers.ts`
- Updated `src/main.ts`, `tests/core-engine.test.ts`, `tests/core-hardening.test.ts`, and `tests/demo-plugin.test.ts` for async bootstrap and Runtime service wiring
- Updated `README.md`, `RULES.md`, `STATE.md`, `HANDOVER.md`, and this log

### Verification

- Baseline before implementation: 35 tests across 5 files; production build passed
- After implementation: `npm test` passed (41 tests across 6 files)
- `npm run build`: passed (TypeScript check and Vite production build)
- `git diff --check`: passed
- Verification used the matching preinstalled dependency tree; clean installation remains blocked in this environment by the package firewall rejecting pinned `tinypool@1.1.1`

### Limitations

- The manager stores metadata only; the root shell does not render workspace items.
- Plugin-kind items are supported, but Plugin Loader does not automatically register or remove workspace items.
- Invalid persisted state fails initialization with `WORKSPACE_STATE_INVALID`; automatic recovery and schema migration are not implemented.
- No subsystem after Workspace Manager is specified in the current project sequence.

### Next

Confirm the next project objective before implementing another subsystem.

## 2026-10-19 - Implemented Flagship Cube + Terminal Shell

### Inspection and Architecture Findings

- Verified the initial checkout was on `main` at `7000b182760a914bbd7860c2e1ae2175fff0da0c`, with a clean working tree and `origin/main` at the same commit; changes were made on a new local branch, `feat/cube-terminal-shell`.
- Read `RULES.md`, `README.md`, `STATE.md`, `HANDOVER.md`, `LOGS.md`, the core/runtime/command/plugin/workspace/event/storage implementation, Demo Plugin tests, CSS, and build/test configuration before implementation.
- Plugin activation, command registration, and workspace metadata existed, but there was no application definition binding an application name to a plugin, workspace item, and renderer.
- Balances was not registered. The shell reports it unavailable rather than simulating activation.

### Implementation

- Added `src/ui/cube-indicator.ts`, `src/ui/terminal.ts`, and `src/ui/root-workspace.ts`; moved presentation out of `src/core/bootstrap`.
- The cube uses real runtime, command, and plugin events. It tracks operation IDs for concurrency, distinguishes runtime health from command outcomes, compacts after success, remains red after failure, pauses while hidden, and respects reduced motion.
- Added `command:started` and operation IDs to the existing CommandService outcome events; no second command registry was added.
- Terminal dispatches exact registered command IDs through `CommandService`, provides registry-backed `help`, history navigation, pending-state protection, timestamped diagnostics, text-only output, a 200-line/4,000-character line limit, and hidden-tab event queuing.
- The browser entrypoint explicitly opts into the existing demo greeting plugin. Workspace metadata appears only as a labeled placeholder.
- Added focused command/core/demo/UI tests and updated the root documentation.

### Files Changed

- Updated `README.md`, `RULES.md`, `STATE.md`, `HANDOVER.md`, and this log.
- Updated `src/core/bootstrap/bootstrap.ts`, `src/core/commands/command-service.ts`, `src/core/index.ts`, `src/main.ts`, and `src/styles.css`.
- Removed `src/core/bootstrap/root-workspace.ts`.
- Added `src/ui/cube-indicator.ts`, `src/ui/root-workspace.ts`, `src/ui/terminal.ts`, and `tests/ui-shell.test.ts`.
- Updated `tests/command-service.test.ts`, `tests/core-engine.test.ts`, and `tests/demo-plugin.test.ts`.

### Verification

- `npm ci` was attempted but blocked with HTTP 403 for pinned `tinypool@1.1.1` under the package critical-CVE/security policy.
- `npm test` could not start because `vitest` is unavailable; `npm run build` could not start because `tsc` is unavailable.
- Current source contains 52 test cases across 7 files; tests and production build remain unverified for this change.
- `git diff --check` passes; no commit or push has been made.

### Limitations

- Real application activation and rendering remain unsupported. `balances` is not a command or application.
- Clean-install tests/build remain blocked until the pinned dependency is available under the package security policy.

### Next

Run the full test suite and production build in an environment that can install the pinned dependencies under the security policy, then re-check remote `main` before publishing.
