# Cube OS Core Engine

Cube establishes the production-grade foundation for a plugin-first, browser-based operating system. This repository now implements the core engine plus an initial persisted workspace manager, while still avoiding application modules, dashboards, and business-specific features.

## Scope

Current scope includes:

- Application bootstrap
- Runtime lifecycle management
- Event bus
- Central registry
- Logger
- Storage abstraction
- Configuration service
- Centralized error handling
- Workspace manager with persisted state and active-item selection

The repository still explicitly excludes:

- Window system
- Plugin loader
- Feature modules and apps
- Authentication
- Cloud sync

## Architecture

```text
src/
  core/
    bootstrap/
    config/
    errors/
    events/
    logger/
    registry/
    runtime/
    storage/
    workspace/
```

### Design Notes

- Plugin-first: the runtime exposes stable services that future plugins can consume.
- Event-driven: the `EventBus` provides decoupled communication where direct module coupling is not appropriate.
- Workspace state is persisted through `StorageService` and observed through workspace events.
- Separated concerns: each subsystem owns one responsibility and is wired together only at bootstrap time.
- No circular dependencies: services depend on contracts and orchestration happens through the runtime.
- Storage abstraction: callers depend on `StorageService`, not on `localStorage` or a specific persistence engine.

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
