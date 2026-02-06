import { describe, it, expect } from 'bun:test';
import { spawn } from 'child_process';
import { join } from 'path';

const CLI_PATH = join(process.cwd(), 'packages', 'cli', 'src', 'cli.ts');

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('bun', [CLI_PATH, ...args], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
  });
}

describe('CLI', () => {
  it('should show help with --help', async () => {
    const result = await runCli(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Autokestra workflow engine CLI');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('server');
    expect(result.stdout).toContain('workflow');
  });

  it('should show version with --version', async () => {
    const result = await runCli(['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('0.0.1');
  });

  it('should list workflows in human format', async () => {
    const result = await runCli(['workflow', 'list']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('No workflows found');
  });

  it('should list workflows in JSON format', async () => {
    const result = await runCli(['workflow', 'list', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ workflows: [] });
  });

  it('should list executions in JSON format', async () => {
    const result = await runCli(['execution', 'list', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ executions: [] });
  });

  it('should list plugins in JSON format', async () => {
    const result = await runCli(['plugin', 'list', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ plugins: [] });
  });

  it('should exit with error for unimplemented commands', async () => {
    const result = await runCli(['server', 'start']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('not yet implemented');
  });

  it('should show server command help', async () => {
    const result = await runCli(['server', '--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('manage server lifecycle');
    expect(result.stdout).toContain('start');
    expect(result.stdout).toContain('stop');
    expect(result.stdout).toContain('status');
  });
});