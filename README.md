# Cube OS - Core Engine, Plugin Loader, Command System, and Demo Plugin

This repository contains the Phase 1 browser core engine, Plugin Loader, Command System, and an optional sample Demo Plugin. The core remains infrastructure-first and does not include a workspace manager, dashboards, or business-specific features.

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

The current implementation does not include:

- Workspace manager
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
```

### Design Notes

- Plugin-first: the runtime exposes stable services that future plugins can consume.
- Event-driven: the `EventBus` provides decoupled communication where direct module coupling is not appropriate.
- Separated concerns: each subsystem owns one responsibility and is wired together only at bootstrap time.
- No circular dependencies: services depend on contracts and orchestration happens through the runtime.
- Storage abstraction: callers depend on `StorageService`, not on `localStorage` or a specific persistence engine.
- Plugin lifecycle: plugins use the shared core services and central registry; Runtime loads registered plugins on initialization and unloads them on shutdown.
- Commands: command definitions use the central `commands` registry category and are dispatched by `CommandService`; plugins can register and remove commands through their plugin context.

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
