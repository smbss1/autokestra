// Task executor contract and implementations

import { TaskExecutor } from './interfaces';
import { WorkItem, WorkResult } from './types';

export class TestTaskExecutor implements TaskExecutor {
  constructor(private simulateDurationMs: number = 100, private outcome: 'SUCCESS' | 'FAILED' = 'SUCCESS') {}

  async execute(workItem: WorkItem, signal: AbortSignal): Promise<WorkResult> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({
          workItemId: workItem.id,
          outcome: this.outcome,
          result: { simulated: true },
          durationMs: Date.now() - start,
        });
      }, this.simulateDurationMs);

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('CANCELLED'));
      });
    });
  }
}