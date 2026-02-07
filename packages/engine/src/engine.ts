// Main engine class that orchestrates all components

import { SQLiteStateStore, type SQLiteConfig } from './storage/sqlite';
import { CrashRecovery } from './storage/recovery';
import type { StateStore } from './storage/types';

export interface EngineConfig {
  storage: SQLiteConfig;
  silent?: boolean; // Suppress console logging
}

export class Engine {
  private stateStore: StateStore;
  private crashRecovery: CrashRecovery;
  private initialized = false;
  private silent: boolean;

  constructor(private config: EngineConfig) {
    this.silent = config.silent || false;
    this.stateStore = new SQLiteStateStore(config.storage);
    this.crashRecovery = new CrashRecovery(this.stateStore);
  }

  private log(message: string, ...args: any[]): void {
    if (!this.silent) {
      console.log(message, ...args);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.log('Initializing engine...');

    // Initialize state store (runs migrations)
    await this.stateStore.initialize();
    this.log('✓ State store initialized');

    // Run crash recovery to handle interrupted executions
    const recoveryStats = await this.crashRecovery.recover();
    this.log('✓ Crash recovery complete:', {
      failedExecutions: recoveryStats.failedExecutions,
      failedTaskRuns: recoveryStats.failedTaskRuns,
      requeuedExecutions: recoveryStats.requeuedExecutions,
      duration: `${recoveryStats.duration}ms`,
    });

    this.initialized = true;
    this.log('Engine ready');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.log('Shutting down engine...');
    await this.stateStore.close();
    this.initialized = false;
    this.log('Engine stopped');
  }

  getStateStore(): StateStore {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }
    return this.stateStore;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
