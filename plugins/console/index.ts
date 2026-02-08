import { defineAction, type PluginContext, type Logger } from '@autokestra/plugin-sdk';

type Invocation = { action: string; input: any };

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function toLevel(levelRaw: unknown): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' {
  const v = typeof levelRaw === 'string' ? levelRaw.trim().toUpperCase() : '';
  if (v === 'DEBUG' || v === 'INFO' || v === 'WARN' || v === 'ERROR') return v;
  return 'INFO';
}

function createRuntimeLogger(): Logger {
  const emit = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: any) => {
    const payload = { timestamp: Date.now(), level, message, ...(metadata ? { metadata } : {}) };
    // stderr is reserved for logs; ProcessRuntime parses JSON lines.
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(payload));
  };

  return {
    info: (message: string, ...args: any[]) => emit('INFO', [message, ...args].join(' ')),
    warn: (message: string, ...args: any[]) => emit('WARN', [message, ...args].join(' ')),
    error: (message: string, ...args: any[]) => emit('ERROR', [message, ...args].join(' ')),
    debug: (message: string, ...args: any[]) => emit('DEBUG', [message, ...args].join(' ')),
  };
}

const logAction = defineAction<{ message: string; level?: string }, { message: string; level: string }>({
  async execute(input, context) {
    const level = toLevel(input?.level);
    const message = typeof input?.message === 'string' ? input.message : String(input?.message ?? '');

    // Emit at requested level via SDK logger.
    if (level === 'ERROR') context.log.error(message);
    else if (level === 'WARN') context.log.warn(message);
    else if (level === 'DEBUG') context.log.debug(message);
    else context.log.info(message);

    return { message, level };
  },
});

async function main() {
  const raw = await readStdin();
  const parsed = JSON.parse(raw) as Invocation;

  if (parsed.action !== 'log') {
    throw new Error(`Unknown action '${parsed.action}'`);
  }

  const context: PluginContext = { log: createRuntimeLogger() };
  const result = await logAction.execute(parsed.input, context);
  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  // stderr for error details
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
