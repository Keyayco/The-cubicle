/**
 * Consistent error type used across the Cube core engine.
 */
export class CubeError extends Error {
  public readonly code: string;

  public readonly details?: Record<string, unknown>;

  public constructor(
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
      details?: Record<string, unknown>;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'CubeError';
    this.code = options?.code ?? 'CUBE_ERROR';
    this.details = options?.details;
  }
}

/**
 * Converts unknown thrown values into a consistent CubeError instance.
 */
export const normalizeError = (
  error: unknown,
  code = 'UNEXPECTED_ERROR',
  details?: Record<string, unknown>,
): CubeError => {
  if (error instanceof CubeError) {
    return error;
  }

  if (error instanceof Error) {
    return new CubeError(error.message, {
      code,
      cause: error,
      details,
    });
  }

  return new CubeError('An unexpected non-error value was thrown.', {
    code,
    cause: error,
    details: {
      ...details,
      thrownValue: error,
    },
  });
};
