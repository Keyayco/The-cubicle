# HANDOVER

## Project Context

This repository is `cube-os-core-engine`, a TypeScript frontend application built with Vite and tested with Vitest. It currently implements the foundational browser runtime plus an initial persisted workspace manager, not the higher-level OS features such as plugin loading or windowing.

The current codebase is intentionally infrastructure-first. It proves that the runtime can be bootstrapped, core services can be registered, workspace state can be hydrated from storage, and a minimal workspace shell can be rendered.

## Current Position

- Core engine services are implemented under `src/core`
- The browser entrypoint is `src/main.ts`
- Bootstrap orchestration lives in `src/core/bootstrap/bootstrap.ts`
- Current tests cover event bus, registry, storage, workspace state, and bootstrap success
- Verification has been run in this environment with `npm ci`, `npm test`, and `npm run build`
- Runtime lifecycle transitions now emit a generic `runtime:status-changed` event
- The workspace manager hydrates persisted items, exposes active-item selection, and is registered as a core service
- The root workspace shell now updates its displayed runtime status and active workspace module
- Higher-level systems such as plugin loading and window management are not implemented yet
- The root handover documentation has been added and must be kept current

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
13. `src/core/storage/`
14. `src/core/workspace/`
15. `src/core/errors/`
16. `tests/`

## Current Objective

The immediate objective after this handover setup is to keep the new handover files synchronized with reality and then continue with the next explicit engineering task.

If no separate product task has been provided, the most reasonable next step is to either:

- harden the runtime with additional failure-path and config-override tests, or
- begin the next subsystem that should layer on top of the workspace manager

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
- `Runtime.initialize()` registers core services into the registry and attaches browser-level error handlers.
- `Runtime` now emits `runtime:status-changed` whenever its inspectable status moves between lifecycle states.
- The runtime already reserves registry categories for `plugins` and `commands`, but those systems do not exist yet.
- `StorageService` is the stable abstraction; the rest of the system should not depend directly on `window.localStorage`.
- `WorkspaceManager.initialize()` hydrates and persists workspace state through `StorageService`.
- Current UI rendering is intentionally minimal and exists only to validate that the core engine booted successfully, while now reflecting runtime status and active workspace state live.
- `src/core/index.ts` is the public export surface for reusable core APIs.

## Do Not Assume

- Do not assume plugin support exists because `RegistryCategory` includes `plugins`.
- Do not assume command execution exists because `RegistryCategory` includes `commands`.
- Do not assume runtime failure paths or config override edge cases have comprehensive test coverage.
- Do not assume the workspace manager is a full desktop/window manager; it currently tracks persisted modules and the active item only.
- Do not assume build and test status if you have not run them in the current state.
- Do not assume dependencies are already installed in a clean environment; run `npm ci` first.
- Do not assume a next phase has already been decided just because Phase 1 exclusions are listed in `README.md`.
- Do not assume any new public API is safe to expose without updating `src/core/index.ts`, tests, and documentation together.

## Next Steps

Unless a user gives a more specific task, the clearest next actions are:

1. Verify `npm test`
2. Verify `npm run build`
3. Expand coverage around runtime failure emission, global error handling, and config override behavior if hardening is chosen
4. Decide whether to layer a window system or plugin surfaces onto the workspace manager next
5. Record any noteworthy findings in `LOGS.md`

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
