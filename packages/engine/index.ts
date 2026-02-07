// Engine package entry point
export const version = '0.0.1';

// Main engine class
export { Engine, type EngineConfig } from './src/engine';

// Execution state machine
export * as execution from './src/execution';

// Storage layer
export * as storage from './src/storage';
