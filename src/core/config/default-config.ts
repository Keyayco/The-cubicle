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
    windowWidth: number;
    windowHeight: number;
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
    title: 'Cube OS Workspace',
    description: 'Workspace environment initialized successfully.',
    windowWidth: 480,
    windowHeight: 320,
  },
};
