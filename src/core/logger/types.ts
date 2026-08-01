/**
 * Supported log levels for the Cube core engine.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Structured log payload sent to the active logger sink.
 */
export interface LogEntry {
  level: Exclude<LogLevel, 'silent'>;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Logger contract exposed to the rest of the runtime.
 */
export interface LoggerContract {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
