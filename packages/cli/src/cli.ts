#!/usr/bin/env bun
import { Command } from 'commander';
import { listExecutions, inspectExecution, getExecutionLogs, cleanupExecutions } from './commands/execution';
import { setSecret, getSecret, listSecrets, deleteSecret } from './commands/secrets';

const VERSION = "0.0.1";
const DEFAULT_DB_PATH = './autokestra.db';

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;
const EXIT_CONFIG = 3;
const EXIT_NOT_FOUND = 4;
const EXIT_CONFLICT = 5;

const program = new Command();

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
      .action(() => {
        console.error('Server start - not yet implemented');
        process.exit(EXIT_ERROR);
      })
  )
  .addCommand(
    new Command('stop')
      .description('stop the workflow server')
      .action(() => {
        console.error('Server stop - not yet implemented');
        process.exit(EXIT_ERROR);
      })
  )
  .addCommand(
    new Command('status')
      .description('show server status')
      .action(() => {
        console.error('Server status - not yet implemented');
        process.exit(EXIT_ERROR);
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
      .option('--json', 'output in JSON format')
      .option('--db <path>', 'database path', DEFAULT_DB_PATH)
      .action(async (executionId, options) => {
        try {
          await inspectExecution({ dbPath: options.db }, executionId, {
            json: options.json,
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
      .option('--json', 'output in JSON format')
      .option('--db <path>', 'database path', DEFAULT_DB_PATH)
      .action(async (executionId, options) => {
        try {
          await getExecutionLogs({ dbPath: options.db }, executionId, {
            json: options.json,
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
  .command('plugin')
  .description('manage plugins')
  .addCommand(
    new Command('list')
      .description('list installed plugins')
      .option('--json', 'output in JSON format')
      .action((options) => {
        if (options.json) {
          console.log(JSON.stringify({ plugins: [] }, null, 2));
        } else {
          console.log('No plugins installed');
        }
        process.exit(EXIT_SUCCESS);
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

program.parse();