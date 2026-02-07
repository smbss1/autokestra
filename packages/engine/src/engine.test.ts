import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Engine } from './engine';
import { createInitialExecution } from './execution/models';
import { ExecutionState } from './execution/types';
import { unlinkSync, existsSync } from 'fs';

describe('Engine', () => {
  const testDbPath = './test-engine.db';
  let engine: Engine;

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    engine = new Engine({
      storage: {
        path: testDbPath,
        retentionDays: 30,
      },
    });
  });

  afterEach(async () => {
    await engine.shutdown();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should initialize successfully', async () => {
    await engine.initialize();
    expect(engine.isInitialized()).toBe(true);
  });

  it('should run crash recovery on initialization', async () => {
    // First, create a RUNNING execution without engine initialization
    const store = engine['stateStore'];
    await store.initialize();

    await store.saveWorkflow({
      id: 'wf1',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const exec = createInitialExecution('wf1', 'exec1');
    exec.state = ExecutionState.RUNNING;
    await store.createExecution(exec);
    await store.close();

    // Now initialize the full engine - should recover the RUNNING execution
    await engine.initialize();

    const recovered = await engine.getStateStore().getExecution('exec1');
    expect(recovered?.state).toBe(ExecutionState.FAILED);
    expect(recovered?.reasonCode).toBe('CRASH_RECOVERY');
  });

  it('should provide access to state store after initialization', async () => {
    await engine.initialize();
    const stateStore = engine.getStateStore();
    expect(stateStore).toBeDefined();

    // Test that we can use the state store
    await stateStore.saveWorkflow({
      id: 'test-wf',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const workflow = await stateStore.getWorkflow('test-wf');
    expect(workflow?.id).toBe('test-wf');
  });

  it('should throw error when accessing state store before initialization', () => {
    expect(() => engine.getStateStore()).toThrow('Engine not initialized');
  });

  it('should handle multiple initialize calls', async () => {
    await engine.initialize();
    await engine.initialize(); // Should not throw
    expect(engine.isInitialized()).toBe(true);
  });

  it('should shutdown cleanly', async () => {
    await engine.initialize();
    await engine.shutdown();
    expect(engine.isInitialized()).toBe(false);
  });
});
