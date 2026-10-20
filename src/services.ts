import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export type ServiceId = 'apache' | 'mysql' | 'postgres' | 'nginx';
export type ServiceState = 'running' | 'stopped' | 'unknown';
export type Action = 'start' | 'stop' | 'restart';
export type Status = Record<ServiceId, ServiceState>;

export const SERVICE_IDS: ServiceId[] = ['apache', 'mysql', 'postgres', 'nginx'];

export const SERVICE_LABEL: Record<ServiceId, string> = {
  apache: 'Apache',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  nginx: 'Nginx',
};

export const ACTION_LABEL: Record<Action, string> = {
  start: 'started',
  stop: 'stopped',
  restart: 'restarted',
};

const IMAGE: Record<ServiceId, string> = {
  apache: 'httpd.exe',
  mysql: 'mysqld.exe',
  postgres: 'postgres.exe',
  nginx: 'nginx.exe',
};

interface Launch {
  exe: string;
  cwd: string;
  args: string[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function firstDirWith(base: string, marker: string): string | null {
  let entries: string[];
  try {
    entries = fs.readdirSync(base);
  } catch {
    return null;
  }
  for (const name of entries) {
    const dir = path.join(base, name);
    try {
      if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, marker))) {
        return dir;
      }
    } catch {
      // unreadable entry, skip
    }
  }
  return null;
}

export function launchFor(root: string, id: ServiceId): Launch | null {
  if (id === 'apache') {
    const dir = firstDirWith(path.join(root, 'bin', 'apache'), path.join('bin', 'httpd.exe'));
    return dir ? { exe: path.join(dir, 'bin', 'httpd.exe'), cwd: dir, args: [] } : null;
  }
  if (id === 'nginx') {
    const dir = firstDirWith(path.join(root, 'bin', 'nginx'), 'nginx.exe');
    return dir ? { exe: path.join(dir, 'nginx.exe'), cwd: dir, args: [] } : null;
  }
  if (id === 'postgres') {
    const dir = postgresHome(root);
    return dir ? { exe: path.join(dir, 'bin', 'pg_ctl.exe'), cwd: dir, args: [] } : null;
  }
  const dir = firstDirWith(path.join(root, 'bin', 'mysql'), path.join('bin', 'mysqld.exe'));
  if (!dir) {
    return null;
  }
  const ini = path.join(dir, 'my.ini');
  return {
    exe: path.join(dir, 'bin', 'mysqld.exe'),
    cwd: dir,
    args: fs.existsSync(ini) ? [`--defaults-file=${ini}`] : [],
  };
}

export function hasService(root: string, id: ServiceId): boolean {
  return launchFor(root, id) !== null;
}

async function tasklist(): Promise<string> {
  const { stdout } = await execFileAsync('tasklist', ['/NH', '/FO', 'CSV'], { windowsHide: true });
  return stdout.toLowerCase();
}

async function isRunning(id: ServiceId): Promise<boolean> {
  try {
    return (await tasklist()).includes(`"${IMAGE[id]}"`);
  } catch {
    return false;
  }
}

export async function getStatus(root: string): Promise<Status> {
  const result: Status = { apache: 'unknown', mysql: 'unknown', postgres: 'unknown', nginx: 'unknown' };
  let output: string;
  try {
    output = await tasklist();
  } catch {
    return result;
  }
  for (const id of SERVICE_IDS) {
    result[id] = output.includes(`"${IMAGE[id]}"`) ? 'running' : 'stopped';
  }
  return result;
}

// --- PostgreSQL -------------------------------------------------------------
// Laragon layout: <root>/bin/postgresql/<version>/bin/pg_ctl.exe with the
// cluster in <version>/data. PostgreSQL is started through pg_ctl (not by
// spawning postgres.exe) so the daemon detaches from this process and is not
// killed when a console window closes or receives Ctrl+C.

function postgresHome(root: string): string | null {
  return firstDirWith(path.join(root, 'bin', 'postgresql'), path.join('bin', 'pg_ctl.exe'));
}

function postgresDataDir(home: string): string {
  return path.join(home, 'data');
}

async function startPostgres(root: string): Promise<void> {
  const home = postgresHome(root);
  if (!home) {
    throw new Error(`PostgreSQL binary (pg_ctl.exe) not found under "${root}".`);
  }
  const bin = path.join(home, 'bin');
  const data = postgresDataDir(home);

  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    // First run on this machine: initialise a local development cluster.
    // Superuser "postgres", trust auth for local connections (dev only).
    await execFileAsync(
      path.join(bin, 'initdb.exe'),
      ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8'],
      { windowsHide: true }
    );
  } else {
    // postgres.exe is not running (checked by start()), so a leftover
    // postmaster.pid is stale and would block pg_ctl; remove it.
    const pidFile = path.join(data, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch {
        // if it cannot be removed, pg_ctl reports the real error below
      }
    }
  }

  await execFileAsync(
    path.join(bin, 'pg_ctl.exe'),
    // -t 300: crash recovery on slow disks can take minutes; pg_ctl should
    // keep waiting instead of reporting success while the server is still
    // starting up.
    ['-D', data, '-l', path.join(home, 'postgresql.log'), '-w', '-t', '300', 'start'],
    { cwd: home, windowsHide: true }
  );
}

export async function start(root: string, id: ServiceId): Promise<void> {
  if (await isRunning(id)) {
    return;
  }
  const launch = launchFor(root, id);
  if (!launch) {
    throw new Error(`${SERVICE_LABEL[id]} binary not found under "${root}".`);
  }
  if (id === 'postgres') {
    await startPostgres(root);
    await delay(600);
    return;
  }
  const child = spawn(launch.exe, launch.args, {
    cwd: launch.cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  await delay(600);
}

export async function stop(root: string, id: ServiceId): Promise<void> {
  const launch = launchFor(root, id);
  if (launch && (await isRunning(id))) {
    if (id === 'nginx') {
      await run(launch.exe, ['-s', 'stop'], launch.cwd);
    } else if (id === 'mysql') {
      const admin = path.join(path.dirname(launch.exe), 'mysqladmin.exe');
      if (fs.existsSync(admin)) {
        await run(admin, [...launch.args, '-u', 'root', 'shutdown'], launch.cwd);
      }
    } else if (id === 'postgres') {
      const home = postgresHome(root);
      if (home) {
        await run(launch.exe, ['-D', postgresDataDir(home), '-m', 'fast', '-w', 'stop'], launch.cwd);
      }
    }
  }
  await delay(400);
  if (await isRunning(id)) {
    await run('taskkill', ['/IM', IMAGE[id], '/F', '/T']);
  }
}

export async function restart(root: string, id: ServiceId): Promise<void> {
  await stop(root, id);
  await start(root, id);
}

async function run(file: string, args: string[], cwd?: string): Promise<void> {
  try {
    await execFileAsync(file, args, { cwd, windowsHide: true });
  } catch {
    // best effort: a forced kill below still applies
  }
}

if (require.main === module) {
  const root = process.argv[2] ?? 'C:/laragon';
  console.log('root:', root);
  for (const id of SERVICE_IDS) {
    console.log(`  ${id}: ${JSON.stringify(launchFor(root, id))}`);
  }
  getStatus(root).then((status) => console.log('status:', status));
}
