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
  async cleanup(): Promise<{ logsDeleted: number; auditEventsDeleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    let logsDeleted = 0;
    let auditEventsDeleted = 0;

    // Clean up execution_logs in batches
    logsDeleted = await this.cleanupTable('execution_logs', cutoffTimestamp);

    // Clean up execution_audit_events in batches
    auditEventsDeleted = await this.cleanupTable('execution_audit_events', cutoffTimestamp);

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
   * Get current log statistics
   */
  getStats(): { logCount: number; auditEventCount: number; oldestLog?: number; oldestAuditEvent?: number } {
    const logStats = this.db.prepare(`
      SELECT COUNT(*) as count, MIN(timestamp) as oldest
      FROM execution_logs
    `).get() as any;

    const auditStats = this.db.prepare(`
      SELECT COUNT(*) as count, MIN(timestamp) as oldest
      FROM execution_audit_events
    `).get() as any;

    return {
      logCount: logStats.count || 0,
      auditEventCount: auditStats.count || 0,
      oldestLog: logStats.oldest,
      oldestAuditEvent: auditStats.oldest,
    };
  }
}