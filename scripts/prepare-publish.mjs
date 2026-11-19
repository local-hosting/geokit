#!/usr/bin/env node
/** npm prepublish: dist build, exports, strip link deps, pack check. */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (name) => join(root, 'scripts', name);

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('node', [rel('build-publish-dist.mjs')]);
run('yarn', ['normalize:exports']);
run('yarn', ['validate:exports']);
run('node', [rel('prepare-publish-package-json.mjs')]);
run('node', [rel('check-publish-pack.mjs')]);

console.log('[prepare:publish] ok');