import { PluginManifest, ActionDef } from '@autokestra/plugin-sdk'
import { LogCollector } from '@autokestra/engine/src/execution/logging';
import * as path from 'node:path'

export interface PluginRuntime {
  execute(plugin: PluginInfo, input: unknown, timeoutMs?: number, logContext?: LogContext): Promise<unknown>
}

export interface PluginInfo {
  name: string
  path: string
  manifest: PluginManifest
}

export interface LogContext {
  logCollector?: LogCollector;
  executionId: string;
  taskId: string;
}

export class ProcessRuntime implements PluginRuntime {
  async execute(plugin: PluginInfo, input: unknown, timeoutMs = 30000, logContext?: LogContext): Promise<unknown> {
    const action = plugin.manifest.actions[0] // Assume first action for now
    const pluginDir = path.resolve(plugin.path)
    const entryPoint = path.join(pluginDir, 'index.ts') // Assume index.ts

    const proc = Bun.spawn(['bun', 'run', entryPoint], {
      cwd: pluginDir,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env }
    })

    const inputJson = JSON.stringify({ action: action.name, input })
    proc.stdin.write(inputJson)
    proc.stdin.end()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill()
        reject(new Error('Plugin execution timed out'))
      }, timeoutMs)
    })

    const executionPromise = Promise.all([
      new Response(proc.stdout).text(),
      this.processStderr(proc.stderr, logContext),
      proc.exited
    ]).then(async ([output, _, exitCode]) => {
      if (exitCode !== 0) {
        throw new Error(`Plugin execution failed`)
      }
      try {
        return JSON.parse(output.trim())
      } catch (err) {
        throw new Error(`Invalid plugin output: ${output}`)
      }
    })

    return Promise.race([executionPromise, timeoutPromise])
  }

  private async processStderr(stderr: ReadableStream, logContext?: LogContext): Promise<void> {
    if (!logContext?.logCollector) {
      // Drain stderr but don't log
      await new Response(stderr).text();
      return;
    }

    const reader = stderr.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let totalBytes = 0;
    let truncated = false;
    let warned = false;
    const maxBytes = 10 * 1024 * 1024; // 10MB per task

    const emitTruncationWarning = () => {
      if (warned) return;
      warned = true;
      logContext.logCollector?.log({
        executionId: logContext.executionId,
        taskId: logContext.taskId,
        timestamp: Date.now(),
        level: 'WARN',
        source: `plugin:${logContext.executionId}/${logContext.taskId}`,
        message: 'Plugin log output exceeded 10MB; further output truncated',
        metadata: { truncated: true },
      });
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            if (truncated) {
              continue;
            }
            const lineBytes = encoder.encode(line).byteLength;
            totalBytes += lineBytes;
            if (totalBytes > maxBytes) {
              truncated = true;
              emitTruncationWarning();
              continue;
            }
            this.parseAndLog(line.trim(), logContext);
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        if (!truncated) {
          const lineBytes = encoder.encode(buffer).byteLength;
          totalBytes += lineBytes;
          if (totalBytes > maxBytes) {
            truncated = true;
            emitTruncationWarning();
          } else {
            this.parseAndLog(buffer.trim(), logContext);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseAndLog(line: string, logContext: LogContext): void {
    const MAX_LINE_LENGTH = 10000; // 10KB limit per log line
    let processedLine = line;
    let truncated = false;

    if (line.length > MAX_LINE_LENGTH) {
      processedLine = line.substring(0, MAX_LINE_LENGTH) + '...[TRUNCATED]';
      truncated = true;
    }

    try {
      // Try to parse as structured log (JSON)
      const logData = JSON.parse(processedLine);
      if (logData.level && logData.message) {
        logContext.logCollector!.log({
          executionId: logContext.executionId,
          taskId: logContext.taskId,
          timestamp: logData.timestamp || Date.now(),
          level: logData.level.toUpperCase(),
          source: `plugin:${logContext.executionId}/${logContext.taskId}`,
          message: logData.message,
          metadata: { ...logData.metadata, ...(truncated && { truncated: true }) },
        });
        return;
      }
    } catch {
      // Not JSON, treat as plain text log
    }

    // Plain text log - assume INFO level
    logContext.logCollector!.log({
      executionId: logContext.executionId,
      taskId: logContext.taskId,
      timestamp: Date.now(),
      level: 'INFO',
      source: `plugin:${logContext.executionId}/${logContext.taskId}`,
      message: processedLine,
      metadata: truncated ? { truncated: true } : undefined,
    });
  }
}

export class DockerRuntime implements PluginRuntime {
  async execute(plugin: PluginInfo, input: unknown, timeoutMs = 30000, logContext?: LogContext): Promise<unknown> {
    const action = plugin.manifest.actions[0] // Assume first action
    const imageName = `${plugin.name}:latest` // Assume built image

    const dockerArgs = [
      'run',
      '--rm',
      '--network=none',
      '-i', // interactive
      imageName
    ]

    const proc = Bun.spawn(['docker', ...dockerArgs], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    })

    const inputJson = JSON.stringify({ action: action.name, input })
    proc.stdin.write(inputJson)
    proc.stdin.end()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill()
        reject(new Error('Docker execution timed out'))
      }, timeoutMs)
    })

    const executionPromise = Promise.all([
      new Response(proc.stdout).text(),
      this.processStderr(proc.stderr, logContext),
      proc.exited
    ]).then(async ([output, _, exitCode]) => {
      if (exitCode !== 0) {
        throw new Error(`Docker execution failed`)
      }
      try {
        return JSON.parse(output.trim())
      } catch (err) {
        throw new Error(`Invalid plugin output: ${output}`)
      }
    })

    return Promise.race([executionPromise, timeoutPromise])
  }

  private async processStderr(stderr: ReadableStream, logContext?: LogContext): Promise<void> {
    if (!logContext?.logCollector) {
      // Drain stderr but don't log
      await new Response(stderr).text();
      return;
    }

    const reader = stderr.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let totalBytes = 0;
    let truncated = false;
    let warned = false;
    const maxBytes = 10 * 1024 * 1024; // 10MB per task

    const emitTruncationWarning = () => {
      if (warned) return;
      warned = true;
      logContext.logCollector?.log({
        executionId: logContext.executionId,
        taskId: logContext.taskId,
        timestamp: Date.now(),
        level: 'WARN',
        source: `plugin:${logContext.executionId}/${logContext.taskId}`,
        message: 'Plugin log output exceeded 10MB; further output truncated',
        metadata: { truncated: true },
      });
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            if (truncated) {
              continue;
            }
            const lineBytes = encoder.encode(line).byteLength;
            totalBytes += lineBytes;
            if (totalBytes > maxBytes) {
              truncated = true;
              emitTruncationWarning();
              continue;
            }
            this.parseAndLog(line.trim(), logContext);
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        if (!truncated) {
          const lineBytes = encoder.encode(buffer).byteLength;
          totalBytes += lineBytes;
          if (totalBytes > maxBytes) {
            truncated = true;
            emitTruncationWarning();
          } else {
            this.parseAndLog(buffer.trim(), logContext);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseAndLog(line: string, logContext: LogContext): void {
    try {
      // Try to parse as structured log (JSON)
      const logData = JSON.parse(line);
      if (logData.level && logData.message) {
        logContext.logCollector!.log({
          executionId: logContext.executionId,
          taskId: logContext.taskId,
          timestamp: logData.timestamp || Date.now(),
          level: logData.level.toUpperCase(),
          source: `plugin:${logContext.executionId}/${logContext.taskId}`,
          message: logData.message,
          metadata: logData.metadata,
        });
        return;
      }
    } catch {
      // Not JSON, treat as plain text log
    }

    // Plain text log - assume INFO level
    logContext.logCollector!.log({
      executionId: logContext.executionId,
      taskId: logContext.taskId,
      timestamp: Date.now(),
      level: 'INFO',
      source: `plugin:${logContext.executionId}/${logContext.taskId}`,
      message: line,
    });
  }
}