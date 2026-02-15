import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export type RegistrySourceType = 'official' | 'github' | 'url';

type ResolvedSource = {
  sourceType: RegistrySourceType;
  sourceRef: string;
  url: string;
  expectedChecksum: string;
};

type PluginVersionRecord = {
  version: string;
  checksum: string;
  sourceType: RegistrySourceType;
  sourceRef: string;
  url: string;
  installedAt: string;
  storePath: string;
};

type PluginRecord = {
  namespace: string;
  name: string;
  activeVersion?: string;
  versions: PluginVersionRecord[];
};

type InstallState = {
  plugins: Record<string, PluginRecord>;
};

export type InstallOptions = {
  checksum?: string;
  registryUrl?: string;
};

export type RemoveOptions = {
  noRollback?: boolean;
};

const CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/i;

function pluginKey(namespace: string, name: string): string {
  return `${namespace}/${name}`;
}

function parseChecksum(value: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (!CHECKSUM_PATTERN.test(normalized)) {
    throw new Error('Checksum must use format sha256:<64-hex>');
  }
  return normalized;
}

function sha256(buffer: Uint8Array): string {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return await fs.readFile(filePath, 'utf8');
}

async function runTarExtract(archivePath: string, targetDir: string): Promise<void> {
  const proc = Bun.spawn(['tar', '-xzf', archivePath, '-C', targetDir], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });

  const [stderr, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (code !== 0) {
    throw new Error(stderr.trim() || `Failed to extract archive: ${archivePath}`);
  }
}

async function findManifestDirectory(rootDir: string): Promise<string | null> {
  const queue: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const manifestPath = path.join(current.dir, 'plugin.yaml');
    if (await pathExists(manifestPath)) {
      return current.dir;
    }

    if (current.depth >= 4) {
      continue;
    }

    const entries = await fs.readdir(current.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
      }
    }
  }

  return null;
}

function parseOfficialRef(reference: string): { namespace: string; name: string; version: string } | null {
  const match = reference.match(/^([a-z0-9-]+)\/([a-z0-9-]+)@(\d+\.\d+\.\d+)$/i);
  if (!match) return null;
  return {
    namespace: match[1],
    name: match[2],
    version: match[3],
  };
}

function parseGithubRef(reference: string): { owner: string; repo: string; tag: string } | null {
  const match = reference.match(/^github:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)@([a-zA-Z0-9._-]+)$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    tag: match[3],
  };
}

function isImmutableTag(tag: string): boolean {
  return /^v?\d+\.\d+\.\d+$/.test(tag);
}

function parseChecksumText(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (CHECKSUM_PATTERN.test(trimmed)) return trimmed;

  const match = trimmed.match(/^([a-f0-9]{64})(?:\s+.+)?$/);
  if (!match) {
    throw new Error('Checksum document must contain sha256 digest');
  }
  return `sha256:${match[1]}`;
}

async function fetchChecksumDocument(url: string): Promise<string> {
  if (url.startsWith('file://')) {
    const filePath = fileURLToPath(url);
    const content = await fs.readFile(filePath, 'utf8');
    return parseChecksumText(content);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to retrieve checksum metadata from ${url} (${response.status})`);
  }
  return parseChecksumText(await response.text());
}

async function readSourceBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('file://')) {
    const filePath = fileURLToPath(url);
    return new Uint8Array(await fs.readFile(filePath));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download artifact from ${url} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export class PluginRegistryManager {
  private readonly basePath: string;
  private readonly stateDir: string;
  private readonly cacheDir: string;
  private readonly storeDir: string;
  private readonly stagingDir: string;
  private readonly stateFile: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
    this.stateDir = path.join(this.basePath, '.autokestra-registry');
    this.cacheDir = path.join(this.stateDir, 'cache');
    this.storeDir = path.join(this.stateDir, 'store');
    this.stagingDir = path.join(this.stateDir, 'staging');
    this.stateFile = path.join(this.stateDir, 'installed.json');
  }

  private async ensureLayout(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.storeDir, { recursive: true });
    await fs.mkdir(this.stagingDir, { recursive: true });
  }

  private async readState(): Promise<InstallState> {
    const raw = await readFileIfExists(this.stateFile);
    if (!raw) {
      return { plugins: {} };
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.plugins !== 'object') {
        return { plugins: {} };
      }
      return parsed as InstallState;
    } catch {
      return { plugins: {} };
    }
  }

  private async writeState(state: InstallState): Promise<void> {
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }

  private async resolveSource(reference: string, options: InstallOptions): Promise<ResolvedSource> {
    if (reference.startsWith('url:')) {
      const url = reference.slice('url:'.length).trim();
      if (!url) {
        throw new Error('Direct URL source requires a non-empty URL');
      }
      if (!options.checksum) {
        throw new Error('Direct URL source requires --checksum sha256:<hex>');
      }
      return { sourceType: 'url', sourceRef: reference, url, expectedChecksum: parseChecksum(options.checksum) };
    }

    const github = parseGithubRef(reference);
    if (github) {
      if (!isImmutableTag(github.tag)) {
        throw new Error('GitHub source must use immutable release tag (e.g. v1.2.3)');
      }
      const artifactUrl = `https://github.com/${github.owner}/${github.repo}/releases/download/${github.tag}/${github.repo}-${github.tag}.tgz`;
      const checksum = options.checksum
        ? parseChecksum(options.checksum)
        : await fetchChecksumDocument(`${artifactUrl}.sha256`);
      return { sourceType: 'github', sourceRef: reference, url: artifactUrl, expectedChecksum: checksum };
    }

    const official = parseOfficialRef(reference);
    if (!official) {
      throw new Error('Unsupported source reference. Use namespace/name@version, github:owner/repo@tag, or url:<artifact-url>');
    }

    const registryUrl = String(options.registryUrl || process.env.AUTOKESTRA_PLUGIN_REGISTRY_URL || '').trim();
    if (!registryUrl) {
      throw new Error('Official registry install requires registryUrl or AUTOKESTRA_PLUGIN_REGISTRY_URL');
    }

    const manifestUrl = `${registryUrl.replace(/\/$/, '')}/plugins/${official.namespace}/${official.name}/${official.version}.json`;
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to resolve official registry reference (${response.status})`);
    }

    const payload = (await response.json()) as { url?: string; checksum?: string };
    if (!payload?.url || !payload?.checksum) {
      throw new Error('Official registry descriptor must include url and checksum');
    }

    return {
      sourceType: 'official',
      sourceRef: reference,
      url: payload.url,
      expectedChecksum: parseChecksum(payload.checksum),
    };
  }

  private async activatePlugin(activePath: string, storePath: string): Promise<void> {
    const nextPath = `${activePath}.__next`;
    const backupPath = `${activePath}.__old`;

    await fs.rm(nextPath, { recursive: true, force: true });
    await fs.cp(storePath, nextPath, { recursive: true });

    if (await pathExists(activePath)) {
      await fs.rm(backupPath, { recursive: true, force: true });
      await fs.rename(activePath, backupPath);
    }

    await fs.rename(nextPath, activePath);
    await fs.rm(backupPath, { recursive: true, force: true });
  }

  private pruneToTwoVersions(record: PluginRecord): PluginVersionRecord[] {
    const sorted = [...record.versions].sort((a, b) => Date.parse(b.installedAt) - Date.parse(a.installedAt));
    if (sorted.length <= 2) return sorted;

    const keep: PluginVersionRecord[] = [];
    if (record.activeVersion) {
      const activeRecord = sorted.find((entry) => entry.version === record.activeVersion);
      if (activeRecord) keep.push(activeRecord);
    }

    for (const entry of sorted) {
      if (keep.find((candidate) => candidate.version === entry.version)) continue;
      keep.push(entry);
      if (keep.length >= 2) break;
    }

    return keep;
  }

  async install(reference: string, options: InstallOptions = {}) {
    await this.ensureLayout();

    const resolved = await this.resolveSource(reference, options);
    const expectedChecksum = parseChecksum(resolved.expectedChecksum);
    const digestHex = expectedChecksum.slice('sha256:'.length);
    const cachePath = path.join(this.cacheDir, `${digestHex}.tgz`);

    if (!(await pathExists(cachePath))) {
      const bytes = await readSourceBytes(resolved.url);
      const actualChecksum = sha256(bytes);
      if (actualChecksum !== expectedChecksum) {
        throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
      }
      await fs.writeFile(cachePath, bytes);
    }

    const stagingPath = path.join(this.stagingDir, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const unpackPath = path.join(stagingPath, 'unpacked');
    await fs.mkdir(unpackPath, { recursive: true });
    const stageArchivePath = path.join(stagingPath, 'artifact.tgz');
    await fs.copyFile(cachePath, stageArchivePath);

    await runTarExtract(stageArchivePath, unpackPath);

    const pluginRoot = await findManifestDirectory(unpackPath);
    if (!pluginRoot) {
      throw new Error('Invalid plugin artifact: plugin.yaml not found');
    }

    const manifestModule = await import('../../plugin-runtime/src/manifest');
    const entrypointModule = await import('../../plugin-runtime/src/entrypoint');
    const manifest = manifestModule.loadManifest(pluginRoot) as any;

    if (!manifest.runtime?.entrypoint) {
      throw new Error('runtime.entrypoint is required for registry-distributed artifacts');
    }
    entrypointModule.resolvePluginEntrypoint(pluginRoot, manifest);

    const pluginId = pluginKey(manifest.namespace, manifest.name);
    const storePath = path.join(this.storeDir, `${manifest.namespace}--${manifest.name}`, manifest.version);
    await fs.rm(storePath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.cp(pluginRoot, storePath, { recursive: true });

    const state = await this.readState();
    const record = state.plugins[pluginId] ?? { namespace: manifest.namespace, name: manifest.name, versions: [] };

    const previousActive = record.activeVersion;
    const nextVersionRecord: PluginVersionRecord = {
      version: manifest.version,
      checksum: expectedChecksum,
      sourceType: resolved.sourceType,
      sourceRef: resolved.sourceRef,
      url: resolved.url,
      installedAt: new Date().toISOString(),
      storePath,
    };

    record.versions = record.versions.filter((entry) => entry.version !== manifest.version);
    record.versions.unshift(nextVersionRecord);
    record.activeVersion = manifest.version;

    const retained = this.pruneToTwoVersions(record);
    const retainedSet = new Set(retained.map((entry) => entry.version));
    for (const removed of record.versions.filter((entry) => !retainedSet.has(entry.version))) {
      await fs.rm(removed.storePath, { recursive: true, force: true });
    }
    record.versions = retained;

    const activePath = path.join(this.basePath, manifest.name);
    await this.activatePlugin(activePath, storePath);

    state.plugins[pluginId] = record;
    await this.writeState(state);
    await fs.rm(stagingPath, { recursive: true, force: true });

    return {
      plugin: pluginId,
      version: manifest.version,
      sourceType: resolved.sourceType,
      checksum: expectedChecksum,
      activePath,
      ...(previousActive && previousActive !== manifest.version ? { rolledFrom: previousActive } : {}),
    };
  }

  async list() {
    await this.ensureLayout();
    const state = await this.readState();

    return Object.values(state.plugins)
      .map((record) => {
        const previous = record.versions
          .filter((entry) => entry.version !== record.activeVersion)
          .sort((a, b) => Date.parse(b.installedAt) - Date.parse(a.installedAt))[0];

        return {
          plugin: pluginKey(record.namespace, record.name),
          namespace: record.namespace,
          name: record.name,
          activeVersion: record.activeVersion,
          previousVersion: previous?.version,
          versions: [...record.versions].sort((a, b) => Date.parse(b.installedAt) - Date.parse(a.installedAt)),
        };
      })
      .sort((a, b) => a.plugin.localeCompare(b.plugin));
  }

  async remove(target: string, options: RemoveOptions = {}) {
    await this.ensureLayout();
    const state = await this.readState();

    const [pluginRef, explicitVersion] = String(target).split('@');
    let recordKey = pluginRef.trim();

    if (!recordKey.includes('/')) {
      const candidates = Object.entries(state.plugins).filter(([, value]) => value.name === recordKey);
      if (candidates.length === 0) throw new Error(`Plugin '${recordKey}' not found`);
      if (candidates.length > 1) throw new Error(`Plugin name '${recordKey}' is ambiguous; use namespace/name`);
      recordKey = candidates[0][0];
    }

    const record = state.plugins[recordKey];
    if (!record) throw new Error(`Plugin '${recordKey}' not found`);

    const targetVersion = (explicitVersion || record.activeVersion || '').trim();
    if (!targetVersion) throw new Error(`No removable version found for plugin '${recordKey}'`);

    const existing = record.versions.find((entry) => entry.version === targetVersion);
    if (!existing) throw new Error(`Version '${targetVersion}' not found for plugin '${recordKey}'`);

    const wasActive = record.activeVersion === targetVersion;
    record.versions = record.versions.filter((entry) => entry.version !== targetVersion);
    await fs.rm(existing.storePath, { recursive: true, force: true });

    let rolledBackTo: string | undefined;
    if (wasActive) {
      const activePath = path.join(this.basePath, record.name);
      const previous = record.versions
        .sort((a, b) => Date.parse(b.installedAt) - Date.parse(a.installedAt))[0];

      if (!options.noRollback && previous) {
        await this.activatePlugin(activePath, previous.storePath);
        record.activeVersion = previous.version;
        rolledBackTo = previous.version;
      } else {
        await fs.rm(activePath, { recursive: true, force: true });
        record.activeVersion = undefined;
      }
    }

    if (record.versions.length === 0) {
      delete state.plugins[recordKey];
    } else {
      if (!record.activeVersion) {
        record.activeVersion = record.versions[0]?.version;
      }
      state.plugins[recordKey] = record;
    }

    await this.writeState(state);

    return {
      plugin: recordKey,
      removedVersion: targetVersion,
      activeVersion: record.activeVersion,
      ...(rolledBackTo ? { rolledBackTo } : {}),
    };
  }
}
