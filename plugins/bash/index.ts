import { defineAction, definePlugin, runPluginProcess } from '@autokestra/plugin-sdk';
import { array, check, literal, minLength, minValue, number, object, optional, pipe, record, string, union } from 'valibot';
import { executeExec } from './core';

const execInputSchema = pipe(
  object({
    command: optional(string()),
    script: optional(string()),
    shell: optional(union([literal('bash'), literal('sh')])),
    args: optional(array(string())),
    env: optional(record(string(), string())),
    cwd: optional(pipe(string(), minLength(1))),
    workspacePath: optional(pipe(string(), minLength(1))),
    timeoutMs: optional(pipe(number(), minValue(1))),
  }),
  check((value) => {
    const hasCommand = typeof value.command === 'string' && value.command.trim().length > 0;
    const hasScript = typeof value.script === 'string' && value.script.trim().length > 0;
    return hasCommand !== hasScript;
  }, "Exactly one of 'command' or 'script' must be provided")
);

const execAction = defineAction({
  inputSchema: execInputSchema,
  async execute(input, context) {
    const result = await executeExec(input, {
      log: context.log,
    });

    if (!result.success) {
      context.log.error('command failed', {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        command: result.command.value,
        shell: result.shell,
      });

      throw new Error(
        JSON.stringify({
          code: result.timedOut ? 'TIMEOUT' : 'EXECUTION_ERROR',
          message: result.timedOut ? 'Shell command timed out' : 'Shell command exited with non-zero status',
          details: {
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            command: result.command.value,
            shell: result.shell,
          },
        })
      );
    }

    return result;
  },
});

const plugin = definePlugin({
  metadata: {
    namespace: 'core',
    name: 'bash',
    version: '0.1.0',
    description: 'Execute shell commands and inline scripts using bash or sh in trusted mode',
  },
  actions: {
    exec: execAction,
  },
});

if (import.meta.main) {
  runPluginProcess(plugin).catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
