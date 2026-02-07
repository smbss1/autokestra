import { StateStore } from './types';
import { transitionExecution, transitionTaskRun } from '../execution/stateMachine';
import { ExecutionState, TaskRunState } from '../execution/types';

export interface RecoveryStats {
  failedExecutions: number;
  requeuedExecutions: number;
  failedTaskRuns: number;
  duration: number;
}

export class CrashRecovery {
  constructor(private stateStore: StateStore) {}

  async recover(): Promise<RecoveryStats> {
    const startTime = Date.now();
    const stats: RecoveryStats = {
      failedExecutions: 0,
      requeuedExecutions: 0,
      failedTaskRuns: 0,
      duration: 0,
    };

    console.log('🔄 Starting crash recovery...');

    // Get all RUNNING executions and mark as FAILED
    const runningExecutions = await this.stateStore.getActiveExecutions();
    
    for (const execution of runningExecutions) {
      try {
        // Transition to FAILED with CRASH_RECOVERY reason
        const updated = transitionExecution(execution, {
          type: 'EXECUTION_FAILED',
          reasonCode: 'CRASH_RECOVERY',
          message: 'Execution was running during engine crash',
        });

        await this.stateStore.updateExecution(updated);
        stats.failedExecutions++;

        // Also fail all running task runs for this execution
        const taskRuns = await this.stateStore.listTaskRuns({ executionId: execution.executionId });
        
        for (const taskRun of taskRuns.items) {
          if (taskRun.state === TaskRunState.RUNNING) {
            const updatedTaskRun = transitionTaskRun(taskRun, {
              type: 'TASK_FAILED',
              reasonCode: 'CRASH_RECOVERY',
              message: 'Task was running during engine crash',
            });
            await this.stateStore.updateTaskRun(updatedTaskRun);
            stats.failedTaskRuns++;
          }
        }

        console.log(`  ✗ Marked execution ${execution.executionId} as FAILED (crash recovery)`);
      } catch (error) {
        console.error(`  Failed to recover execution ${execution.executionId}:`, error);
      }
    }

    // Get all PENDING/WAITING executions for potential re-queueing
    const pendingExecutions = await this.stateStore.getPendingExecutions();
    
    for (const execution of pendingExecutions) {
      // For now, just log them - actual re-queueing would require scheduler integration
      console.log(`  ⏸️  Found pending execution ${execution.executionId} (state: ${execution.state})`);
      stats.requeuedExecutions++;
    }

    stats.duration = Date.now() - startTime;

    console.log(`✓ Crash recovery complete:`);
    console.log(`  - Failed executions: ${stats.failedExecutions}`);
    console.log(`  - Failed task runs: ${stats.failedTaskRuns}`);
    console.log(`  - Pending executions found: ${stats.requeuedExecutions}`);
    console.log(`  - Duration: ${stats.duration}ms`);

    return stats;
  }
}
