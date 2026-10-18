# STATE

## Current Project Phase

* Phase 1 core engine, Plugin Loader, Command System, optional Demo Plugin, and Workspace Manager complete

## Current Implementation Status

* The repository implements a browser-based core runtime scaffold.

* The frontend entrypoint is `src/main.ts`.

* The composition root is `src/core/bootstrap/bootstrap.ts`.

* The project currently validates successful boot by rendering a minimal root workspace into `#app`.

* Bootstrap is asynchronous so the Workspace Manager hydrates persistent item state before Runtime initialization.

## Completed Components

* Application bootstrap

* Immutable configuration service

* Runtime lifecycle manager

* Event bus

* Structured logger

* Central registry with fixed categories

* Error normalization and centralized error manager

* Storage abstraction

* Local storage adapter

* Memory storage adapter

* Root workspace renderer

* Runtime status-change event emission

* Live runtime-status syncing in the root workspace shell

* Public core barrel exports

* Plugin Loader using the central plugin registry, core services, plugin lifecycle events, and Runtime initialize/shutdown/restart lifecycle

* Command System using the central command registry, validated metadata, lookup, unregister, sync/async execution, events, and plugin integration

* Optional Demo Plugin outside core, demonstrating explicit registration, a greeting command, cleanup, and Runtime restart behavior

* Workspace Manager for persisted `system`/`plugin` item metadata, active-item selection, default-seed backfill, state events, and serialized mutations

* Vitest coverage for event bus, registry, storage, runtime lifecycle, bootstrap, Plugin Loader, Command System, Demo Plugin, Workspace Manager, and Phase 1 hardening paths

## Next Planned Work

* No subsystem after Workspace Manager is defined in the current project plan; select the next scope explicitly before implementation

## Components Not Yet Implemented

* Window system

* Feature modules and apps

* Authentication

* Cloud sync

## Current Directory Structure

```text
src/
  main.ts
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
```

## Current Important Files

* `README.md`

* `package.json`

* `index.html`

* `src/main.ts`

* `src/core/index.ts`

* `src/core/bootstrap/bootstrap.ts`

* `src/core/runtime/runtime.ts`

* `src/core/bootstrap/root-workspace.ts`

* `src/core/workspace/workspace-manager.ts`

* `tests/core-engine.test.ts`

* `tests/core-hardening.test.ts`

* `tests/plugin-loader.test.ts`

* `tests/command-service.test.ts`

* `src/plugins/demo-plugin.ts`

* `tests/demo-plugin.test.ts`

* `tests/workspace-manager.test.ts`

## Current Public APIs

The public core exports currently come from `src/core/index.ts` and include:

* Bootstrap API

* Configuration service and config types

* Error types and manager

* Event bus types and implementation

* Logger types and implementation

* Registry

* Plugin Loader and plugin lifecycle types

* CommandService, CommandDefinition, and command execution event types

* Optional `demoPlugin` definition and its stable ID constants from `src/plugins/demo-plugin.ts` (outside the core barrel)

* Runtime and canonical service identifiers

* Storage contract, service, and adapters

* Workspace Manager, item/state types, and storage-key constant

## Current Tests

* `tests/core-engine.test.ts`

* `tests/workspace-manager.test.ts`

* Test environment: `jsdom`

* Coverage focus:

  * Event bus duplicate-listener protection and unsubscribe behavior

  * Registry registration and lookup behavior

  * Storage service CRUD behavior through the memory adapter

  * Runtime lifecycle transition events across initialize, shutdown, and restart

  * Plugin registration, lookup, activation, cleanup, failure reporting, duplicate handling, and reentrant lifecycle protection

  * Runtime shutdown cleanup and restart reactivation for registered plugins

  * Command registration, lookup, validation, duplicate rejection, unregister, sync/async execution, unknown IDs, and handler failures

  * Plugin registration and cleanup of plugin-owned commands through `PluginContext.commands`

  * Optional Demo Plugin explicit registration, greeting command behavior, cleanup, and Runtime restart

  * Bootstrap success path, root workspace render, and live status updates during lifecycle changes

  * Workspace item hydration, seed backfill, persistence, registration, activation, removal, events, validation, state isolation, and concurrent writes

  * Runtime failure normalization, config override behavior, global error handlers, logger filtering, and local-storage namespacing

## Current Build Status

* Verified on 2026-10-18 using the matching preinstalled dependency tree; a clean `npm ci` remains blocked by the package firewall for `tinypool@1.1.1`

* `npm test`: passing (41 tests across 6 files)

* `npm run build`: passing

## Current Known Limitations

* Plugin definitions are trusted host-provided code; the loader does not sandbox code or dynamically import arbitrary paths

* Plugin activation and cleanup are synchronous to match the current Runtime lifecycle contract

* The Command System has no palette UI, shortcut handling, or built-in commands

* The Demo Plugin is opt-in and provides only one greeting command; no default bootstrap behavior is changed

* Workspace items are metadata only; the shell does not render them, and no windows, sessions, layout, or Workspace UI are implemented

* Plugin-kind items can be registered, but Plugin Loader does not automatically add/remove workspace items during plugin lifecycle

* No persisted lifecycle recovery or app orchestration

* No advanced UI beyond the minimal root workspace shell

* A fresh checkout in this sandbox requires `npm ci` before running tests or build

* `npm ci` reports 3 vulnerabilities (2 moderate, 1 high) in the dependency tree that have not been investigated in this pass

## Current Integration Status

* Single frontend application

* No backend services identified

* No external APIs or network integrations identified

## Current TODOs

* Keep the four root handover files synchronized after future changes

* Investigate the reported `npm audit` high severity vulnerability when dependency maintenance is in scope

* Choose the next subsystem after Workspace Manager; the current sequence defines no further work

## Current Assumptions

* The repo remains a frontend/browser runtime built with TypeScript, Vite, and Vitest.

* `src/core/index.ts` remains the intended public barrel.

* The current root workspace remains a boot-validation shell; it reflects runtime lifecycle changes but does not render Workspace Manager items.

## Current Blockers

* No confirmed active implementation blocker inside the codebase

* Future scope should remain aligned with `RULES.md`

## Most Recently Changed

* Runtime lifecycle state changes are now emitted as a generic event and mirrored live in the root workspace shell

* Runtime and bootstrap coverage now includes initialize/shutdown/restart lifecycle behavior

* Existing hardening tests were previously named `core-hardening-file.ts`, so Vitest ignored them; they are now named `core-hardening.test.ts` and execute as part of the normal test command

* Inspection found Plugin Loader absent from `main`, all visible branches, and all four pull requests despite the requested phase sequence; it was restored using the existing plugin registry and Runtime/EventBus contracts

* Command System uses historical command metadata (`id`, `title`, `keywords`) found on the Workspace/UI branch, but adds no Workspace/UI code; dispatch and registration live in the core service and shared Registry

* Demo Plugin is an opt-in module outside `src/core`; it demonstrates command registration and plugin cleanup without changing default bootstrap

* Workspace Manager hydrates and persists item metadata through `StorageService`, exposes itself through the existing Runtime `services` category, and emits state changes through the shared `EventBus`; it adds no parallel registry or UI

## What Should Be Worked On Next

* No next subsystem is specified after Workspace Manager; agree on the next objective before further implementation

