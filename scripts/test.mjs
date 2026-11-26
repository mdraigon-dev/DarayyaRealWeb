// Bundles the TypeScript tests with esbuild (already installed with Astro)
// and runs them with Node's built-in test runner. Usage: npm test
import { build } from 'esbuild';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Inside node_modules so the bundle resolves the project's packages.
const out = join('node_modules', '.cache', 'darayya-tests');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const entries = readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => join('tests', f));
await build({ entryPoints: entries, outdir: out, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, packages: 'external', logLevel: 'warning' });
const files = readdirSync(out).map((f) => join(out, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
