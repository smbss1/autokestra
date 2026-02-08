import type { StoredWorkflow, StateStore } from '../storage/types';

export interface CronSchedulerOptions {
  stateStore: StateStore;
  pollIntervalMs?: number;
  silent?: boolean;
  /** Called when a cron trigger is due. */
  onDue: (workflow: StoredWorkflow, scheduledAt: Date) => Promise<void>;
}

function startOfMinute(d: Date): Date {
  const x = new Date(d);
  x.setSeconds(0, 0);
  return x;
}

function endOfMinute(d: Date): Date {
  const x = startOfMinute(d);
  x.setMinutes(x.getMinutes() + 1);
  return x;
}

function parseSimpleField(field: string, value: number): boolean {
  const f = field.trim();
  if (f === '*') return true;
  if (f.startsWith('*/')) {
    const step = Number.parseInt(f.slice(2), 10);
    if (!Number.isFinite(step) || step <= 0) return false;
    return value % step === 0;
  }
  const exact = Number.parseInt(f, 10);
  if (!Number.isFinite(exact)) return false;
  return value === exact;
}

export function matchesCron(expr: string, when: Date): boolean {
  const parts = String(expr).trim().split(/\s+/g);
  if (parts.length !== 5) return false;

  const [minF, hourF, domF, monthF, dowF] = parts;
  const minute = when.getMinutes();
  const hour = when.getHours();
  const dom = when.getDate();
  const month = when.getMonth() + 1;
  const dow = when.getDay(); // 0 = Sunday

  // Minimal v0.1 support: '*', '*/n', or exact number.
  // (No ranges, lists, or names yet.)
  const dowNormalized = dowF.trim() === '7' ? 0 : dow;

  return (
    parseSimpleField(minF, minute) &&
    parseSimpleField(hourF, hour) &&
    parseSimpleField(domF, dom) &&
    parseSimpleField(monthF, month) &&
    parseSimpleField(dowF, dowNormalized)
  );
}

async function listAllWorkflows(stateStore: StateStore): Promise<StoredWorkflow[]> {
  const all: StoredWorkflow[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const page = await stateStore.listWorkflows({ limit, offset });
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length < limit) break;
  }

  return all;
}

export function startCronScheduler(options: CronSchedulerOptions): { stop: () => Promise<void> } {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const silent = options.silent ?? false;

  let stopped = false;
  let timer: Timer | undefined;
  let runningTick = false;

  const tick = async () => {
    if (stopped || runningTick) return;
    runningTick = true;

    try {
      const now = new Date();
      const minuteStart = startOfMinute(now);
      const minuteEnd = endOfMinute(now);

      const workflows = await listAllWorkflows(options.stateStore);
      for (const wf of workflows) {
        if (!wf.enabled) continue;

        const trigger = (wf.definition as any)?.trigger;
        if (!trigger || trigger.type !== 'cron') continue;

        const expr = String(trigger.cron || '').trim();
        if (!expr) continue;

        if (!matchesCron(expr, now)) continue;

        // Dedup: at most 1 execution per workflow per minute.
        const existing = await options.stateStore.listExecutions({
          workflowId: wf.id,
          createdAfter: minuteStart,
          createdBefore: minuteEnd,
          limit: 1,
          offset: 0,
        });
        if (existing.total > 0) {
          continue;
        }

        await options.onDue(wf, minuteStart);
      }
    } catch (err) {
      if (!silent) {
        // eslint-disable-next-line no-console
        console.error('cron tick failed:', err);
      }
    } finally {
      runningTick = false;
    }
  };

  timer = setInterval(() => void tick(), pollIntervalMs);

  return {
    stop: async () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      // best-effort: wait for any in-flight tick
      while (runningTick) {
        await new Promise((r) => setTimeout(r, 10));
      }
    },
  };
}
