import type { LogEntry, LogLevel, LoggerContract } from './types';

type LoggerSink = (entry: LogEntry) => void;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const DEFAULT_SINK: LoggerSink = (entry) => {
  const args: unknown[] = [`[Cube] ${entry.message}`];

  if (entry.context) {
    args.push(entry.context);
  }

  switch (entry.level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }
};

/**
 * Central logging service with runtime level filtering.
 */
export class Logger implements LoggerContract {
  private enabled: boolean;

  private level: LogLevel;

  private readonly sink: LoggerSink;

  constructor(options?: {
    enabled?: boolean;
    level?: LogLevel;
    sink?: LoggerSink;
  }) {
    this.enabled = options?.enabled ?? true;
    this.level = options?.level ?? 'info';
    this.sink = options?.sink ?? DEFAULT_SINK;
  }

  /**
   * Enables or disables logging completely.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Updates the minimum active log level.
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context);
  }

  private write(
    level: Exclude<LogLevel, 'silent'>,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (!this.enabled) {
      return;
    }

    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    this.sink({
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}
