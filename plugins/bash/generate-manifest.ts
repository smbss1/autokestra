import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { pluginToManifest } from '@autokestra/plugin-sdk';
import { plugin } from './index';

const outputPath = join(import.meta.dir, 'plugin.yaml');
const manifest = pluginToManifest(plugin);
const yaml = stringify(manifest, {
  indent: 2,
  lineWidth: 0,
});

writeFileSync(outputPath, yaml, 'utf8');
process.stdout.write(`Generated ${outputPath}\n`);
