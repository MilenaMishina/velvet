#!/usr/bin/env node
/**
 * Deployment entry point.
 *
 * Written to be self-sufficient because the hosting platform does not document
 * whether it installs dependencies or runs a build: it checks, does only the work
 * that is actually missing, and then serves. Run it locally (`npm start`) and it is
 * a no-op check followed by `next start`; run it on a fresh container and it seeds
 * the catalogue, installs, builds and serves.
 *
 * The two things that bite Node workloads on this platform, both handled here:
 * binding to loopback instead of 0.0.0.0 (the router then can't reach the process),
 * and hard-coding a port instead of using the one the platform assigns.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

function fail(message) {
  console.error(`[boot] ${message}`);
  process.exit(1);
}

function run(label, command, args) {
  console.log(`[boot] ${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}`);
}

// 1. Seed the catalogue on a fresh volume.
//    The live database is git-ignored (it changes on every sync), so a committed
//    snapshot ships instead and is copied into place only when there is nothing
//    there yet — an existing database on the volume is never overwritten.
const dataDir = path.join(root, 'data');
const dbFile = path.join(dataDir, 'tube.db');
const seedFile = path.join(root, 'seed', 'tube.db');
if (!existsSync(dbFile)) {
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(seedFile)) {
    copyFileSync(seedFile, dbFile);
    console.log(`[boot] seeded catalogue from seed/tube.db (${statSync(dbFile).size} bytes)`);
  } else {
    console.warn('[boot] no seed/tube.db — starting with an empty catalogue; run a sync from /admin');
  }
}

// 2. Dependencies. `--include=dev` because the build needs TypeScript and Tailwind,
//    and a platform-provided NODE_ENV=production would otherwise skip them.
if (!existsSync(nextBin)) {
  run('installing dependencies', 'npm', ['ci', '--include=dev']);
}

// 3. Build, if this copy has never been built.
if (!existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  run('building', process.execPath, [nextBin, 'build']);
}

// 4. Serve. Prefer the platform's assigned port, then PORT, then the Next default.
const rawPort = process.env.SERVER_PORT || process.env.PORT || '3000';
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`Invalid listening port: ${rawPort}`);
const host = process.env.HOST || '0.0.0.0';

console.log(`[boot] serving on ${host}:${port} (NODE_ENV=${process.env.NODE_ENV ?? 'unset'})`);
const server = spawn(process.execPath, [nextBin, 'start', '-H', host, '-p', String(port)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

// Forward termination so the platform's stop is a clean shutdown, not a kill.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[boot] received ${signal}, shutting down`);
    server.kill(signal);
  });
}

server.on('exit', (code, signal) => {
  console.log(`[boot] server exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
  process.exit(code ?? 0);
});
