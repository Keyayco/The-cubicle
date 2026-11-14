# The Cubicle — Cube + Terminal Shell

The Cubicle is a browser-based operating environment scaffold built with
TypeScript, Vite, and the existing core runtime. The flagship shell now includes
a CSS 3D cube status indicator, a command terminal, and a small application
workspace area.

## Current experience

- The cube reflects real runtime status, command execution, and plugin outcomes.
  It starts neutral, shows active command work, turns green after success, and
  stays red after failures. After the first successful command or plugin load
  observed by the shell, it moves to a compact status indicator.
- The terminal dispatches exact registered command IDs through `CommandService`.
  `help` lists commands actually present in the shared registry. The terminal
  does not execute arbitrary shell text or parse command arguments.
- The browser host explicitly opts the sample `demo.greeter` plugin into
  `bootstrapApplication()`. Its registered command is
  `demo.greeter.sayHello`.
- Workspace metadata is displayed in a clearly marked placeholder. Workspace
  items are not application views.

## Architecture and boundaries

`src/core` remains the source of truth for runtime, commands, plugins, events,
storage, and workspace metadata. Presentation code lives under `src/ui` and
consumes those public contracts. The terminal uses the existing `CommandService`
and `EventBus`; no second command registry or plugin loader was added.

Plugin activation is supported, but the repository still has no application
definition that binds a terminal name to a plugin, workspace item, and renderer.
There is no Balances application or application renderer yet. Entering `balances`
therefore produces the real `COMMAND_NOT_FOUND` diagnostic instead of a fake
launch. The sample greeting plugin demonstrates command lifecycle only.

The current implementation does not include a window system, app suite,
authentication, cloud sync, dynamic plugin imports, plugin sandboxing, or
arbitrary shell execution.

## Source layout

```text
src/
  main.ts
  plugins/
    demo-plugin.ts
  ui/
    cube-indicator.ts
    root-workspace.ts
    terminal.ts
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

## Development

```bash
npm ci
npm run dev
npm test
npm run build
```

Terminal output is session-only, capped at 200 lines and 4,000 characters per
line. Events use the EventBus timestamp; locally generated lines use the current
time. Sensitive-looking fields and delimited tabular payloads are redacted
before display. The interface uses text nodes for output, defers terminal DOM
updates while hidden, pauses cube animation, and honors
`prefers-reduced-motion`.
