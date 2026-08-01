import { CubeError, normalizeError } from './cube-error';
import type { EventBus } from '../events/event-bus';
import type { LoggerContract } from '../logger/types';

type ErrorContext = {
  source?: string;
  details?: Record<string, unknown>;
};

/**
 * Centralized error capture and reporting for unexpected runtime failures.
 */
export class ErrorManager {
  private readonly detachCallbacks: Array<() => void> = [];

  constructor(
    private readonly logger: LoggerContract,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Captures any unknown error, logs it, and emits a system error event.
   */
  public capture(error: unknown, context?: ErrorContext): CubeError {
    const normalizedError = normalizeError(error, 'RUNTIME_ERROR', {
      source: context?.source,
      ...context?.details,
    });

    this.logger.error(normalizedError.message, {
      code: normalizedError.code,
      cause: normalizedError.cause,
      details: normalizedError.details,
    });

    this.eventBus?.emit('system:error', normalizedError, {
      source: context?.source ?? 'error-manager',
    });

    return normalizedError;
  }

  /**
   * Hooks browser-level error handlers when available.
   */
  public attachGlobalHandlers(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const handleError = (event: ErrorEvent): void => {
      this.capture(event.error ?? new Error(event.message), {
        source: 'window.error',
      });
      event.preventDefault();
    };

    const handleRejection = (event: PromiseRejectionEvent): void => {
      this.capture(event.reason, {
        source: 'window.unhandledrejection',
      });
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    this.detachCallbacks.push(() => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    });
  }

  /**
   * Removes any previously registered global handlers.
   */
  public detachGlobalHandlers(): void {
    while (this.detachCallbacks.length > 0) {
      const callback = this.detachCallbacks.pop();
      callback?.();
    }
  }
}
