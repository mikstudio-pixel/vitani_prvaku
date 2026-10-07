import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'michas-tests-'));
const testFiles = readdirSync(join(root, 'tests')).filter(name => name.endsWith('.test.ts'));
try {
  const compile = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      ...testFiles.map(name => join('tests', name)),
      '--module',
      'commonjs',
      '--target',
      'ES2022',
      '--types',
      'node',
      '--esModuleInterop',
      '--skipLibCheck',
      '--outDir',
      output,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const tests = spawnSync(
      process.execPath,
      ['--test', ...testFiles.map(name => join(output, 'tests', name.replace(/\.ts$/, '.js')))],
      { stdio: 'inherit' },
    );
    process.exitCode = tests.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
