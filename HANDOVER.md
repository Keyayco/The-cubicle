# HANDOVER

## Project Context

This repository is `cube-os-core-engine`, a TypeScript frontend application built with Vite and tested with Vitest. It implements the Phase 1 browser core engine and the first post-Phase-1 subsystem, a minimal Plugin Loader; higher-level OS features remain separate.

The current codebase is intentionally infrastructure-first. It proves that the runtime can be bootstrapped, core services can be registered, and a minimal workspace shell can be rendered.

## Current Position

- Core engine services are implemented under `src/core`
- The browser entrypoint is `src/main.ts`
- Bootstrap orchestration lives in `src/core/bootstrap/bootstrap.ts`
- Current tests cover event bus, registry, storage, bootstrap success, Phase 1 hardening, Plugin Loader, and Command System paths
- The current test/build verification used the matching preinstalled dependency tree; `npm ci` is blocked by the package firewall for pinned `tinypool@1.1.1`
- Runtime lifecycle transitions now emit a generic `runtime:status-changed` event
- The root workspace shell now updates its displayed runtime status when lifecycle changes occur
- Workspace management and the window system are not implemented yet
- The root handover documentation has been added and must be kept current
- Phase 1 hardening coverage is active in `tests/core-hardening.test.ts`
- The Plugin Loader is implemented in `src/core/plugins/plugin-loader.ts` and is part of the Runtime service lifecycle
- The Command System is implemented in `src/core/commands/command-service.ts`; the next planned subsystem is Demo Plugin, not Workspace Manager

## Read First

Before changing code, inspect these files and directories in this order:

1. `RULES.md`
2. `STATE.md`
3. `HANDOVER.md`
4. `README.md`
5. `package.json`
6. `src/main.ts`
7. `src/core/index.ts`
8. `src/core/bootstrap/`
9. `src/core/runtime/`
10. `src/core/config/`
11. `src/core/events/`
12. `src/core/registry/`
13. `src/core/plugins/`
14. `src/core/commands/`
15. `src/core/storage/`
16. `src/core/errors/`
17. `tests/`

## Current Objective

The Command System is complete. The next planned subsystem is Demo Plugin; keep Workspace Manager out of that work.

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
10. Run `npm ci` in a fresh checkout or sandbox
11. Run `npm test`
12. Run `npm run build`
13. Compare observed behavior against `RULES.md` and `STATE.md`
14. Implement the change
15. Re-run targeted verification and full relevant checks
16. Update `STATE.md`, `HANDOVER.md`, and `LOGS.md`
17. Update `RULES.md` only if the architecture or invariants changed

## Important Context

- `src/main.ts` is intentionally thin and should stay that way.
- `bootstrapApplication()` is the composition root and is where service wiring belongs.
- `Runtime.initialize()` registers core services, attaches browser-level error handlers, and loads registered plugins.
- `Runtime` now emits `runtime:status-changed` whenever its inspectable status moves between lifecycle states.
- `PluginLoader` stores trusted definitions in the central `plugins` category and unloads them in reverse order on shutdown; restart loads them again.
- Plugin activation and cleanup are synchronous; arbitrary module imports and sandboxing are not implemented.
- `CommandService` stores definitions in the shared `commands` registry category and dispatches commands with `command:executed` / `command:failed` events.
- Plugin code gets the command service through `PluginContext.commands` and should unregister plugin-owned commands in its cleanup callback.
- No command palette, keyboard shortcuts, Demo Plugin, or Workspace Manager is implemented in this step.
- `StorageService` is the stable abstraction; the rest of the system should not depend directly on `window.localStorage`.
- Current UI rendering is intentionally minimal and exists only to validate that the core engine booted successfully, while now reflecting runtime status changes live.
- `src/core/index.ts` is the public export surface for reusable core APIs.

## Do Not Assume

- Plugin loading exists, but do not assume dynamic imports, sandboxing, or a bundled plugin exists.
- The Command System is UI-agnostic; do not assume a palette or keyboard shortcut layer exists.
- Do not assume runtime failure paths or config override edge cases have comprehensive test coverage.
- Do not assume build and test status if you have not run them in the current state.
- Do not assume dependencies are already installed in a clean environment; run `npm ci` first.
- The subsystem sequence is Core Engine → Plugin Loader → Command System → Demo Plugin → Workspace Manager; implement the Demo Plugin next and do not skip ahead to Workspace Manager.
- Do not assume any new public API is safe to expose without updating `src/core/index.ts`, tests, and documentation together.

## Next Steps

Unless a user gives a more specific task, the clearest next actions are:

1. Verify `npm test`
2. Verify `npm run build`
3. Implement the Demo Plugin using the Plugin Loader and Command Service
4. Keep Workspace Manager and UI layers out of the Demo Plugin work unless explicitly planned
5. Update `STATE.md`, `HANDOVER.md`, and `LOGS.md` after the next implementation

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
