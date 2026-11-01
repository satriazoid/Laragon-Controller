import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export type ServiceId = 'apache' | 'mysql' | 'postgres' | 'nginx' | 'redis' | 'memcached';
export type ServiceState = 'running' | 'stopped' | 'unknown';
export type Action = 'start' | 'stop' | 'restart';
export type Status = Record<ServiceId, ServiceState>;

export const SERVICE_IDS: ServiceId[] = ['apache', 'mysql', 'postgres', 'nginx', 'redis', 'memcached'];

export const SERVICE_LABEL: Record<ServiceId, string> = {
  apache: 'Apache',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  nginx: 'Nginx',
  redis: 'Redis',
  memcached: 'Memcached',
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
  redis: 'redis-server.exe',
  memcached: 'memcached.exe',
};

interface Launch {
  exe: string;
  cwd: string;
  args: string[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// execFile waits for the child's stdio pipes to close, and a daemon started
// through pg_ctl inherits those pipes and holds them open for its whole
// lifetime, so awaiting pg_ctl start that way never returns and the caller
// hangs forever. Spawning with stdio ignored and settling on the exit event
// avoids the inherited pipes; the timeout bounds every external call.
function runToExit(file: string, args: string[], cwd: string | undefined, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${path.basename(file)} did not finish within ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function runChecked(file: string, args: string[], cwd: string | undefined, timeoutMs: number): Promise<void> {
  const code = await runToExit(file, args, cwd, timeoutMs);
  if (code !== 0) {
    throw new Error(`${path.basename(file)} exited with code ${code ?? 'unknown'}.`);
  }
}

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
  if (id === 'redis') {
    const dir = firstDirWith(path.join(root, 'bin', 'redis'), 'redis-server.exe');
    if (!dir) {
      return null;
    }
    const conf = path.join(dir, 'redis.windows.conf');
    return {
      exe: path.join(dir, 'redis-server.exe'),
      cwd: dir,
      args: fs.existsSync(conf) ? [conf] : [],
    };
  }
  if (id === 'memcached') {
    const dir = firstDirWith(path.join(root, 'bin', 'memcached'), 'memcached.exe');
    return dir ? { exe: path.join(dir, 'memcached.exe'), cwd: dir, args: [] } : null;
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

export type ServiceFlags = Record<ServiceId, boolean>;

export const SERVICE_DEFAULT_ENABLED: ServiceFlags = {
  apache: true,
  mysql: true,
  postgres: true,
  nginx: true,
  redis: true,
  memcached: true,
};

export function enabledServices(flags: Partial<ServiceFlags> | undefined): ServiceId[] {
  return SERVICE_IDS.filter((id) => (flags ? flags[id] !== false : true));
}

async function tasklist(): Promise<string> {
  const { stdout } = await execFileAsync('tasklist', ['/NH', '/FO', 'CSV'], { windowsHide: true, timeout: 15_000 });
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
  const result = {} as Status;
  for (const id of SERVICE_IDS) {
    result[id] = 'unknown';
  }
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

// --- MySQL ------------------------------------------------------------------
// mysqld is started through PowerShell Start-Process -WindowStyle Hidden.
// Spawning it directly, or creating it through WMI, still gives it a visible
// console window, and closing that window kills the server. The hidden
// Start-Process launch leaves it as a pure background process owned by no
// terminal, so it keeps running when VS Code or any terminal is closed.

function quoteForPowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function startMysql(launch: Launch): Promise<void> {
  const argumentList = launch.args.map(quoteForPowerShell).join(', ');
  const argsPart = launch.args.length ? ` -ArgumentList ${argumentList}` : '';
  const script =
    `Start-Process -FilePath ${quoteForPowerShell(launch.exe)}${argsPart} ` +
    `-WorkingDirectory ${quoteForPowerShell(launch.cwd)} -WindowStyle Hidden`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
    timeout: 60_000,
  });
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
    await runChecked(
      path.join(bin, 'initdb.exe'),
      ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8'],
      undefined,
      180_000
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

  const log = path.join(home, 'postgresql.log');
  try {
    // -t 300: crash recovery on slow disks can take minutes; pg_ctl should
    // keep waiting instead of reporting success while the server is still
    // starting up.
    await runChecked(
      path.join(bin, 'pg_ctl.exe'),
      ['-D', data, '-l', log, '-w', '-t', '300', 'start'],
      home,
      320_000
    );
  } catch (err) {
    throw new Error(`PostgreSQL failed to start: ${(err as Error).message} See ${log} for details.`);
  }
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
  if (id === 'mysql') {
    await startMysql(launch);
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
    } else if (id === 'redis') {
      const cli = path.join(path.dirname(launch.exe), 'redis-cli.exe');
      if (fs.existsSync(cli)) {
        await run(cli, ['SHUTDOWN', 'NOSAVE'], launch.cwd);
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
    await runToExit(file, args, cwd, 90_000);
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
