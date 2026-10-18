# Cube OS - Core Engine, Plugin Loader, Command System, and Workspace Manager

This repository contains the Phase 1 browser core engine, Plugin Loader, Command System, a persisted Workspace Manager, and an optional sample Demo Plugin. The Workspace Manager owns item metadata and active-item state; it does not render workspace items or introduce windows, sessions, dashboards, or business-specific features.

## Scope

Phase 1 includes:

- Application bootstrap
- Runtime lifecycle management
- Event bus
- Central registry
- Logger
- Storage abstraction
- Configuration service
- Centralized error handling
- Persisted system/plugin workspace-item metadata and active-item selection

The current implementation does not include:

- Window system
- Feature modules and apps
- Authentication
- Cloud sync

The Plugin Loader activates trusted plugin definitions registered by the host. It does not dynamically import arbitrary module paths or sandbox plugin code.

The sample Demo Plugin is defined in `src/plugins/demo-plugin.ts`. It registers one greeting command through `PluginContext.commands`; the host must register and load it explicitly. The default bootstrap does not import or auto-load it.

## Architecture

```text
src/
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
```

### Design Notes

- Plugin-first: the runtime exposes stable services that future plugins can consume.
- Event-driven: the `EventBus` provides decoupled communication where direct module coupling is not appropriate.
- Separated concerns: each subsystem owns one responsibility and is wired together only at bootstrap time.
- No circular dependencies: services depend on contracts and orchestration happens through the runtime.
- Storage abstraction: callers depend on `StorageService`, not on `localStorage` or a specific persistence engine.
- Plugin lifecycle: plugins use the shared core services and central registry; Runtime loads registered plugins on initialization and unloads them on shutdown.
- Commands: command definitions use the central `commands` registry category and are dispatched by `CommandService`; plugins can register and remove commands through their plugin context.
- Workspace items: `WorkspaceManager` persists item metadata and active selection through `StorageService`, emits state events through `EventBus`, and is exposed as a Runtime service; it does not create a second registry or UI.

## Development

Install dependencies:

```bash
npm install
```

Start the browser runtime:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Create a production build:

```bash
npm run build
```
