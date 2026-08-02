# Cube OS - Phase 1 Core Engine

Cube Phase 1 establishes the production-grade foundation for a plugin-first, browser-based operating system. This repository intentionally implements only the core engine and avoids application modules, dashboards, and business-specific features.

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

Phase 1 explicitly excludes:

- Workspace manager
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
```

### Design Notes

- Plugin-first: the runtime exposes stable services that future plugins can consume.
- Event-driven: the `EventBus` provides decoupled communication where direct module coupling is not appropriate.
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
