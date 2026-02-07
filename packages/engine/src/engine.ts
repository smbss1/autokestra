// Main engine class that orchestrates all components

import { SQLiteStateStore, type SQLiteConfig } from './storage/sqlite';
import { CrashRecovery } from './storage/recovery';
import type { StateStore } from './storage/types';
import { LogRetentionManager } from './execution/logging';

export interface EngineConfig {
  storage: SQLiteConfig;
  silent?: boolean; // Suppress console logging
  logRetentionDays?: number; // Default: 30
}

export class Engine {
  private stateStore: StateStore;
  private crashRecovery: CrashRecovery;
  private retentionManager?: LogRetentionManager;
  private cleanupInterval?: Timer;
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

    // Initialize log retention manager
    const retentionDays = this.config.logRetentionDays || 30;
    this.retentionManager = new LogRetentionManager({
      db: (this.stateStore as any).db,
      retentionDays,
    });

    // Run initial log cleanup
    const cleanupStats = await this.retentionManager.cleanup();
    this.log('✓ Log cleanup complete:', {
      logsDeleted: cleanupStats.logsDeleted,
      auditEventsDeleted: cleanupStats.auditEventsDeleted,
    });

    // Schedule daily cleanup
    this.scheduleDailyCleanup();

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

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    await this.stateStore.close();
    this.initialized = false;
    this.log('Engine stopped');
  }

  private scheduleDailyCleanup(): void {
    // Run cleanup every 24 hours
    const oneDayMs = 24 * 60 * 60 * 1000;
    this.cleanupInterval = setInterval(async () => {
      if (!this.retentionManager) return;

      try {
        const cleanupStats = await this.retentionManager.cleanup();
        this.log('✓ Daily log cleanup complete:', {
          logsDeleted: cleanupStats.logsDeleted,
          auditEventsDeleted: cleanupStats.auditEventsDeleted,
        });
      } catch (error) {
        this.log('✗ Daily log cleanup failed:', error);
      }
    }, oneDayMs);
  }

  getStateStore(): StateStore {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }
    return this.stateStore;
  }

  getDatabase(): any {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }
    return (this.stateStore as any).db;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
