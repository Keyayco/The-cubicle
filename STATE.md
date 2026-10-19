# STATE

## Current Project Phase

* Phase 1 core engine, Plugin Loader, Command System, optional Demo Plugin, and Workspace Manager complete

* Phase 2 flagship Cube + Terminal shell implemented on local branch `feat/cube-terminal-shell`; changes are not committed or pushed

## Current Implementation Status

* The repository implements a browser-based core runtime scaffold.

* The frontend entrypoint is `src/main.ts`.

* The composition root is `src/core/bootstrap/bootstrap.ts`.

* The browser entrypoint explicitly opts the sample Demo Plugin into bootstrap; `bootstrapApplication()` remains plugin-opt-in.

* The root shell now contains a CSS 3D runtime cube, a command terminal, and an honest workspace-metadata placeholder.

* The shell dispatches exact registered command IDs through `CommandService`; it does not parse arbitrary shell text or arguments.

* `command:started` now includes an operation ID that matches its corresponding command success/failure event.

* The current architecture has no app alias-to-plugin/workspace/renderer contract. No real application interface or Balances app is implemented.

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

* Cube + Terminal shell renderer in `src/ui`

* Runtime status-change event emission

* Live runtime-status syncing in the root workspace shell

* CSS cube state machine driven by command, plugin, and runtime events

* Session-only terminal with registry-backed help, keyboard command history, duplicate-submit prevention, bounded output, and safe text rendering

* Explicit browser-host opt-in for the Demo Plugin through `BootstrapOptions.plugins`

* Idempotent UI disposal for EventBus subscriptions and visibility listeners

* Public core barrel exports

* Plugin Loader using the central plugin registry, core services, plugin lifecycle events, and Runtime initialize/shutdown/restart lifecycle

* Command System using the central command registry, validated metadata, lookup, unregister, sync/async execution, events, and plugin integration

* Optional Demo Plugin outside core, demonstrating explicit registration, a greeting command, cleanup, and Runtime restart behavior

* Workspace Manager for persisted `system`/`plugin` item metadata, active-item selection, default-seed backfill, state events, and serialized mutations

* Vitest coverage for event bus, registry, storage, runtime lifecycle, bootstrap, Plugin Loader, Command System, Demo Plugin, Workspace Manager, Phase 1 hardening, and Cube + Terminal shell behavior

## Next Planned Work

* Re-run tests and production build in an environment where the pinned dependency tree can be installed.

* Keep application activation out of scope until its missing app-to-plugin/workspace/renderer contract is deliberately designed; do not fake Balances.

## Components Not Yet Implemented

* Window system

* Feature modules and apps

* Authentication

* Cloud sync

## Current Directory Structure

```text
src/
  main.ts
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

## Current Important Files

* `README.md`

* `package.json`

* `index.html`

* `src/main.ts`

* `src/core/index.ts`

* `src/core/bootstrap/bootstrap.ts`

* `src/core/runtime/runtime.ts`

* `src/ui/root-workspace.ts`

* `src/ui/cube-indicator.ts`

* `src/ui/terminal.ts`

* `tests/ui-shell.test.ts`

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

* CommandService, CommandDefinition, CommandExecutionOptions, and command start/success/failure event types

* Optional `demoPlugin` definition and its stable ID constants from `src/plugins/demo-plugin.ts` (outside the core barrel)

* Runtime and canonical service identifiers

* Storage contract, service, and adapters

* Workspace Manager, item/state types, and storage-key constant

## Current Tests

* `tests/core-engine.test.ts`

* `tests/ui-shell.test.ts`

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

  * Terminal dispatch, unknown command and failed command output, pending-input protection, history, event-driven activity, bounded logs, and help discovery

  * Cube command concurrency, compact success state, persistent runtime failure state, and listener cleanup

  * Workspace item hydration, seed backfill, persistence, registration, activation, removal, events, validation, state isolation, and concurrent writes

  * Runtime failure normalization, config override behavior, global error handlers, logger filtering, and local-storage namespacing

## Current Build Status

* Baseline at `main` / `7000b182760a914bbd7860c2e1ae2175fff0da0c` was documented as passing with the matching preinstalled dependency tree before these shell changes. That is not verification of the current branch.

* The current source contains 52 test cases across 7 files; the suite has not run for this change.

* `npm ci` was blocked by the package firewall: the pinned `tinypool@1.1.1` package was denied with HTTP 403 under the critical-CVE/security policy.

* `npm test`: unable to start because `vitest` is not installed (`command not found`).

* `npm run build`: unable to start because `tsc` is not installed (`command not found`).

* Clean-install verification is therefore unavailable in this environment. `git diff --check` is the remaining available source-level check.

## Current Known Limitations

* Plugin definitions are trusted host-provided code; the loader does not sandbox code or dynamically import arbitrary paths

* Plugin activation and cleanup are synchronous to match the current Runtime lifecycle contract

* The terminal dispatches exact registered command IDs; it has no shell parsing, argument parser, command palette, or shortcut layer

* The Demo Plugin is opt-in and provides only one greeting command; no default bootstrap behavior is changed

* Workspace items are metadata only; the shell displays a placeholder and does not render an application interface

* No application activation contract binds an application name/alias to a plugin, workspace item, and renderer; `balances` is unavailable

* Plugin-kind items can be registered, but Plugin Loader does not automatically add/remove workspace items during plugin lifecycle

* No persisted lifecycle recovery or app orchestration

* No windows, sessions, dock/sidebar, full app suite, or dynamic plugin loader

* A fresh checkout requires the dependency tree before tests/build; the firewall currently prevents installing pinned `tinypool@1.1.1`

## Current Integration Status

* Single frontend application

* No backend services identified

* No external APIs or network integrations identified

## Current TODOs

* Keep `README.md`, `RULES.md`, `STATE.md`, `HANDOVER.md`, and `LOGS.md` synchronized after future changes

* Investigate the reported `npm audit` high severity vulnerability when dependency maintenance is in scope

* Run the current full suite and production build once dependencies can be installed under the security policy

* Only design application activation if a real application is next; do not infer an app contract from workspace metadata

## Current Assumptions

* The repo remains a frontend/browser runtime built with TypeScript, Vite, and Vitest.

* `src/core/index.ts` remains the intended public barrel.

* The root workspace now provides the Cube + Terminal shell and displays active workspace metadata as a non-rendering placeholder.

## Current Blockers

* Test/build verification is blocked by the package firewall refusing the pinned `tinypool@1.1.1` dependency.

* No additional implementation blocker for the Cube + Terminal shell was found; application activation remains deliberately unsupported until its contract is designed.

* Future scope should remain aligned with `RULES.md`

## Most Recently Changed

* Runtime lifecycle state changes are emitted as a generic event and mirrored by the cube status indicator

* Runtime and bootstrap coverage now includes initialize/shutdown/restart lifecycle behavior

* Existing hardening tests were previously named `core-hardening-file.ts`, so Vitest ignored them; they are now named `core-hardening.test.ts` and execute as part of the normal test command

* Inspection found Plugin Loader absent from `main`, all visible branches, and all four pull requests despite the requested phase sequence; it was restored using the existing plugin registry and Runtime/EventBus contracts

* Command System uses historical command metadata (`id`, `title`, `keywords`) found on the Workspace/UI branch, but adds no Workspace/UI code; dispatch and registration live in the core service and shared Registry

* Demo Plugin is an opt-in module outside `src/core`; it demonstrates command registration and plugin cleanup without changing default bootstrap

* Workspace Manager hydrates and persists item metadata through `StorageService`, exposes itself through the existing Runtime `services` category, and emits state changes through the shared `EventBus`; it adds no parallel registry or UI

* The shell adds `command:started` with an operation ID and uses the existing command/plugin/runtime contracts; command failures and runtime health remain distinct.

* The browser host explicitly registers the demo greeting plugin. `balances` remains unavailable because the repository has no application activation/renderer contract.

## What Should Be Worked On Next

* Complete test/build verification when an approved dependency source is available; then review the final branch against the unchanged remote main before publication.

