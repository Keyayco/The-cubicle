# HANDOVER

## Project Context

This repository is `cube-os-core-engine`, a TypeScript frontend application built with Vite and tested with Vitest. It implements the Phase 1 browser core engine, Plugin Loader, Command System, persisted Workspace Manager, and the first Cube + Terminal shell.

The shell is a focused interface over the existing runtime and command services. It does not implement a full desktop or application renderer.

## Current Position

- Core engine services are implemented under `src/core`
- The browser entrypoint is `src/main.ts`
- Bootstrap orchestration lives in `src/core/bootstrap/bootstrap.ts`
- Current source contains 52 tests across 7 test files, including the shell. The 52 tests have not run on the current branch.
- `npm ci` was blocked by the package firewall for pinned `tinypool@1.1.1` (HTTP 403, critical-CVE/security policy); `npm test` and `npm run build` cannot start without the missing `vitest` and `tsc` executables.
- Runtime lifecycle transitions now emit a generic `runtime:status-changed` event
- The cube indicator follows runtime state, plugin load/failure, and command start/outcome events; it tracks concurrent operations separately from runtime health.
- `CommandService` emits `command:started` with an operation ID matched to its executed/failed event.
- Workspace Manager persists item metadata and active selection. The shell displays that metadata as a placeholder; it is not an application renderer.
- The root handover documentation has been added and must be kept current
- Phase 1 hardening coverage is active in `tests/core-hardening.test.ts`
- The Plugin Loader is implemented in `src/core/plugins/plugin-loader.ts` and is part of the Runtime service lifecycle
- The Command System is implemented in `src/core/commands/command-service.ts`; the optional Demo Plugin is in `src/plugins/demo-plugin.ts`
- The browser host explicitly opts the sample Demo Plugin into bootstrap. `balances` is not registered.
- There is no application contract joining app names, plugin lifecycle, workspace items, and a view renderer; do not claim application activation is supported.

## Read First

Before changing code, inspect these files and directories in this order:

1. `RULES.md`
2. `STATE.md`
3. `HANDOVER.md`
4. `README.md`
5. `LOGS.md`
6. `package.json`
7. `src/main.ts`
8. `src/core/index.ts`
9. `src/core/bootstrap/`
10. `src/core/runtime/`
11. `src/core/config/`
12. `src/core/events/`
13. `src/core/registry/`
14. `src/core/plugins/`
15. `src/core/commands/`
16. `src/core/workspace/`
17. `src/plugins/`
18. `src/core/storage/`
19. `src/core/errors/`
20. `tests/`

## Current Objective

The requested Phase 2 shell is committed on `feat/cube-terminal-shell` in draft PR #5. It includes the CSS cube, real command dispatch, bounded terminal output, and a metadata-only workspace placeholder. Application activation remains unsupported because the repository has no app-to-plugin/workspace/renderer contract; do not fake a Balances launch or add speculative infrastructure.

## Recommended Investigation Order

1. Read `RULES.md` for permanent architecture and invariants
2. Read `STATE.md` for the current repository snapshot
3. Read `HANDOVER.md` for operational instructions
4. Read `README.md` for the repo’s intended scope
5. Inspect `package.json`, `vite.config.ts`, and `tsconfig.json`
6. Inspect `src/main.ts` and `src/core/index.ts`
7. Inspect `src/core/bootstrap/bootstrap.ts`
8. Inspect the relevant subsystem files for the task you plan to change
9. Inspect `tests/core-engine.test.ts`
10. Install dependencies with `npm ci`; if the package firewall blocks the pinned dependency, do not bypass the security policy or substitute unverified packages
11. Run `npm test`
12. Run `npm run build`
13. Compare observed behavior against `RULES.md` and `STATE.md`
14. Implement only the requested scope
15. Re-run targeted verification and full relevant checks
16. Update `STATE.md`, `HANDOVER.md`, and `LOGS.md`
17. Update `RULES.md` only if the architecture or invariants changed

## Important Context

- `src/main.ts` is intentionally thin and should stay that way.
- `bootstrapApplication()` is the composition root and is asynchronous; it hydrates Workspace Manager before initializing Runtime.
- `Runtime.initialize()` registers core services, attaches browser-level error handlers, and loads registered plugins.
- `Runtime` now emits `runtime:status-changed` whenever its inspectable status moves between lifecycle states.
- `PluginLoader` stores trusted definitions in the central `plugins` category and unloads them in reverse order on shutdown; restart loads them again.
- Plugin activation and cleanup are synchronous; arbitrary module imports and sandboxing are not implemented.
- `CommandService` stores definitions in the shared `commands` registry category and dispatches commands with `command:started`, `command:executed`, and `command:failed` events that share an operation ID.
- Plugin code gets the command service through `PluginContext.commands` and should unregister plugin-owned commands in its cleanup callback.
- The terminal accepts exact command IDs only, uses the same `CommandService`, and exposes registry-backed `help`; it does not parse shell arguments.
- The sample Demo Plugin is opt-in in the core API; `src/main.ts` explicitly passes it as a browser-host plugin.
- Workspace Manager stores metadata and active selection; the application workspace labels metadata as a placeholder because no renderer is registered.
- `StorageService` is the stable abstraction; the rest of the system should not depend directly on `window.localStorage`.
- Cube status is driven by actual runtime, command, and plugin events, not polling. Runtime health and command results are tracked separately.
- Terminal output is session-only, capped at 200 lines and 4,000 characters per line, uses text nodes, and attempts to redact sensitive-looking data.
- Terminal events retain the EventBus timestamp; locally generated lines use the current time.
- Terminal log additions are queued in memory, within the same retention limit, while the document is hidden.
- `src/ui` owns presentation; core services do not depend on presentation modules.
- `src/core/index.ts` is the public export surface for reusable core APIs.

## Do Not Assume

- Plugin loading uses trusted host-provided definitions; there is no dynamic import or sandboxing. The optional Demo Plugin is not auto-registered or loaded by default.
- The Command System is UI-agnostic; do not assume a palette or keyboard shortcut layer exists.
- Do not assume runtime failure paths or config override edge cases have comprehensive test coverage.
- Do not assume build and test status if you have not run them in the current state.
- Do not assume dependencies are already installed in a clean environment; run `npm ci` first.
- Application activation is not implemented. There is no app alias-to-plugin/workspace/renderer contract, and `balances` is not a registered command or application.
- Do not assume any new public API is safe to expose without updating `src/core/index.ts`, tests, and documentation together.

## Next Steps

For this branch, restore a verifiable dependency environment first; then:

1. Run `npm ci` only if the package security policy allows the pinned dependency.
2. Run the full test suite and production build; report them as unverified until they actually execute.
3. Inspect the final diff for unrelated changes and run `git diff --check`.
4. Before merging, re-check the PR base for divergence and run the tests/build once the dependency policy permits; no merge has been made.
5. Keep app activation unsupported until its real plugin/workspace/view contract is designed.
6. Keep `STATE.md`, `HANDOVER.md`, and `LOGS.md` synchronized with verified outcomes.

## Documentation Workflow

After any significant task:

1. Implement
2. Test
3. Verify
4. Update `STATE.md`
5. Update `HANDOVER.md`
6. Update `LOGS.md` if there were bugs, discoveries, regressions, or abandoned approaches
7. Update `RULES.md` if the architecture or invariants changed
8. Re-run final relevant checks

These files are part of the repository infrastructure, not optional notes. Keep them concise, factual, and synchronized.
