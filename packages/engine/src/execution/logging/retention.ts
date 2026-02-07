import { Database } from 'bun:sqlite';

export interface LogRetentionConfig {
  db: Database;
  retentionDays: number;
  batchSize?: number; // Default: 1000
}

export class LogRetentionManager {
  private db: Database;
  private retentionDays: number;
  private batchSize: number;

  constructor(config: LogRetentionConfig) {
    this.db = config.db;
    this.retentionDays = config.retentionDays;
    this.batchSize = config.batchSize || 1000;
  }

  /**
   * Run cleanup of old logs and audit events
   */
  async cleanup(logger?: { warn: (message: string) => void }): Promise<{ logsDeleted: number; auditEventsDeleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    let logsDeleted = 0;
    let auditEventsDeleted = 0;

    // Check size before cleanup
    this.checkSizeWarnings(logger);

    // Clean up execution_logs in batches
    logsDeleted = await this.cleanupTable('execution_logs', cutoffTimestamp);

    // Clean up execution_audit_events in batches
    auditEventsDeleted = await this.cleanupTable('execution_audit_events', cutoffTimestamp);

    // Check size after cleanup
    this.checkSizeWarnings(logger);

    return { logsDeleted, auditEventsDeleted };
  }

  private async cleanupTable(tableName: string, cutoffTimestamp: number): Promise<number> {
    let totalDeleted = 0;

    while (true) {
      const deleted = this.db.prepare(`
        DELETE FROM ${tableName}
        WHERE timestamp < ?
        LIMIT ?
      `).run(cutoffTimestamp, this.batchSize).changes;

      totalDeleted += deleted;

      if (deleted < this.batchSize) {
        // No more rows to delete
        break;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return totalDeleted;
  }

  /**
   * Get current log statistics including estimated sizes
   */
  getStats(): {
    logCount: number;
    auditEventCount: number;
    oldestLog?: number;
    oldestAuditEvent?: number;
    estimatedLogSizeMB: number;
    estimatedAuditSizeMB: number;
    totalEstimatedSizeMB: number;
  } {
    const logStats = this.db.prepare(`
      SELECT COUNT(*) as count, MIN(timestamp) as oldest
      FROM execution_logs
    `).get() as any;

    const auditStats = this.db.prepare(`
      SELECT COUNT(*) as count, MIN(timestamp) as oldest
      FROM execution_audit_events
    `).get() as any;

    // Estimate sizes (rough approximation: ~200 bytes per log entry, ~150 bytes per audit event)
    const estimatedLogSizeMB = ((logStats.count || 0) * 200) / (1024 * 1024);
    const estimatedAuditSizeMB = ((auditStats.count || 0) * 150) / (1024 * 1024);
    const totalEstimatedSizeMB = estimatedLogSizeMB + estimatedAuditSizeMB;

    return {
      logCount: logStats.count || 0,
      auditEventCount: auditStats.count || 0,
      oldestLog: logStats.oldest,
      oldestAuditEvent: auditStats.oldest,
      estimatedLogSizeMB,
      estimatedAuditSizeMB,
      totalEstimatedSizeMB,
    };
  }

  /**
   * Check if database size exceeds warning threshold and log warnings
   */
  checkSizeWarnings(logger?: { warn: (message: string) => void }): boolean {
    const stats = this.getStats();
    const sizeGB = stats.totalEstimatedSizeMB / 1024;

    if (sizeGB >= 1.0) {
      const message = `Database size warning: estimated ${sizeGB.toFixed(2)}GB exceeds 1GB threshold ` +
        `(logs: ${stats.estimatedLogSizeMB.toFixed(2)}MB, audit: ${stats.estimatedAuditSizeMB.toFixed(2)}MB)`;
      if (logger) {
        logger.warn(message);
      } else {
        console.warn(message);
      }
      return true;
    }

    return false;
  }
}