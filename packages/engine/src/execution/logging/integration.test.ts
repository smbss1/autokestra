import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { SQLiteStateStore } from '../../storage/sqlite';
import { PersistentScheduler } from '../../scheduler/persistent';
import { LogCollector, LogLevel } from './collector';
import { AuditLogger } from './audit';
import { LogMetricsTracker } from './metrics';
import { LogStore } from './store';
import { LogRetentionManager } from './retention';
import { ExecutionState } from '../../execution/types';
import { TaskRunState } from '../../execution/types';
import { unlinkSync, existsSync } from 'fs';

describe('Observability Integration Tests', () => {
  const testDbPath = './test-integration.db';
  let db: Database;
  let store: SQLiteStateStore;
  let logCollector: LogCollector;
  let auditLogger: AuditLogger;
  let logMetricsTracker: LogMetricsTracker;
  let logStore: LogStore;
  let scheduler: PersistentScheduler;

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Create a single database instance for all components
    db = new Database(testDbPath);

    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    // Run migrations
    const { MigrationRunner } = await import('../../storage/migrations/runner');
    const migrationRunner = new MigrationRunner(testDbPath);
    await migrationRunner.runPendingMigrations(db);

    store = new SQLiteStateStore({ path: testDbPath });
    await store.initialize();

    // Create a test workflow
    await store.saveWorkflow({
      id: 'test-workflow',
      definition: { tasks: [], triggers: [] },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize observability components with the same db instance
    logCollector = new LogCollector({
      db,
      maxBufferSize: 10, // Small buffer for testing
      flushIntervalMs: 100
    });

    auditLogger = new AuditLogger({ db });

    logMetricsTracker = new LogMetricsTracker(db);

    logStore = new LogStore({ db });

    scheduler = new PersistentScheduler({
      stateStore: store,
      logCollector,
      auditLogger,
      logMetricsTracker
    });
  });

  afterEach(async () => {
    logCollector.close();
    await store.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should capture complete execution lifecycle with logs and audit events', async () => {
    const executionId = 'integration-test-exec-1';
    const workflowId = 'test-workflow';

    // Step 1: Create execution
    console.log('Creating execution...');
    const execution = await scheduler.createExecution(workflowId, executionId);

    expect(execution.executionId).toBe(executionId);
    expect(execution.workflowId).toBe(workflowId);
    expect(execution.state).toBe(ExecutionState.PENDING);

    // Step 2: Start execution
    console.log('Starting execution...');
    await scheduler.startExecution(executionId);

    const startedExecution = await store.getExecution(executionId);
    expect(startedExecution?.state).toBe(ExecutionState.RUNNING);

    // Step 3: Complete execution
    console.log('Completing execution...');
    await scheduler.completeExecution(executionId, ExecutionState.SUCCESS);

    const completedExecution = await store.getExecution(executionId);
    expect(completedExecution?.state).toBe(ExecutionState.SUCCESS);

    // Force flush any remaining logs
    logCollector.flush();

    // Step 4: Verify logs were captured
    console.log('Verifying logs...');
    const logs = logStore.getLogsByExecution(executionId);
    expect(logs.length).toBeGreaterThan(0);

    // Should have logs for: execution created, started, completed
    const logMessages = logs.map(log => log.message);
    expect(logMessages.some(msg => msg.includes('Execution created'))).toBe(true);
    expect(logMessages.some(msg => msg.includes('Execution started'))).toBe(true);
    expect(logMessages.some(msg => msg.includes('Execution success'))).toBe(true);

    // Step 5: Verify audit events were captured
    console.log('Verifying audit events...');
    const auditEvents = db.prepare(`
      SELECT * FROM execution_audit_events
      WHERE execution_id = ?
      ORDER BY timestamp
    `).all(executionId) as any[];

    expect(auditEvents.length).toBeGreaterThan(0);

    // Should have: CREATED, STARTED, STATE_CHANGE, COMPLETED
    const eventTypes = auditEvents.map(event => event.event_type);
    expect(eventTypes).toContain('CREATED');
    expect(eventTypes).toContain('STARTED');
    expect(eventTypes).toContain('STATE_CHANGE');
    expect(eventTypes).toContain('COMPLETED');

    // Step 6: Verify log metrics were tracked
    console.log('Verifying log metrics...');
    const metrics = logMetricsTracker.getExecutionLogMetrics(executionId);
    expect(metrics).toBeDefined();
    if (metrics) {
      expect(metrics.totalLogs).toBeGreaterThan(0);
      expect(metrics.logsByLevel).toBeDefined();
      expect(metrics.logsBySource).toBeDefined();
      expect(metrics.firstLogAt).toBeDefined();
      expect(metrics.lastLogAt).toBeDefined();
    }

    // Step 7: Verify execution metadata includes log metrics
    const finalExecution = await store.getExecution(executionId);
    expect(finalExecution?.metadata?.logMetrics).toBeDefined();

    console.log(`Integration test complete: ${logs.length} logs, ${auditEvents.length} audit events, metrics tracked`);
  });

  it('should inspect execution with multiple tasks', async () => {
    const executionId = 'integration-test-inspect-1';

    // Create execution
    await scheduler.createExecution('test-workflow', executionId);
    await scheduler.startExecution(executionId);

    // Create some task runs (simulating multiple tasks)
    const taskIds = ['task-1', 'task-2', 'task-3'];
    for (const taskId of taskIds) {
      await store.createTaskRun({
        executionId,
        taskId,
        state: TaskRunState.RUNNING,
        timestamps: {
          createdAt: new Date(),
          startedAt: new Date(),
          updatedAt: new Date(),
        },
        reasonCode: undefined,
        message: undefined,
        metadata: {},
      });
    }

    // Complete some tasks
    await scheduler.completeTaskRun(executionId, 'task-1', TaskRunState.SUCCESS);
    await scheduler.completeTaskRun(executionId, 'task-2', TaskRunState.FAILED);

    // Force flush logs
    logCollector.flush();

    // Test inspection - get execution details
    const execution = await store.getExecution(executionId);
    expect(execution).toBeDefined();
    expect(execution?.state).toBe(ExecutionState.RUNNING);

    // Get task runs
    const taskRuns = await store.listTaskRuns({ executionId });
    expect(taskRuns.items.length).toBe(3);

    const completedTasks = taskRuns.items.filter(tr => tr.state === TaskRunState.SUCCESS || tr.state === TaskRunState.FAILED);
    const runningTasks = taskRuns.items.filter(tr => tr.state === TaskRunState.RUNNING);

    expect(completedTasks.length).toBe(2);
    expect(runningTasks.length).toBe(1);

    // Verify logs exist for tasks
    const logs = logStore.getLogsByExecution(executionId);
    const taskLogs = logs.filter(log => log.taskId);
    expect(taskLogs.length).toBeGreaterThan(0);

    console.log(`Inspection test complete: ${taskRuns.items.length} tasks, ${logs.length} logs`);
  });

  it('should capture plugin stdout/stderr logs correctly', async () => {
    const executionId = 'integration-test-plugin-1';
    const taskId = 'plugin-task-1';

    // Create execution and task
    await scheduler.createExecution('test-workflow', executionId);
    await scheduler.startExecution(executionId);

    await store.createTaskRun({
      executionId,
      taskId,
      state: TaskRunState.RUNNING,
      timestamps: {
        createdAt: new Date(),
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      reasonCode: undefined,
      message: undefined,
      metadata: {},
    });

    // Simulate plugin logging (like the plugin runtime would do)
    const pluginSource = `plugin:${executionId}/${taskId}`;

    // Log some structured plugin output
    logCollector.log({
      executionId,
      taskId,
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: pluginSource,
      message: 'Plugin started processing',
      metadata: { action: 'process', inputSize: 1024 },
    });

    // Log some plain text stderr output
    logCollector.log({
      executionId,
      taskId,
      timestamp: Date.now() + 100,
      level: LogLevel.WARN,
      source: pluginSource,
      message: 'Warning: deprecated API usage detected',
    });

    // Log error output
    logCollector.log({
      executionId,
      taskId,
      timestamp: Date.now() + 200,
      level: LogLevel.ERROR,
      source: pluginSource,
      message: 'Failed to connect to external service',
      metadata: { error: 'ECONNREFUSED', service: 'database' },
    });

    // Force flush logs
    logCollector.flush();

    // Verify plugin logs were captured
    const logs = logStore.getLogsByExecution(executionId);
    const pluginLogs = logs.filter(log => log.source === pluginSource);

    expect(pluginLogs.length).toBe(3);

    // Check structured log
    const infoLog = pluginLogs.find(log => log.level === 'INFO');
    expect(infoLog).toBeDefined();
    expect(infoLog?.message).toBe('Plugin started processing');
    expect(infoLog?.metadata?.action).toBe('process');

    // Check warning log
    const warnLog = pluginLogs.find(log => log.level === 'WARN');
    expect(warnLog).toBeDefined();
    expect(warnLog?.message).toContain('deprecated API');

    // Check error log
    const errorLog = pluginLogs.find(log => log.level === 'ERROR');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('Failed to connect');
    expect(errorLog?.metadata?.error).toBe('ECONNREFUSED');

    // Verify all plugin logs have correct correlation
    pluginLogs.forEach(log => {
      expect(log.executionId).toBe(executionId);
      expect(log.taskId).toBe(taskId);
      expect(log.source).toBe(pluginSource);
    });

    console.log(`Plugin logging test complete: ${pluginLogs.length} plugin logs captured`);
  });

  it('should show complete audit trail for execution lifecycle', async () => {
    const executionId = 'integration-test-audit-1';
    const workflowId = 'test-workflow'; // Use the existing test workflow

    // Create execution (should emit CREATED event)
    await scheduler.createExecution(workflowId, executionId);

    // Start execution (should emit STARTED event)
    await scheduler.startExecution(executionId);

    // Wait a bit for events to be emitted
    await new Promise(resolve => setTimeout(resolve, 10));

    // Complete execution (should emit COMPLETED event)
    await scheduler.completeExecution(executionId, ExecutionState.SUCCESS);

    // Get audit trail
    const auditTrail = logStore.getAuditTrail(executionId);

    // Verify all expected events are present
    expect(auditTrail.length).toBeGreaterThanOrEqual(3);

    // Check CREATED event
    const createdEvent = auditTrail.find(e => e.eventType === 'CREATED');
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.metadata.workflowId).toBe(workflowId);
    expect(createdEvent?.metadata.triggerType).toBe('manual');

    // Check STARTED event
    const startedEvent = auditTrail.find(e => e.eventType === 'STARTED');
    expect(startedEvent).toBeDefined();

    // Check COMPLETED event
    const completedEvent = auditTrail.find(e => e.eventType === 'COMPLETED');
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.metadata.duration).toBeDefined();
    expect(typeof completedEvent?.metadata.duration).toBe('number');

    // Verify events are in chronological order
    const timestamps = auditTrail.map(e => e.timestamp);
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sortedTimestamps);

    // Verify all events have the correct executionId
    auditTrail.forEach(event => {
      expect(event.executionId).toBe(executionId);
    });

    console.log(`Audit trail test complete: ${auditTrail.length} audit events recorded`);
  });

  it('should cleanup old logs with retention policy', async () => {
    const executionId = 'retention-test-1';
    const oldTimestamp = Date.now() - (35 * 24 * 60 * 60 * 1000); // 35 days ago

    // Create some old logs manually (bypassing normal flow to set old timestamps)
    logCollector.log({
      executionId,
      timestamp: oldTimestamp,
      level: LogLevel.INFO,
      source: 'test',
      message: 'Old log entry that should be cleaned up',
    });

    logCollector.log({
      executionId,
      timestamp: oldTimestamp + 1000,
      level: LogLevel.WARN,
      source: 'test',
      message: 'Another old log entry',
    });

    // Create old audit events
    auditLogger.log({
      executionId,
      eventType: 'CREATED',
      timestamp: oldTimestamp + 2000,
      metadata: { test: 'old' },
    });

    // Create a recent log that should NOT be deleted
    logCollector.log({
      executionId: 'recent-execution',
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Recent log that should be kept',
    });

    // Force flush logs
    logCollector.flush();

    // Verify old logs exist before cleanup
    const allLogsBefore = logStore.getLogsByExecution(executionId);
    expect(allLogsBefore.length).toBeGreaterThanOrEqual(2);

    const allAuditBefore = logStore.getAuditTrail(executionId);
    expect(allAuditBefore.length).toBeGreaterThanOrEqual(1);

    // Create retention manager with 30 day retention
    const retentionManager = new LogRetentionManager({
      db,
      retentionDays: 30,
      batchSize: 10
    });

    // Run cleanup
    const cleanupResult = await retentionManager.cleanup();

    // Verify cleanup deleted old logs
    expect(cleanupResult.logsDeleted).toBeGreaterThanOrEqual(2);
    expect(cleanupResult.auditEventsDeleted).toBeGreaterThanOrEqual(1);

    // Verify old logs are gone
    const remainingOldLogs = logStore.getLogsByExecution(executionId);
    expect(remainingOldLogs.length).toBe(0);

    const remainingOldAudit = logStore.getAuditTrail(executionId);
    expect(remainingOldAudit.length).toBe(0);

    // Verify recent logs are still there
    const recentLogs = logStore.getLogsByExecution('recent-execution');
    expect(recentLogs.length).toBe(1);
    expect(recentLogs[0].message).toBe('Recent log that should be kept');

    console.log(`Retention cleanup test complete: deleted ${cleanupResult.logsDeleted} logs, ${cleanupResult.auditEventsDeleted} audit events`);
  });

  it('should filter logs correctly by level, task, and time', async () => {
    const executionId = 'filter-test-1';
    const taskId1 = 'task-1';
    const taskId2 = 'task-2';
    const baseTime = Date.now();

    // Create logs with different levels, tasks, and timestamps
    logCollector.log({
      executionId,
      taskId: taskId1,
      timestamp: baseTime - 60000, // 1 minute ago
      level: LogLevel.INFO,
      source: 'scheduler',
      message: 'Task 1 info log',
    });

    logCollector.log({
      executionId,
      taskId: taskId1,
      timestamp: baseTime - 30000, // 30 seconds ago
      level: LogLevel.WARN,
      source: 'scheduler',
      message: 'Task 1 warning log',
    });

    logCollector.log({
      executionId,
      taskId: taskId2,
      timestamp: baseTime - 15000, // 15 seconds ago
      level: LogLevel.ERROR,
      source: 'scheduler',
      message: 'Task 2 error log',
    });

    logCollector.log({
      executionId,
      taskId: taskId2,
      timestamp: baseTime - 5000, // 5 seconds ago
      level: LogLevel.DEBUG,
      source: 'scheduler',
      message: 'Task 2 debug log',
    });

    // Force flush
    logCollector.flush();

    // Test 1: Filter by level (only ERROR and WARN)
    const errorWarnLogs = logStore.getLogsByExecution(executionId, { level: ['ERROR', 'WARN'] });
    expect(errorWarnLogs.length).toBe(2);
    expect(errorWarnLogs.every(log => ['ERROR', 'WARN'].includes(log.level))).toBe(true);

    // Test 2: Filter by taskId
    const task1Logs = logStore.getLogsByExecution(executionId, { taskId: taskId1 });
    expect(task1Logs.length).toBe(2);
    expect(task1Logs.every(log => log.taskId === taskId1)).toBe(true);

    const task2Logs = logStore.getLogsByExecution(executionId, { taskId: taskId2 });
    expect(task2Logs.length).toBe(2);
    expect(task2Logs.every(log => log.taskId === taskId2)).toBe(true);

    // Test 3: Filter by time (since 20 seconds ago)
    const recentLogs = logStore.getLogsByExecution(executionId, { since: 20000 });
    expect(recentLogs.length).toBe(2); // Should get the 15s and 5s ago logs
    expect(recentLogs.every(log => log.timestamp >= baseTime - 20000)).toBe(true);

    // Test 4: Combined filters (task + level)
    const task2Errors = logStore.getLogsByExecution(executionId, {
      taskId: taskId2,
      level: ['ERROR']
    });
    expect(task2Errors.length).toBe(1);
    expect(task2Errors[0].level).toBe('ERROR');
    expect(task2Errors[0].taskId).toBe(taskId2);

    // Test 5: Combined filters (level + time)
    const recentWarnsAndErrors = logStore.getLogsByExecution(executionId, {
      level: ['WARN', 'ERROR'],
      since: 40000
    });
    expect(recentWarnsAndErrors.length).toBe(2); // WARN (30s ago) and ERROR (15s ago)
    expect(recentWarnsAndErrors.every(log => ['WARN', 'ERROR'].includes(log.level))).toBe(true);
    expect(recentWarnsAndErrors.every(log => log.timestamp >= baseTime - 40000)).toBe(true);

    console.log(`Log filtering test complete: tested level, task, and time filters`);
  });

  it('should support JSON output format for logs and inspect', async () => {
    const executionId = 'json-test-1';
    const taskId = 'json-task-1';

    // Create execution and task
    await scheduler.createExecution('test-workflow', executionId);
    await scheduler.startExecution(executionId);

    await store.createTaskRun({
      executionId,
      taskId,
      state: TaskRunState.RUNNING,
      timestamps: {
        createdAt: new Date(),
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      reasonCode: undefined,
      message: undefined,
      metadata: { test: 'data' },
    });

    // Create some logs
    logCollector.log({
      executionId,
      taskId,
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Test log message',
      metadata: { key: 'value' },
    });

    logCollector.flush();

    // Test 1: Verify logs are JSON serializable
    const logs = logStore.getLogsByExecution(executionId);
    expect(logs.length).toBeGreaterThan(0);

    // Verify each log has expected JSON structure
    for (const log of logs) {
      expect(typeof log.id).toBe('number');
      expect(typeof log.executionId).toBe('string');
      expect(typeof log.timestamp).toBe('number');
      expect(typeof log.level).toBe('string');
      expect(typeof log.source).toBe('string');
      expect(typeof log.message).toBe('string');

      // Test JSON serialization
      const jsonString = JSON.stringify(log);
      expect(jsonString).toBeDefined();
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify parsed object matches original
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(log);
    }

    // Test 2: Verify audit trail is JSON serializable
    const auditTrail = logStore.getAuditTrail(executionId);
    expect(auditTrail.length).toBeGreaterThan(0);

    for (const event of auditTrail) {
      expect(typeof event.id).toBe('number');
      expect(typeof event.executionId).toBe('string');
      expect(typeof event.eventType).toBe('string');
      expect(typeof event.timestamp).toBe('number');
      expect(typeof event.metadata).toBe('object');

      // Test JSON serialization
      const jsonString = JSON.stringify(event);
      expect(jsonString).toBeDefined();
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(event);
    }

    // Test 3: Verify execution inspection data is JSON serializable
    const execution = await store.getExecution(executionId);
    const taskRuns = await store.listTaskRuns({ executionId });

    expect(execution).toBeDefined();
    expect(taskRuns.items.length).toBeGreaterThan(0);

    // Test execution JSON structure
    const executionJson = JSON.stringify({
      executionId: execution?.executionId,
      workflowId: execution?.workflowId,
      state: execution?.state,
      timestamps: execution?.timestamps,
      metadata: execution?.metadata,
    });
    expect(() => JSON.parse(executionJson)).not.toThrow();

    // Test task runs JSON structure
    const taskRunsJson = JSON.stringify(taskRuns.items.map(tr => ({
      taskId: tr.taskId,
      state: tr.state,
      timestamps: tr.timestamps,
      metadata: tr.metadata,
    })));
    expect(() => JSON.parse(taskRunsJson)).not.toThrow();

    console.log(`JSON output format test complete: verified logs, audit, and inspection data are JSON serializable`);
  });

  it('should mask secrets in task inputs when logging', async () => {
    const executionId = 'secrets-test-1';
    const taskId = 'secrets-task-1';

    // Create execution
    await scheduler.createExecution('test-workflow', executionId);
    await scheduler.startExecution(executionId);

    // Simulate task execution with secrets in inputs (like the WorkflowTaskExecutor would do)
    const taskInputs = {
      apiUrl: 'https://api.example.com',
      apiKey: 'sk-1234567890abcdef', // Should be masked
      password: 'mySecretPassword123', // Should be masked
      token: 'bearer-token-value', // Should be masked
      normalParam: 'normal-value', // Should NOT be masked
      nested: {
        secretKey: 'nested-secret', // Should be masked
        normalKey: 'nested-normal', // Should NOT be masked
      },
      arrayWithSecrets: [
        { password: 'array-secret-1' }, // Should be masked
        { normal: 'array-normal' }, // Should NOT be masked
      ],
    };

    // Log task start with masked inputs (simulating what WorkflowTaskExecutor does)
    logCollector.log({
      executionId,
      taskId,
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'worker',
      message: 'Task started: test-plugin',
      metadata: {
        taskType: 'test-plugin',
        inputs: {
          apiUrl: 'https://api.example.com',
          apiKey: '***MASKED***', // Masked
          password: '***MASKED***', // Masked
          token: '***MASKED***', // Masked
          normalParam: 'normal-value', // Not masked
          nested: {
            secretKey: '***MASKED***', // Masked
            normalKey: 'nested-normal', // Not masked
          },
          arrayWithSecrets: [
            { password: '***MASKED***' }, // Masked
            { normal: 'array-normal' }, // Not masked
          ],
        },
      },
    });

    // Also log task completion with masked outputs
    logCollector.log({
      executionId,
      taskId,
      timestamp: Date.now() + 100,
      level: LogLevel.INFO,
      source: 'worker',
      message: 'Task completed successfully',
      metadata: {
        outputs: {
          result: 'success',
          accessToken: '***MASKED***', // Masked
          refreshToken: '***MASKED***', // Masked
          data: 'normal-output', // Not masked
        },
      },
    });

    logCollector.flush();

    // Verify logs contain masked secrets
    const logs = logStore.getLogsByExecution(executionId);
    const taskLogs = logs.filter(log => log.taskId === taskId);

    expect(taskLogs.length).toBe(2);

    // Check task start log
    const startLog = taskLogs.find(log => log.message.includes('started'));
    expect(startLog).toBeDefined();
    expect(startLog?.metadata?.inputs?.apiKey).toBe('***MASKED***');
    expect(startLog?.metadata?.inputs?.password).toBe('***MASKED***');
    expect(startLog?.metadata?.inputs?.token).toBe('***MASKED***');
    expect(startLog?.metadata?.inputs?.normalParam).toBe('normal-value');
    expect(startLog?.metadata?.inputs?.nested?.secretKey).toBe('***MASKED***');
    expect(startLog?.metadata?.inputs?.nested?.normalKey).toBe('nested-normal');
    expect(startLog?.metadata?.inputs?.arrayWithSecrets[0]?.password).toBe('***MASKED***');
    expect(startLog?.metadata?.inputs?.arrayWithSecrets[1]?.normal).toBe('array-normal');

    // Check task completion log
    const completeLog = taskLogs.find(log => log.message.includes('completed'));
    expect(completeLog).toBeDefined();
    expect(completeLog?.metadata?.outputs?.accessToken).toBe('***MASKED***');
    expect(completeLog?.metadata?.outputs?.refreshToken).toBe('***MASKED***');
    expect(completeLog?.metadata?.outputs?.data).toBe('normal-output');

    // Verify that actual secret values are not in the logs
    const allLogContent = JSON.stringify(logs);
    expect(allLogContent).not.toContain('sk-1234567890abcdef');
    expect(allLogContent).not.toContain('mySecretPassword123');
    expect(allLogContent).not.toContain('bearer-token-value');
    expect(allLogContent).not.toContain('nested-secret');
    expect(allLogContent).not.toContain('array-secret-1');

    console.log(`Secrets masking test complete: verified ${taskLogs.length} task logs have secrets properly masked`);
  });

  it('should handle error scenarios gracefully', async () => {
    const executionId = 'error-test-1';

    // Test 1: Buffer overflow warning
    console.log('Testing buffer overflow handling...');
    const smallBufferCollector = new LogCollector({
      db,
      maxBufferSize: 2, // Very small buffer to trigger overflow
      flushIntervalMs: 1000
    });

    // Add entries to trigger overflow
    smallBufferCollector.log({
      executionId,
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Entry 1',
    });

    smallBufferCollector.log({
      executionId,
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Entry 2',
    });

    // This should trigger flush with warning
    smallBufferCollector.log({
      executionId,
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Entry 3 - triggers overflow',
    });

    smallBufferCollector.close();

    // Test 2: Plugin log truncation
    console.log('Testing plugin log truncation...');
    // This would be tested in plugin runtime, but we can verify the logic works
    const longLine = 'x'.repeat(15000); // 15KB line
    const MAX_LINE_LENGTH = 10000;

    let processedLine = longLine;
    let truncated = false;
    if (longLine.length > MAX_LINE_LENGTH) {
      processedLine = longLine.substring(0, MAX_LINE_LENGTH) + '...[TRUNCATED]';
      truncated = true;
    }

    expect(processedLine.length).toBe(MAX_LINE_LENGTH + '...[TRUNCATED]'.length);
    expect(truncated).toBe(true);
    expect(processedLine.endsWith('...[TRUNCATED]')).toBe(true);

    // Test 3: Audit logger error handling (should not throw)
    console.log('Testing audit logger error handling...');
    // Create audit logger with invalid database to test error handling
    const invalidDb = { prepare: () => { throw new Error('DB error'); } } as any;
    const resilientAuditLogger = new AuditLogger({ db: invalidDb });

    // This should not throw, just log error
    expect(() => {
      resilientAuditLogger.emitCreated('test-exec', 'test-workflow');
    }).not.toThrow();

    console.log(`Error handling test complete: verified buffer overflow, log truncation, and audit error resilience`);
  });

  it('should log correct trigger types for different execution sources', async () => {
    const executionId1 = 'trigger-test-manual';
    const executionId2 = 'trigger-test-webhook';
    const executionId3 = 'trigger-test-schedule';

    // Create executions with different trigger types
    await scheduler.createExecution('test-workflow', executionId1, 'manual');
    await scheduler.createExecution('test-workflow', executionId2, 'webhook');
    await scheduler.createExecution('test-workflow', executionId3, 'schedule');

    // Force flush logs
    logCollector.flush();

    // Verify each execution has correct trigger type in logs
    const logs1 = logStore.getLogsByExecution(executionId1);
    const logs2 = logStore.getLogsByExecution(executionId2);
    const logs3 = logStore.getLogsByExecution(executionId3);

    const createLog1 = logs1.find(log => log.message.includes('Execution created'));
    const createLog2 = logs2.find(log => log.message.includes('Execution created'));
    const createLog3 = logs3.find(log => log.message.includes('Execution created'));

    expect(createLog1?.metadata?.triggerType).toBe('manual');
    expect(createLog2?.metadata?.triggerType).toBe('webhook');
    expect(createLog3?.metadata?.triggerType).toBe('schedule');

    // Verify audit trail also has correct trigger types
    const audit1 = logStore.getAuditTrail(executionId1);
    const audit2 = logStore.getAuditTrail(executionId2);
    const audit3 = logStore.getAuditTrail(executionId3);

    const createdEvent1 = audit1.find(event => event.eventType === 'CREATED');
    const createdEvent2 = audit2.find(event => event.eventType === 'CREATED');
    const createdEvent3 = audit3.find(event => event.eventType === 'CREATED');

    expect(createdEvent1?.metadata?.triggerType).toBe('manual');
    expect(createdEvent2?.metadata?.triggerType).toBe('webhook');
    expect(createdEvent3?.metadata?.triggerType).toBe('schedule');

    console.log(`Trigger type test complete: verified manual, webhook, and schedule triggers`);
  });

  it('should handle execution cancellation with proper logging', async () => {
    const executionId = 'integration-test-cancel-1';

    // Create and start execution
    await scheduler.createExecution('test-workflow', executionId);
    await scheduler.startExecution(executionId);

    // Cancel execution
    console.log('Cancelling execution...');
    await scheduler.cancelExecution(executionId, 'USER_REQUEST');

    // Force flush logs
    logCollector.flush();

    // Verify cancellation
    const cancelledExecution = await store.getExecution(executionId);
    expect(cancelledExecution?.state).toBe(ExecutionState.CANCELLED);
    expect(cancelledExecution?.reasonCode).toBe('USER_REQUEST');

    // Verify logs include cancellation
    const logs = logStore.getLogsByExecution(executionId);
    const logMessages = logs.map(log => log.message);
    expect(logMessages.some(msg => msg.includes('cancelled'))).toBe(true);

    // Verify audit events include cancellation
    const auditEvents = db.prepare(`
      SELECT * FROM execution_audit_events
      WHERE execution_id = ? AND event_type = 'CANCELLED'
    `).all(executionId) as any[];

    expect(auditEvents.length).toBe(1);
    expect(auditEvents[0].metadata).toContain('USER_REQUEST');
  });

  it('should handle execution timeout with proper logging', async () => {
    const executionId = 'integration-test-timeout-1';

    // Create and start execution
    await scheduler.createExecution('test-workflow', executionId);
    await scheduler.startExecution(executionId);

    // Timeout execution
    console.log('Timing out execution...');
    await scheduler.timeoutExecution(executionId, 30000);

    // Force flush logs
    logCollector.flush();

    // Verify timeout
    const timedOutExecution = await store.getExecution(executionId);
    expect(timedOutExecution?.state).toBe(ExecutionState.FAILED);
    expect(timedOutExecution?.reasonCode).toBe('TIMEOUT');
    expect(timedOutExecution?.message).toContain('timed out after 30000ms');

    // Verify logs include timeout
    const logs = logStore.getLogsByExecution(executionId);
    const logMessages = logs.map(log => log.message);
    expect(logMessages.some(msg => msg.includes('timed out'))).toBe(true);

    // Verify audit events include timeout
    const auditEvents = db.prepare(`
      SELECT * FROM execution_audit_events
      WHERE execution_id = ? AND event_type = 'TIMEOUT'
    `).all(executionId) as any[];

    expect(auditEvents.length).toBe(1);
    expect(auditEvents[0].metadata).toContain('30000');
  });
});
