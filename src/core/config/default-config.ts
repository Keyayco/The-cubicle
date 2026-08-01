import type { LogLevel } from '../logger/types';

/**
 * Known runtime modes supported by the Cube core engine.
 */
export type RuntimeMode = 'development' | 'production' | 'test';

/**
 * Shape of the public Cube runtime configuration.
 */
export interface CubeConfig {
  appName: string;
  environment: {
    mode: RuntimeMode;
    debug: boolean;
  };
  logging: {
    enabled: boolean;
    level: LogLevel;
  };
  storage: {
    driver: 'local' | 'memory';
    namespace: string;
  };
  workspace: {
    rootElementId: string;
    title: string;
    description: string;
  };
}

/**
 * Immutable baseline configuration for the core engine.
 */
export const DEFAULT_CONFIG: CubeConfig = {
  appName: 'Cube OS',
  environment: {
    mode: 'development',
    debug: true,
  },
  logging: {
    enabled: true,
    level: 'info',
  },
  storage: {
    driver: 'local',
    namespace: 'cube-os',
  },
  workspace: {
    rootElementId: 'app',
    title: 'Cube OS Core Engine',
    description: 'Core runtime initialized successfully.',
  },
};
