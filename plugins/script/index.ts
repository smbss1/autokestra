import { createRuntimeLogger, executeRun, type RunInput } from './core';

async function main() {
  const raw = await Bun.stdin.text();
  const req = JSON.parse(raw) as { action?: string; input?: unknown };

  if (req.action !== 'run') {
    throw new Error(`Unsupported action: ${String(req.action)}`);
  }

  const result = await executeRun(req.input as RunInput, {
    log: createRuntimeLogger('[script.run]'),
  });
  process.stdout.write(JSON.stringify(result));
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
