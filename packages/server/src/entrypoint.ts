import { loadConfigFromFile } from '@autokestra/engine/src/configLoader';

import { startManagedServer } from './server';

function getArgValue(args: string[], names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (names.includes(a)) {
      const next = args[i + 1];
      if (next && !next.startsWith('-')) return next;
    }
    for (const name of names) {
      if (a.startsWith(name + '=')) return a.slice(name.length + 1);
    }
  }
  return undefined;
}

function hasFlag(args: string[], names: string[]): boolean {
  return args.some((a) => names.includes(a));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const configPath =
    getArgValue(args, ['-c', '--config']) || process.env.AUTOKESTRA_CONFIG || '/config/config.yaml';

  const silent = hasFlag(args, ['--silent']) || process.env.AUTOKESTRA_SILENT === '1';

  const config = loadConfigFromFile(configPath);

  const managed = await startManagedServer({
    config,
    silent,
    handleSignals: true,
  });

  if (!silent) {
    // eslint-disable-next-line no-console
    console.log('Autokestra server started');
  }

  await managed.waitForShutdown();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
