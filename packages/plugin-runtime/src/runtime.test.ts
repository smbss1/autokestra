import { describe, test, expect } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ProcessRuntime, DockerRuntime } from './runtime'

describe('ProcessRuntime', () => {
  test('can execute a plugin as an OS process and capture stderr logs', async () => {
    const runtime = new ProcessRuntime()
    const dir = mkdtempSync(join(tmpdir(), 'autokestra-plugin-'))

    try {
      const pluginEntry = join(dir, 'index.ts')
      writeFileSync(
        pluginEntry,
        `const readStdin = async (): Promise<string> => {
  return await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
};

const main = async () => {
  const raw = (await readStdin()).trim();
  const payload = raw ? JSON.parse(raw) : {};
  console.error(JSON.stringify({ level: 'info', message: 'plugin started', metadata: { action: payload.action } }));
  process.stdout.write(JSON.stringify({ ok: true, echo: payload.input }));
};

main().catch((err) => {
  console.error(JSON.stringify({ level: 'error', message: String(err?.message || err) }));
  process.exit(1);
});
`
      )

      const captured: any[] = []
      const result = await runtime.execute(
        {
          name: 'test-plugin',
          path: dir,
          manifest: {
            name: 'test-plugin',
            version: '0.0.0',
            namespace: 'test',
            actions: [
              {
                name: 'echo',
                description: 'echo',
                input: {},
                output: {},
              },
            ],
          } as any,
        },
        { hello: 'world' },
        10_000,
        {
          executionId: 'exec1',
          taskId: 'task1',
          logCollector: {
            log: (entry: any) => captured.push(entry),
          } as any,
        }
      )

      expect(result).toEqual({ ok: true, echo: { hello: 'world' } })
      expect(captured.length).toBeGreaterThan(0)
      expect(captured.some((e) => String(e.message).includes('plugin started'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('DockerRuntime', () => {
  test('constructs without requiring Docker in CI', async () => {
    const runtime = new DockerRuntime()
    expect(runtime).toBeInstanceOf(DockerRuntime)
  })
})