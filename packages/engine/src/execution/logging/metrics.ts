import { Database } from 'bun:sqlite';
import { ExecutionLogMetrics, TaskRunLogMetrics } from './models';

/**
 * Service for tracking and updating log metrics in execution and task run metadata
 */
export class LogMetricsTracker {
  constructor(private db: Database) {}

  /**
   * Update execution log metrics based on current log data
   */
  updateExecutionLogMetrics(executionId: string): ExecutionLogMetrics {
    const logs = this.db.prepare(`
      SELECT level, source, timestamp
      FROM execution_logs
      WHERE execution_id = ?
      ORDER BY timestamp ASC
    `).all(executionId) as Array<{ level: string; source: string; timestamp: number }>;

    const metrics: ExecutionLogMetrics = {
      totalLogs: logs.length,
      logsByLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
      logsBySource: { scheduler: 0, worker: 0, plugin: 0 },
    };

    if (logs.length === 0) {
      return metrics;
    }

    // Calculate metrics
    for (const log of logs) {
      // Count by level
      if (log.level in metrics.logsByLevel) {
        metrics.logsByLevel[log.level as keyof typeof metrics.logsByLevel]++;
      }

      // Count by source
      if (log.source in metrics.logsBySource) {
        metrics.logsBySource[log.source as keyof typeof metrics.logsBySource]++;
      }
    }

    // Set timestamps
    metrics.firstLogAt = new Date(logs[0].timestamp);
    metrics.lastLogAt = new Date(logs[logs.length - 1].timestamp);

    return metrics;
  }

  /**
   * Update task run log metrics based on current log data
   */
  updateTaskRunLogMetrics(executionId: string, taskId: string): TaskRunLogMetrics {
    const logs = this.db.prepare(`
      SELECT level, timestamp
      FROM execution_logs
      WHERE execution_id = ? AND task_id = ?
      ORDER BY timestamp ASC
    `).all(executionId, taskId) as Array<{ level: string; timestamp: number }>;

    const metrics: TaskRunLogMetrics = {
      totalLogs: logs.length,
      logsByLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 },
    };

    if (logs.length === 0) {
      return metrics;
    }

    // Calculate metrics
    for (const log of logs) {
      if (log.level in metrics.logsByLevel) {
        metrics.logsByLevel[log.level as keyof typeof metrics.logsByLevel]++;
      }
    }

    // Set timestamps
    metrics.firstLogAt = new Date(logs[0].timestamp);
    metrics.lastLogAt = new Date(logs[logs.length - 1].timestamp);

    return metrics;
  }

  /**
   * Get current log metrics for an execution
   */
  getExecutionLogMetrics(executionId: string): ExecutionLogMetrics | null {
    try {
      return this.updateExecutionLogMetrics(executionId);
    } catch (error) {
      console.warn(`Failed to get log metrics for execution ${executionId}:`, error);
      return null;
    }
  }

  /**
   * Get current log metrics for a task run
   */
  getTaskRunLogMetrics(executionId: string, taskId: string): TaskRunLogMetrics | null {
    try {
      return this.updateTaskRunLogMetrics(executionId, taskId);
    } catch (error) {
      console.warn(`Failed to get log metrics for task ${taskId}:`, error);
      return null;
    }
  }
}