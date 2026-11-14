import type {
  CommandExecutedEvent,
  CommandFailedEvent,
  CommandService,
  CommandStartedEvent,
  PluginFailureEvent,
  WorkspaceActiveItemChange,
} from '../core';
import type { EventBus, SystemEvent } from '../core';

export const TERMINAL_LOG_LIMIT = 200;
const MAX_LINE_LENGTH = 4_000;
const SENSITIVE_KEY =
  /(password|secret|credential|authorization|access.?token|refresh.?token|api.?key|private.?key|csv|statement|transaction|amount|merchant|payee|account|balance)/i;
const SECRET_TEXT_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g,
  /\b(password|secret|credential|access[_ -]?token|api[_ -]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
];

type TerminalLineKind = 'input' | 'output' | 'error' | 'system';
interface SanitizerState {
  seen: WeakSet<object>;
  remainingNodes: number;
}
interface TerminalLineRecord {
  kind: TerminalLineKind;
  text: string;
  timestampMs: number;
}

const redactText = (value: string): string => {
  let redacted = value;
  for (const pattern of SECRET_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      const separator = match.search(/[:=]/);
      return separator === -1
        ? '[redacted credential]'
        : `${match.slice(0, separator + 1)} [redacted]`;
    });
  }

  return redacted;
};

const truncateText = (value: string): string =>
  value.length > MAX_LINE_LENGTH
    ? `${value.slice(0, MAX_LINE_LENGTH)}\n[output truncated]`
    : value;

const looksLikeDelimitedData = (value: string): boolean => {
  const lines = value.trim().split(/\r?\n/).slice(0, 5);
  if (lines.length < 2) {
    return false;
  }

  const counts = lines.map((line) => {
    const commaCount = line.split(',').length - 1;
    const tabCount = line.split('\t').length - 1;
    return Math.max(commaCount, tabCount);
  });

  return counts[0]! >= 2 && counts.every((count) => count === counts[0]);
};

const sanitizeValue = (
  value: unknown,
  key = '',
  state: SanitizerState = {
    seen: new WeakSet<object>(),
    remainingNodes: 500,
  },
  depth = 0,
): unknown => {
  if (state.remainingNodes <= 0 || depth > 5) {
    return '[output truncated]';
  }
  state.remainingNodes -= 1;

  if (SENSITIVE_KEY.test(key)) {
    return '[redacted]';
  }

  if (typeof value === 'string') {
    if (looksLikeDelimitedData(value)) {
      return '[tabular data omitted from terminal output]';
    }
    return truncateText(redactText(value));
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (state.seen.has(value)) {
    return '[Circular]';
  }
  state.seen.add(value);

  if (value instanceof Error) {
    const error = value as Error & {
      code?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    return {
      name: error.name,
      message: redactText(error.message),
      ...(error.code !== undefined ? { code: error.code } : {}),
      ...(error.details !== undefined
        ? { details: sanitizeValue(error.details, 'details', state, depth + 1) }
        : {}),
      ...(error.cause !== undefined
        ? { cause: sanitizeValue(error.cause, 'cause', state, depth + 1) }
        : {}),
    };
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeValue(item, '', state, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value).slice(0, 50).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey, state, depth + 1),
    ]),
  );
};

const formatValue = (value: unknown): string => {
  if (value === undefined) {
    return 'Completed.';
  }

  if (typeof value === 'string') {
    return truncateText(
      redactText(
        looksLikeDelimitedData(value)
          ? '[tabular data omitted from terminal output]'
          : value,
      ),
    );
  }

  try {
    return JSON.stringify(sanitizeValue(value), null, 2) ?? String(value);
  } catch {
    return 'Output could not be displayed.';
  }
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    const normalized = error as Error & {
      code?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    const safe = sanitizeValue({
      name: normalized.name,
      message: normalized.message,
      ...(normalized.code !== undefined ? { code: normalized.code } : {}),
      ...(normalized.details !== undefined
        ? { details: normalized.details }
        : {}),
      ...(normalized.cause !== undefined ? { cause: normalized.cause } : {}),
    }) as Record<string, unknown>;
    const lines = [
      `${String(safe.name ?? 'Error')}: ${String(safe.message ?? 'An error occurred.')}`,
      safe.code !== undefined ? `Code: ${String(safe.code)}` : undefined,
      safe.details !== undefined
        ? `Details:\n${JSON.stringify(safe.details, null, 2)}`
        : undefined,
      safe.cause !== undefined
        ? `Cause:\n${JSON.stringify(safe.cause, null, 2)}`
        : undefined,
    ];
    return lines.filter((line): line is string => line !== undefined).join('\n');
  }

  return `Error: ${truncateText(redactText(String(error)))}`;
};

export interface TerminalViewOptions {
  container: HTMLElement;
  commandService: CommandService;
  eventBus: EventBus;
}

/**
 * A bounded, session-only terminal surface for registered command IDs.
 * The terminal deliberately does not parse arguments or execute shell text.
 */
export class TerminalView {
  private readonly element: HTMLElement;
  private readonly output: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly history: string[] = [];
  private readonly lines: HTMLElement[] = [];
  private readonly pendingLines: TerminalLineRecord[] = [];
  private readonly unsubscribeCallbacks: Array<() => void> = [];
  private historyIndex = 0;
  private pendingSubmissions = 0;
  private disposed = false;

  constructor(private readonly options: TerminalViewOptions) {
    this.element = document.createElement('section');
    this.element.className = 'terminal';
    this.element.setAttribute('aria-labelledby', 'terminal-title');

    const heading = document.createElement('div');
    heading.className = 'terminal-heading';
    const title = document.createElement('h2');
    title.id = 'terminal-title';
    title.textContent = 'Terminal';
    const hint = document.createElement('p');
    hint.textContent = 'Enter a registered command ID. Type help to discover commands.';
    heading.append(title, hint);

    this.output = document.createElement('div');
    this.output.className = 'terminal-output';
    this.output.setAttribute('role', 'log');
    this.output.setAttribute('aria-live', 'polite');
    this.output.setAttribute('aria-relevant', 'additions text');
    this.output.setAttribute('aria-label', 'Terminal output');

    const form = document.createElement('form');
    form.className = 'terminal-form';
    const prompt = document.createElement('label');
    prompt.className = 'terminal-prompt';
    prompt.htmlFor = 'terminal-command';
    prompt.textContent = '›';
    this.input = document.createElement('input');
    this.input.className = 'terminal-input';
    this.input.id = 'terminal-command';
    this.input.name = 'command';
    this.input.type = 'text';
    this.input.maxLength = 500;
    this.input.autocomplete = 'off';
    this.input.autocapitalize = 'off';
    this.input.spellcheck = false;
    this.input.setAttribute('aria-label', 'Command ID');
    this.input.setAttribute('aria-describedby', 'terminal-input-help');
    this.input.placeholder = 'help';
    this.submitButton = document.createElement('button');
    this.submitButton.type = 'submit';
    this.submitButton.className = 'terminal-submit';
    this.submitButton.textContent = 'Run';
    form.append(prompt, this.input, this.submitButton);

    const inputHelp = document.createElement('p');
    inputHelp.id = 'terminal-input-help';
    inputHelp.className = 'terminal-input-help';
    inputHelp.textContent = 'Use ↑ and ↓ for command history. Shell text and arguments are not executed.';

    this.element.append(heading, this.output, form, inputHelp);
    this.options.container.append(this.element);

    this.appendLine(
      'system',
      'The Cubicle terminal is ready. Type help to list installed command IDs.',
    );

    form.addEventListener('submit', this.handleSubmit);
    this.input.addEventListener('keydown', this.handleHistoryKey);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.unsubscribeCallbacks.push(
      this.options.eventBus.on<CommandStartedEvent>(
        'command:started',
        this.handleCommandStarted,
      ),
      this.options.eventBus.on<CommandExecutedEvent>(
        'command:executed',
        this.handleCommandExecuted,
      ),
      this.options.eventBus.on<CommandFailedEvent>(
        'command:failed',
        this.handleCommandFailed,
      ),
      this.options.eventBus.on<PluginFailureEvent>(
        'plugin:failed',
        this.handlePluginFailed,
      ),
      this.options.eventBus.on<{ pluginId: string }>(
        'plugin:loaded',
        this.handlePluginLoaded,
      ),
      this.options.eventBus.on<{ pluginId: string }>(
        'plugin:unloaded',
        this.handlePluginUnloaded,
      ),
      this.options.eventBus.on<{ currentStatus: string; previousStatus: string }>(
        'runtime:status-changed',
        this.handleRuntimeStatusChanged,
      ),
      this.options.eventBus.on<unknown>(
        'runtime:failed',
        this.handleRuntimeFailed,
      ),
      this.options.eventBus.on<WorkspaceActiveItemChange>(
        'workspace:active-item-changed',
        this.handleActiveWorkspaceChanged,
      ),
    );
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.element.querySelector('form')?.removeEventListener('submit', this.handleSubmit);
    this.input.removeEventListener('keydown', this.handleHistoryKey);
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    for (const unsubscribe of this.unsubscribeCallbacks.splice(0)) {
      unsubscribe();
    }
    this.pendingLines.length = 0;
    this.lines.length = 0;
    this.history.length = 0;
    this.element.remove();
  }

  private readonly handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (this.pendingSubmissions > 0) {
      return;
    }

    const commandId = this.input.value.trim();
    if (!commandId) {
      return;
    }

    this.input.value = '';
    this.addToHistory(commandId);
    this.appendLine('input', `› ${redactText(commandId)}`);

    if (commandId === 'help' && !this.options.commandService.get('help')) {
      const commands = this.options.commandService.list();
      this.appendLine(
        'output',
        commands.length > 0
          ? `Registered command IDs:\n${commands.map((id) => `  ${id}`).join('\n')}`
          : 'No commands are currently registered.',
      );
      return;
    }

    this.pendingSubmissions += 1;
    this.setPending(true);
    this.appendLine('system', `Running: ${commandId}`);
    let execution: Promise<unknown>;
    try {
      execution = this.options.commandService.execute<unknown, unknown>(
        commandId,
        undefined,
        { source: 'terminal' },
      );
    } catch (error) {
      this.pendingSubmissions -= 1;
      this.setPending(this.pendingSubmissions > 0);
      this.appendLine('error', formatError(error));
      return;
    }

    void execution
      .then((result) => this.appendLine('output', formatValue(result)))
      .catch((error: unknown) => this.appendLine('error', formatError(error)))
      .finally(() => {
        this.pendingSubmissions = Math.max(0, this.pendingSubmissions - 1);
        this.setPending(this.pendingSubmissions > 0);
      });
  };

  private readonly handleHistoryKey = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.history.length === 0) {
        return;
      }
      this.historyIndex = Math.max(0, this.historyIndex - 1);
      this.input.value = this.history[this.historyIndex] ?? '';
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
      this.input.value =
        this.historyIndex === this.history.length
          ? ''
          : (this.history[this.historyIndex] ?? '');
    }
  };

  private readonly handleCommandStarted = (
    event: SystemEvent<CommandStartedEvent>,
  ): void => {
    if (!event.payload || event.metadata?.source === 'terminal') {
      return;
    }
    this.appendLine(
      'system',
      `Started: ${event.payload.commandId}`,
      event.metadata?.timestamp,
    );
  };

  private readonly handleCommandExecuted = (
    event: SystemEvent<CommandExecutedEvent>,
  ): void => {
    if (!event.payload || event.metadata?.source === 'terminal') {
      return;
    }
    this.appendLine(
      'output',
      `${event.payload.commandId} completed: ${formatValue(event.payload.result)}`,
      event.metadata?.timestamp,
    );
  };

  private readonly handleCommandFailed = (
    event: SystemEvent<CommandFailedEvent>,
  ): void => {
    if (!event.payload || event.metadata?.source === 'terminal') {
      return;
    }
    this.appendLine(
      'error',
      `${event.payload.commandId} failed:\n${formatError(event.payload.error)}`,
      event.metadata?.timestamp,
    );
  };

  private readonly handlePluginFailed = (
    event: SystemEvent<PluginFailureEvent>,
  ): void => {
    if (!event.payload) {
      return;
    }
    this.appendLine(
      'error',
      `Plugin ${event.payload.pluginId} failed:\n${formatError(event.payload.error)}`,
      event.metadata?.timestamp,
    );
  };

  private readonly handlePluginLoaded = (
    event: SystemEvent<{ pluginId: string }>,
  ): void => {
    if (event.payload) {
      this.appendLine(
        'system',
        `Plugin loaded: ${event.payload.pluginId}`,
        event.metadata?.timestamp,
      );
    }
  };

  private readonly handlePluginUnloaded = (
    event: SystemEvent<{ pluginId: string }>,
  ): void => {
    if (event.payload) {
      this.appendLine(
        'system',
        `Plugin unloaded: ${event.payload.pluginId}`,
        event.metadata?.timestamp,
      );
    }
  };

  private readonly handleRuntimeStatusChanged = (
    event: SystemEvent<{ currentStatus: string; previousStatus: string }>,
  ): void => {
    if (event.payload) {
      this.appendLine(
        'system',
        `Runtime: ${event.payload.currentStatus}`,
        event.metadata?.timestamp,
      );
    }
  };

  private readonly handleRuntimeFailed = (
    event: SystemEvent<unknown>,
  ): void => {
    this.appendLine(
      'error',
      `Runtime failed:\n${formatError(event.payload)}`,
      event.metadata?.timestamp,
    );
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden || this.pendingLines.length === 0) {
      return;
    }

    for (const entry of this.pendingLines.splice(0)) {
      this.renderLine(entry);
    }
    this.trimLogs();
    this.output.scrollTop = this.output.scrollHeight;
  };

  private readonly handleActiveWorkspaceChanged = (
    event: SystemEvent<WorkspaceActiveItemChange>,
  ): void => {
    if (event.payload) {
      this.appendLine(
        'system',
        `Workspace metadata selected: ${event.payload.currentItemId ?? 'none'}`,
        event.metadata?.timestamp,
      );
    }
  };

  private addToHistory(commandId: string): void {
    if (this.history[this.history.length - 1] !== commandId) {
      this.history.push(commandId);
      if (this.history.length > TERMINAL_LOG_LIMIT) {
        this.history.shift();
      }
    }
    this.historyIndex = this.history.length;
  }

  private setPending(pending: boolean): void {
    this.input.disabled = pending;
    this.submitButton.disabled = pending;
    this.element.dataset.pending = String(pending);
    if (!pending) {
      this.input.removeAttribute('aria-busy');
    } else {
      this.input.setAttribute('aria-busy', 'true');
    }
  }

  private appendLine(
    kind: TerminalLineKind,
    text: string,
    timestampMs = Date.now(),
  ): void {
    if (this.disposed) {
      return;
    }
    const entry = {
      kind,
      text: truncateText(text),
      timestampMs,
    };
    if (document.hidden) {
      this.pendingLines.push(entry);
    } else {
      this.renderLine(entry);
      this.output.scrollTop = this.output.scrollHeight;
    }
    this.trimLogs();
  }

  private renderLine(entry: TerminalLineRecord): void {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.dataset.kind = entry.kind;
    const timestamp = new Date(entry.timestampMs);
    const time = document.createElement('time');
    time.dateTime = timestamp.toISOString();
    time.textContent = `${timestamp.toLocaleTimeString()} `;
    const content = document.createElement('span');
    content.textContent = entry.text;
    line.append(time, content);
    this.output.append(line);
    this.lines.push(line);
  }

  private trimLogs(): void {
    while (this.lines.length + this.pendingLines.length > TERMINAL_LOG_LIMIT) {
      if (this.lines.length > 0) {
        this.lines.shift()?.remove();
      } else {
        this.pendingLines.shift();
      }
    }
  }
}
