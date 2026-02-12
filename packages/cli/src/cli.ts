#!/usr/bin/env bun
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import { isIP } from 'node:net';
import * as path from 'node:path';
import { listExecutions, inspectExecution, getExecutionLogs, cleanupExecutions } from './commands/execution';
import { applyWorkflow, deleteWorkflow, getWorkflow, listWorkflows, triggerWorkflow } from './commands/workflow';
import { setSecret, getSecret, listSecrets, deleteSecret } from './commands/secrets';
import { startManagedServer } from '@autokestra/server';
import { loadConfigFromFile } from '@autokestra/engine/src/configLoader';
import { safeParse, pipe, string, minLength, check } from 'valibot';
import type { ApiClientConfig } from './apiClient';

const VERSION = "0.0.1";
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

function configExists(filePath: string): boolean {
  try {
    return fsSync.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveApiConfig(options: any): ApiClientConfig {
  const nonEmptyStringSchema = pipe(
    string(),
    check((value: string) => value.trim().length > 0, 'Value must be a non-empty string'),
  );

  const httpUrlSchema = pipe(
    string(),
    check((value: string) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Server must be a valid http(s) URL (e.g. http://127.0.0.1:7233)'),
  );

  function parseOrThrow<T>(schema: any, value: unknown, label: string): T {
    const result = safeParse(schema, value);
    if (!result.success) {
      const msg = result.issues?.[0]?.message || 'Invalid value';
      throw new Error(`${label}: ${msg}`);
    }
    return result.output as T;
  }

  function normalizeServerHostForClient(rawHost: string | undefined): string {
    const host = (rawHost || '').trim();
    if (!host || host === '0.0.0.0' || host === '::') return '127.0.0.1';
    return host;
  }

  function formatHostForUrl(host: string): string {
    const ipVersion = isIP(host);
    if (ipVersion === 6) {
      return host.startsWith('[') ? host : `[${host}]`;
    }
    return host;
  }

  function normalizeServerInputToBaseUrl(rawValue: string): string {
    const value = rawValue.trim();
    if (!value) return value;

    // If already a URL, keep it.
    if (/^https?:\/\//i.test(value)) return value;

    // Host[:port] only (no path/query) for scheme-less inputs.
    if (/[\/?#]/.test(value)) {
      throw new Error('Invalid server value. Use a full URL (http(s)://...) when including a path/query.');
    }

    // Bracketed IPv6 (with optional port).
    if (value.startsWith('[')) {
      return `http://${value}`;
    }

    // Raw IPv6 without brackets.
    if (isIP(value) === 6) {
      return `http://[${value}]`;
    }

    // Domain/IP (IPv4) with optional port.
    return `http://${value}`;
  }

  const configPathRaw = typeof options.config === 'string' ? options.config : './config.yaml';
  const configPath = parseOrThrow<string>(nonEmptyStringSchema, configPathRaw, 'Invalid --config');
  const config = configExists(configPath) ? loadConfigFromFile(configPath) : undefined;

  const baseUrlFromPublicUrl = (() => {
    const raw = typeof config?.server?.publicUrl === 'string' ? config.server.publicUrl.trim() : '';
    if (!raw) return undefined;
    return normalizeServerInputToBaseUrl(raw);
  })();

  const baseUrlFromConfig = (() => {
    if (!config) return undefined;

    const hostRaw = typeof config.server.host === 'string' ? config.server.host.trim() : '';

    // Support a "public" URL being placed in server.host (common when behind a reverse proxy).
    // If it's already a URL, trust it and don't append config.server.port.
    if (hostRaw && /^https?:\/\//i.test(hostRaw)) {
      return hostRaw;
    }

    const normalizedHost = normalizeServerHostForClient(hostRaw);

    // If config.server.host includes a path/query, it must be a full URL.
    if (/[\/?#]/.test(normalizedHost)) {
      throw new Error('Invalid server.host in config.yaml. Use host[:port] or a full http(s):// URL.');
    }

    // Bracketed IPv6, with optional port.
    const bracketed = /^\[(?<addr>[^\]]+)\](?::(?<port>\d{1,5}))?$/.exec(normalizedHost);
    if (bracketed?.groups?.addr) {
      if (bracketed.groups.port) {
        return `http://${normalizedHost}`;
      }
      return `http://[${bracketed.groups.addr}]:${config.server.port}`;
    }

    // Raw IPv6 without brackets.
    if (isIP(normalizedHost) === 6) {
      return `http://[${normalizedHost}]:${config.server.port}`;
    }

    // If host already includes an explicit port (e.g. example.com:7233), don't append config.server.port.
    const hostPortMatch = /^(?<h>[^:]+):(?<p>\d{1,5})$/.exec(normalizedHost);
    if (hostPortMatch?.groups?.h && hostPortMatch.groups.p) {
      const port = Number.parseInt(hostPortMatch.groups.p, 10);
      if (Number.isFinite(port) && port >= 1 && port <= 65535) {
        return `http://${hostPortMatch.groups.h}:${port}`;
      }
    }

    return `http://${normalizedHost}:${config.server.port}`;
  })();

  const baseUrlCandidateRaw =
    (typeof options.server === 'string' ? options.server : undefined) ||
    process.env.AUTOKESTRA_SERVER_URL ||
    baseUrlFromPublicUrl ||
    baseUrlFromConfig ||
    'http://127.0.0.1:7233';

  const baseUrlCandidate = normalizeServerInputToBaseUrl(baseUrlCandidateRaw);

  const baseUrl = parseOrThrow<string>(httpUrlSchema, baseUrlCandidate, 'Invalid server URL');

  const apiKeyFromConfig =
    config?.server?.apiKeys && Array.isArray(config.server.apiKeys)
      ? config.server.apiKeys.map((k: any) => String(k).trim()).find((k: string) => k.length > 0)
      : undefined;

  const apiKeyCandidate =
    (typeof options.apiKey === 'string' ? options.apiKey : undefined) ||
    process.env.AUTOKESTRA_API_KEY ||
    apiKeyFromConfig;

  if (!apiKeyCandidate) {
    throw new Error('Missing API key. Provide --api-key, set AUTOKESTRA_API_KEY, or set server.apiKeys in config.yaml.');
  }

  const apiKey = parseOrThrow<string>(pipe(string(), minLength(1)), String(apiKeyCandidate), 'Invalid API key');

  return { baseUrl, apiKey };
}

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
      .argument('<file>', 'path to workflow YAML file')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .option('--json', 'output in JSON format')
      .option('--id <id>', 'override workflow id')
      .option('--enable', 'force enable workflow')
      .option('--disable', 'force disable workflow')
      .action(async (file, options) => {
        try {
          const enabled = options.enable ? true : options.disable ? false : undefined;
          await applyWorkflow(
            { api: resolveApiConfig(options) },
            file,
            { json: options.json, enabled, idOverride: options.id },
          );
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error applying workflow:', error instanceof Error ? error.message : error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('delete')
      .description('delete workflow')
      .argument('<id>', 'workflow id')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .option('--json', 'output in JSON format')
      .action(async (id, options) => {
        try {
          const result = await deleteWorkflow({ api: resolveApiConfig(options) }, id, { json: options.json });
          process.exit(result.deleted ? EXIT_SUCCESS : EXIT_NOT_FOUND);
        } catch (error) {
          console.error('Error deleting workflow:', error instanceof Error ? error.message : error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('list workflows')
      .option('--json', 'output in JSON format')
      .option('--enabled', 'show only enabled workflows')
      .option('--disabled', 'show only disabled workflows')
      .option('--limit <number>', 'limit results', '50')
      .option('--offset <number>', 'offset for pagination', '0')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (options) => {
        try {
          const enabled = options.enabled ? true : options.disabled ? false : undefined;
          await listWorkflows(
            { api: resolveApiConfig(options) },
            {
              enabled,
              limit: Number.parseInt(options.limit, 10),
              offset: Number.parseInt(options.offset, 10),
              json: options.json,
            },
          );
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error listing workflows:', error instanceof Error ? error.message : error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('get a workflow')
      .argument('<id>', 'workflow id')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .option('--json', 'output in JSON format')
      .action(async (id, options) => {
        try {
          const result = await getWorkflow({ api: resolveApiConfig(options) }, id, { json: options.json });
          process.exit(result.found ? EXIT_SUCCESS : EXIT_NOT_FOUND);
        } catch (error) {
          console.error('Error getting workflow:', error instanceof Error ? error.message : error);
          process.exit(EXIT_ERROR);
        }
      })
  )
  .addCommand(
    new Command('trigger')
      .description('trigger a workflow execution manually')
      .argument('<id>', 'workflow id')
      .option('--execution-id <id>', 'custom execution id (optional)')
      .option('--follow', 'stream execution logs in real-time after trigger')
      .option('--level <levels>', 'filter logs by level when using --follow (comma-separated)')
      .option('--since <duration>', 'show logs from last N time window when using --follow (e.g., 5m, 2h)')
      .option('--task <taskId>', 'filter logs by task ID when using --follow')
      .option('--json', 'output in JSON format')
      .option('--pretty', 'pretty print JSON output for followed logs (if applicable)')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (id, options) => {
        try {
          if (options.json && options.follow) {
            throw new Error('--json cannot be used with --follow');
          }

          const api = resolveApiConfig(options);
          const result = await triggerWorkflow(
            { api },
            id,
            { json: options.json, executionId: options.executionId },
          );

          if (!result.triggered) {
            process.exit(result.reason === 'not_found' ? EXIT_NOT_FOUND : EXIT_CONFLICT);
          }

          if (options.follow && result.executionId) {
            await getExecutionLogs(
              { api },
              result.executionId,
              {
                level: options.level ? [options.level] : undefined,
                since: options.since,
                taskId: options.task,
                follow: true,
                json: false,
                pretty: options.pretty,
              },
            );
          }

          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error triggering workflow:', error instanceof Error ? error.message : error);
          process.exit(EXIT_ERROR);
        }
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
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (options) => {
        try {
          await listExecutions(
            { api: resolveApiConfig(options) },
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
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (executionId, options) => {
        try {
          await inspectExecution({ api: resolveApiConfig(options) }, executionId, {
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
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (executionId, options) => {
        try {
          await getExecutionLogs({ api: resolveApiConfig(options) }, executionId, {
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
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (options) => {
        try {
          await cleanupExecutions(
            { api: resolveApiConfig(options) },
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
  .command('secrets')
  .description('manage secrets')
  .addCommand(
    new Command('set')
      .description('set a secret value')
      .argument('<name>', 'secret name')
      .argument('[value]', 'secret value (prompt if not provided)')
      .option('--json', 'output in JSON format')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (name, value, options) => {
        try {
          await setSecret({ api: resolveApiConfig(options) }, name, value, { json: options.json });
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
      .option('--json', 'output in JSON format')
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (name, options) => {
        try {
          await getSecret({ api: resolveApiConfig(options) }, name, { json: options.json });
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
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (options) => {
        try {
          await listSecrets({ api: resolveApiConfig(options) }, { json: options.json });
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
      .option('--server <url>', 'server base URL (e.g. http://127.0.0.1:7233)')
      .option('--api-key <key>', 'server API key (Authorization Bearer)')
      .option('-c, --config <path>', 'path to YAML config (optional, for defaults)')
      .action(async (name, options) => {
        try {
          await deleteSecret({ api: resolveApiConfig(options) }, name, { force: options.force });
          process.exit(EXIT_SUCCESS);
        } catch (error) {
          console.error('Error deleting secret:', error);
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

program.parse();