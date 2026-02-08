#!/usr/bin/env bun
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { listExecutions, inspectExecution, getExecutionLogs, cleanupExecutions } from './commands/execution';
// import { setSecret, getSecret, listSecrets, deleteSecret } from './commands/secrets';
import { startManagedServer } from '@autokestra/server';
import { loadConfigFromFile } from '@autokestra/engine/src/configLoader';

const VERSION = "0.0.1";
const DEFAULT_DB_PATH = './autokestra.db';
const DEFAULT_PID_FILE = path.join(process.cwd(), '.autokestra', 'server.pid');
const DEFAULT_LOG_FILE = path.join(process.cwd(), '.autokestra', 'server.log');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;
const EXIT_CONFIG = 3;
const EXIT_NOT_FOUND = 4;
const EXIT_CONFLICT = 5;

const program = new Command();

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readPidFile(pidFile: string): Promise<number | null> {
  try {
    const raw = await fs.readFile(pidFile, 'utf8');
    const pid = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function writePidFile(pidFile: string, pid: number) {
  await ensureParentDir(pidFile);
  await fs.writeFile(pidFile, `${pid}\n`, 'utf8');
}

async function removePidFile(pidFile: string) {
  try {
    await fs.unlink(pidFile);
  } catch {
    // ignore
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getSelfSpawnCommandArgs(extraArgs: string[]): { command: string; args: string[] } {
  const execPath = process.execPath;
  const maybeScript = process.argv[1];
  const looksLikeScript =
    typeof maybeScript === 'string' &&
    (maybeScript.endsWith('.ts') || maybeScript.endsWith('.js') || maybeScript.includes('/src/cli.'));

  if (looksLikeScript) {
    return { command: execPath, args: [maybeScript, ...extraArgs] };
  }

  return { command: execPath, args: extraArgs };
}

async function sleepMs(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

program
  .name('workflow')
  .description('Autokestra workflow engine CLI')
  .version(VERSION);

// Placeholder commands - to be implemented
program
  .command('server')
  .description('manage server lifecycle')
  .addCommand(
    new Command('start')
      .description('start the workflow server')
      .option('-c, --config <path>', 'path to YAML config', './config.yaml')
      .option('--pid-file <path>', 'path to PID file', DEFAULT_PID_FILE)
      .option('--log-file <path>', 'path to daemon log file (background mode)', DEFAULT_LOG_FILE)
      .option('--foreground', 'run in the foreground (do not daemonize)', false)
      .option('--silent', 'suppress startup logs', false)
      .action(async (options) => {
        try {
          const pidFile = String(options.pidFile || DEFAULT_PID_FILE);
          const existingPid = await readPidFile(pidFile);
          if (existingPid && existingPid !== process.pid && isProcessRunning(existingPid)) {
            console.error(`Server already running (pid ${existingPid}).`);
            process.exit(EXIT_CONFLICT);
          }
          if (existingPid && existingPid !== process.pid && !isProcessRunning(existingPid)) {
            await removePidFile(pidFile);
          }

          if (!options.foreground) {
            // Preflight validation so daemon start fails fast on bad config.
            const preflightConfig: any = loadConfigFromFile(options.config);
            const apiKeys = preflightConfig?.server?.apiKeys;
            if (!Array.isArray(apiKeys) || apiKeys.map((k: any) => String(k).trim()).filter(Boolean).length === 0) {
              throw new Error('Server API keys are required. Set server.apiKeys in your YAML config.');
            }
            const storageType = preflightConfig?.storage?.type;
            if (storageType && storageType !== 'sqlite') {
              throw new Error(`Only sqlite storage is supported by the server right now (got '${storageType}').`);
            }

            const { command, args } = getSelfSpawnCommandArgs([
              'server',
              'start',
              '--foreground',
              '--silent',
              '--config',
              String(options.config),
              '--pid-file',
              pidFile,
            ]);

            const logFile = String(options.logFile || DEFAULT_LOG_FILE);
            await ensureParentDir(logFile);
            const logFd = fsSync.openSync(logFile, 'a');

            const child = spawn(command, args, {
              detached: true,
              stdio: ['ignore', logFd, logFd],
              cwd: process.cwd(),
              env: { ...process.env, AUTOKESTRA_DAEMON_CHILD: '1' },
            });
            try {
              fsSync.closeSync(logFd);
            } catch {
              // ignore
            }
            child.unref();

            const childPid = child.pid;
            if (!childPid || childPid <= 0) {
              throw new Error('Failed to daemonize server (no child PID).');
            }

            await writePidFile(pidFile, childPid);

            // If the child exits immediately, treat it as a failed start.
            await sleepMs(200);
            if (!isProcessRunning(childPid)) {
              await removePidFile(pidFile);
              console.error(`Server failed to start (pid ${childPid} exited). See logs: ${logFile}`);
              process.exit(EXIT_ERROR);
            }

            console.log(`Server started in background (pid ${childPid}). Logs: ${logFile}`);
            process.exit(EXIT_SUCCESS);
          }

          // Foreground mode: start + wait for graceful shutdown.
          const config = loadConfigFromFile(options.config);
          await writePidFile(pidFile, process.pid);

          try {
            const managed = await startManagedServer({
              config,
              silent: Boolean(options.silent),
              handleSignals: true,
            });

            await managed.waitForShutdown();
            process.exit(EXIT_SUCCESS);
          } finally {
            await removePidFile(pidFile);
          }
        } catch (error) {
          console.error('Failed to start server:', error instanceof Error ? error.message : error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('stop')
      .description('stop the workflow server')
      .option('--pid-file <path>', 'path to PID file', DEFAULT_PID_FILE)
      .option('--timeout <ms>', 'timeout before force-kill (ms)', '5000')
      .action(async (options) => {
        const pidFile = String(options.pidFile || DEFAULT_PID_FILE);
        const pid = await readPidFile(pidFile);
        if (!pid) {
          console.error('Server not running (no PID file).');
          process.exit(EXIT_NOT_FOUND);
        }

        if (!isProcessRunning(pid)) {
          await removePidFile(pidFile);
          console.error(`Server not running (stale pid ${pid}).`);
          process.exit(EXIT_NOT_FOUND);
        }

        try {
          process.kill(pid, 'SIGTERM');
        } catch (error) {
          console.error(`Failed to signal server (pid ${pid}):`, error);
          process.exit(EXIT_ERROR);
        }

        const timeoutMs = Math.max(0, Number.parseInt(String(options.timeout), 10) || 5000);
        const start = Date.now();
        while (isProcessRunning(pid) && Date.now() - start < timeoutMs) {
          await sleepMs(100);
        }

        if (isProcessRunning(pid)) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // ignore
          }
        }

        await removePidFile(pidFile);
        console.log('Server stopped.');
        process.exit(EXIT_SUCCESS);
      })
  )
  .addCommand(
    new Command('status')
      .description('show server status')
      .option('--pid-file <path>', 'path to PID file', DEFAULT_PID_FILE)
      .action(async (options) => {
        const pidFile = String(options.pidFile || DEFAULT_PID_FILE);
        const pid = await readPidFile(pidFile);
        if (!pid) {
          console.log('stopped');
          process.exit(EXIT_SUCCESS);
        }

        if (!isProcessRunning(pid)) {
          await removePidFile(pidFile);
          console.log('stopped');
          process.exit(EXIT_SUCCESS);
        }

        console.log(`running (pid ${pid})`);
        process.exit(EXIT_SUCCESS);
      })
  );

program
  .command('workflow')
  .description('manage workflows')
  .addCommand(
    new Command('apply')
      .description('apply workflow definition')
      .action(() => {
        console.error('Workflow apply - not yet implemented');
        process.exit(EXIT_ERROR);
      })
  )
  .addCommand(
    new Command('delete')
      .description('delete workflow')
      .action(() => {
        console.error('Workflow delete - not yet implemented');
        process.exit(EXIT_ERROR);
      })
  )
  .addCommand(
    new Command('list')
      .description('list workflows')
      .option('--json', 'output in JSON format')
      .action((options) => {
        if (options.json) {
          console.log(JSON.stringify({ workflows: [] }, null, 2));
        } else {
          console.log('No workflows found');
        }
        process.exit(EXIT_SUCCESS);
      })
  );

program
  .command('plugin')
  .description('manage plugins')
  .addCommand(
    new Command('build')
      .description('build a plugin Docker image')
      .argument('<name>', 'plugin name')
      .action((name) => {
        console.log(`Building plugin ${name} - not yet implemented`);
        process.exit(EXIT_ERROR);
      })
  )
  .addCommand(
    new Command('list')
      .description('list available plugins')
      .option('--json', 'output in JSON format')
      .action((options) => {
        if (options.json) {
          console.log(JSON.stringify({ plugins: [] }, null, 2));
        } else {
          console.log('No plugins found');
        }
        process.exit(EXIT_SUCCESS);
      })
  )
  .addCommand(
    new Command('inspect')
      .description('inspect a plugin')
      .argument('<name>', 'plugin name')
      .option('--json', 'output in JSON format')
      .action((name, options) => {
        console.log(`Inspecting plugin ${name} - not yet implemented`);
        process.exit(EXIT_ERROR);
      })
  );

program
  .command('execution')
  .description('manage executions')
  .addCommand(
    new Command('list')
      .description('list executions')
      .option('--workflow <id>', 'filter by workflow ID')
      .option('--state <state>', 'filter by state')
      .option('--limit <number>', 'limit results', '20')
      .option('--offset <number>', 'offset for pagination', '0')
      .option('--json', 'output in JSON format')
      .option('--db <path>', 'database path', DEFAULT_DB_PATH)
      .action(async (options) => {
        try {
          await listExecutions(
            { dbPath: options.db },
            {
              workflowId: options.workflow,
              state: options.state,
              limit: parseInt(options.limit),
              offset: parseInt(options.offset),
              json: options.json,
            }
          );
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error listing executions:', error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('inspect')
      .description('inspect an execution')
      .argument('<executionId>', 'execution ID to inspect')
      .option('--show-inputs', 'display task inputs (masked)')
      .option('--timeline', 'display ASCII timeline')
      .option('--audit', 'include audit trail in output')
      .option('--json', 'output in JSON format')
      .option('--pretty', 'pretty print JSON output')
      .option('--no-truncate', 'disable truncation of long values')
      .option('--db <path>', 'database path', DEFAULT_DB_PATH)
      .action(async (executionId, options) => {
        try {
          await inspectExecution({ dbPath: options.db }, executionId, {
            showInputs: options.showInputs,
            timeline: options.timeline,
            audit: options.audit,
            json: options.json,
            pretty: options.pretty,
            noTruncate: options.truncate === false,
          });
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error inspecting execution:', error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('logs')
      .description('get execution logs')
      .argument('<executionId>', 'execution ID')
      .option('--level <levels>', 'filter by log level (DEBUG, INFO, WARN, ERROR; comma-separated)')
      .option('--since <duration>', 'show logs from last N minutes/hours/days (e.g., 5m, 2h, 1d)')
      .option('--task <taskId>', 'filter by task ID')
      .option('--follow', 'stream logs in real-time')
      .option('--json', 'output in JSON format')
      .option('--pretty', 'pretty print JSON output')
      .option('--db <path>', 'database path', DEFAULT_DB_PATH)
      .action(async (executionId, options) => {
        try {
          await getExecutionLogs({ dbPath: options.db }, executionId, {
            level: options.level ? [options.level] : undefined,
            since: options.since,
            taskId: options.task,
            follow: options.follow,
            json: options.json,
            pretty: options.pretty,
          });
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error getting logs:', error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('cleanup')
      .description('clean up old executions')
      .option('--days <number>', 'retention period in days', '30')
      .option<any>('--state <state>', 'execution state to clean up (can be specified multiple times)', (value, previous) => previous.concat([value]), [])
      .option('--dry-run', 'show what would be deleted without actually deleting')
      .option('--json', 'output in JSON format')
      .option('--db <path>', 'database path', DEFAULT_DB_PATH)
      .action(async (options) => {
        try {
          await cleanupExecutions(
            { dbPath: options.db },
            {
              days: parseInt(options.days),
              states: options.state.length > 0 ? options.state : undefined,
              dryRun: options.dryRun,
              json: options.json,
            }
          );
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error cleaning up executions:', error);
          process.exit(EXIT_ERROR);
        }
      })
  );

program
  .command('config')
  .description('manage configuration')
  .addCommand(
    new Command('set')
      .description('set configuration value')
      .action(() => {
        console.error('Config set - not yet implemented');
        process.exit(EXIT_ERROR);
      })
  );

/*
program
  .command('secrets')
  .description('manage secrets')
  .addCommand(
    new Command('set')
      .description('set a secret value')
      .argument('<name>', 'secret name')
      .argument('[value]', 'secret value (prompt if not provided)')
      .action(async (name, value) => {
        try {
          await setSecret(name, value);
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error setting secret:', error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('get a secret value')
      .argument('<name>', 'secret name')
      .action(async (name) => {
        try {
          await getSecret(name);
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error getting secret:', error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('list secrets')
      .option('--json', 'output in JSON format')
      .action(async (options) => {
        try {
          await listSecrets({ json: options.json });
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error listing secrets:', error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('delete')
      .description('delete a secret')
      .argument('<name>', 'secret name')
      .option('--force', 'skip confirmation prompt')
      .action(async (name, options) => {
        try {
          await deleteSecret(name, { force: options.force });
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error deleting secret:', error);
          process.exit(EXIT_ERROR);
        }
      })
  );
*/

program.parse();