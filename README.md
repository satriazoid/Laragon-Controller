# Laragon Controller

Control and monitor your Laragon stack (**Apache, MySQL, PostgreSQL, Nginx,
Redis and Memcached**) from the VS Code sidebar. No need to keep the Laragon
GUI open or switch windows: the extension starts and stops the server binaries
directly.

## Features

- Activity Bar panel with live status (polled every 3 seconds) for every service
  found in your Laragon installation.
- **Start All / Stop All / Restart All**, plus per-service start, stop and restart.
- **Choose which services you own**: turn any service off in the settings and it
  disappears from the dashboard and is skipped by Start/Stop All. Useful when
  your Laragon install has Redis or Memcached but you never run them.
- **PostgreSQL support**: detected automatically when present in Laragon; on first
  start it even initialises the database cluster for you (see below).
- **Background by design**: services run with no console or terminal window to
  keep open, and keep running when VS Code or any terminal is closed. No
  administrator rights are needed and nothing is installed as a Windows
  service. The servers run as your own user.
- Quick shortcuts:
  - **Open www**: opens the `www` folder in your OS file explorer.
  - **Open localhost**: opens `http://localhost` in your browser.
  - **phpMyAdmin**: opens `http://localhost/phpmyadmin`.
  - **HeidiSQL**: launches the HeidiSQL desktop client from
    `bin/heidisql/heidisql.exe`.
  - **Adminer**: opens `http://localhost/adminer`.
  - **Terminal**: opens a terminal at the current project root.
  Every shortcut can be turned off in the settings.
- Toast notifications when services start or stop, and real error messages when
  something fails (nothing fails silently).
- Works without the Laragon GUI running.

## Services

Services are **auto-detected** by scanning the Laragon folder. A service only
appears (and only gets controlled) when its binaries exist on the machine and
its `laragonController.services.<id>` setting is not `false`. If several
version folders exist for the same service, the first matching folder is the
one that gets controlled:

| Service    | Detected at                                                     | Started via                                   | Default port |
| ---------- | --------------------------------------------------------------- | --------------------------------------------- | ------------ |
| Apache     | `bin/apache/*/bin/httpd.exe`                                    | `httpd.exe`                                   | 80           |
| MySQL      | `bin/mysql/*/bin/mysqld.exe`                                    | `mysqld.exe --defaults-file=<version>/my.ini`, started hidden via PowerShell `Start-Process` (background, no terminal window) | 3306         |
| PostgreSQL | `bin/postgresql/*/bin/pg_ctl.exe`, cluster in `<version>/data`  | `pg_ctl start` / `pg_ctl stop`                | 5432         |
| Nginx      | `bin/nginx/*/nginx.exe`                                         | `nginx.exe`                                   | 81           |
| Redis      | `bin/redis/*/redis-server.exe`                                  | `redis-server.exe <dir>/redis.windows.conf`   | 6379         |
| Memcached  | `bin/memcached/*/memcached.exe`                                 | `memcached.exe`                               | 11211        |

Apache listens on port 80 and Nginx on port 81, so both web servers can run at
the same time.

### Choosing your services

Each service has its own switch in the Settings UI, under **Laragon
Controller → Enable Service**:

| Setting                                   | Default | Service    |
| ----------------------------------------- | ------- | ---------- |
| `laragonController.enableService.apache`    | `true`  | Apache     |
| `laragonController.enableService.mysql`     | `true`  | MySQL      |
| `laragonController.enableService.postgres`  | `true`  | PostgreSQL |
| `laragonController.enableService.nginx`     | `true`  | Nginx      |
| `laragonController.enableService.redis`     | `true`  | Redis      |
| `laragonController.enableService.memcached` | `true`  | Memcached  |

Turn a service off and it disappears from the dashboard and is skipped by
Start All / Stop All / Restart All. Turn it back on and it reappears right
away. Services whose binaries are not installed never show up, even when
their switch is on.

An older combined form of the same switches still exists as
`laragonController.services` (an object keyed by service name). It is only a
fallback: once an individual `enableService.<name>` switch is set, that value
wins. Prefer the individual switches.

### MySQL notes

- MySQL is started through PowerShell `Start-Process -WindowStyle Hidden`.
  Spawning `mysqld` directly (or through WMI) still gives it a visible
  console window, and closing that window kills the server. The hidden
  launch leaves it as a pure background process owned by no terminal:
  no window to open or close, and it keeps running when VS Code or any
  terminal is closed.
- Stop still goes through `mysqladmin shutdown`, with a force-kill
  fallback, exactly as before.
- Graceful shutdown assumes Laragon's default MySQL setup (user `root`,
  no password). If you set a root password, `mysqladmin` can no longer
  authenticate and stopping falls back to force-killing `mysqld.exe`.
  It still stops, just less politely.

### PostgreSQL notes

- PostgreSQL is **not part of a stock Laragon install**. If the
  `bin/postgresql/<version>/bin/pg_ctl.exe` file is missing, add PostgreSQL to
  Laragon first (Laragon's *Quick Add*, or extract an official PostgreSQL
  Windows distribution into `bin/postgresql/<version>/`). The extension picks
  it up automatically. No configuration needed.
- **First start initialises the cluster**: if `<version>/data` has no cluster
  yet, the extension runs `initdb` with superuser `postgres` and **trust
  authentication for local connections**. That is convenient for local
  development only. Do not expose such a server to a network.
- PostgreSQL is managed through `pg_ctl`, so the database keeps running
  independently of VS Code and of any console window.

## Requirements

- Windows 10/11 (this extension is Windows-only).
- VS Code **1.80.0** or newer.
- Laragon installed (default `C:\laragon`; configurable, see Settings).
- No administrator rights, and nothing to install besides the extension
  itself: Windows PowerShell, which ships with Windows, is used to launch
  MySQL hidden.

That is all. Node.js is **not** needed to *use* the packaged extension, only
to build it from source.

## Installation

### Option A: install the packaged `.vsix` (plug and play)

1. Get `laragon-controller-<version>.vsix`. For now it is distributed as a
   file (it is not on the VS Code Marketplace); you can also build it
   yourself, see [Development](#development).
2. Install it, either way:
   - **VS Code UI**: in the Extensions panel, open the `...` menu, choose
     **Install from VSIX...**, then pick the file.
   - **Command line**:
     ```bat
     code --install-extension laragon-controller-0.7.4.vsix
     ```
3. Reload VS Code when prompted. The **Laragon** icon appears in the Activity
   Bar. Done.

### Option B: build from source

```bat
git clone <this-repo-url>
cd laragon-controller
pnpm install
pnpm run compile
```

Then either press `F5` in VS Code to run it in an Extension Development Host,
or package and install it as in Option A:

```bat
pnpm dlx @vscode/vsce package --allow-missing-repository
code --install-extension laragon-controller-0.7.4.vsix --force
```

### Installing with an AI coding agent

This repository ships an `AGENTS.md` file with exact, machine-readable
setup steps. Give the repository (or its URL) to your AI coding agent and say:

> Read `AGENTS.md` and `README.md` in this repo, then build and install the
> Laragon Controller extension into my VS Code, and verify the installation.

The agent can complete the whole flow unattended: install dependencies,
compile, package the `.vsix`, install it and verify the installed files.

### Sharing the extension

Send the `.vsix` file. The other machine needs the same setup (Windows
10/11, VS Code, Laragon); after that everything in this README applies
as-is: services are detected automatically, no administrator rights are
needed, and the only setting that commonly needs a touch is
`laragonController.laragonPath` when Laragon lives outside `C:\laragon`.
PostgreSQL still has to be present in that Laragon first (see the
PostgreSQL notes above).

## Usage

Open the **Laragon** panel in the Activity Bar:

- **Start All / Stop All / Restart All** for the whole stack.
- Per-service **Start / Stop / Restart** buttons; the dot shows the state
  (green = running, red = stopped, yellow = busy/unknown).
- **Gear icon in the header** (also in the panel title bar) opens this
  extension's Settings page, filtered to `Laragon Controller`. That page holds
  the per-service `enableService.<name>` checkboxes described under
  [Choosing your services](#choosing-your-services).
- Shortcut buttons: **phpMyAdmin**, **HeidiSQL**, **Adminer**, **Open www**,
  **Open localhost**, **Terminal**. Each can be hidden in the settings.
- All actions are also available as commands (`Laragon: ...`) in the Command
  Palette.

## Settings

| Setting                            | Default      | Description                                                              |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `laragonController.laragonPath`    | `C:/laragon` | Laragon installation folder.                                             |
| `laragonController.autoStartOnOpen`| `false`      | Start all services automatically when VS Code opens.                     |
| `laragonController.pollingInterval`| `3000`       | Status check interval in milliseconds (minimum 1000).                    |
| `laragonController.defaultBrowser` | `""`         | Browser executable used for `http://localhost`; empty = system default.  |
| `laragonController.enableService.apache` | `true` | Show Apache on the dashboard and include it in Start/Stop All. |
| `laragonController.enableService.mysql` | `true` | Same, for MySQL. |
| `laragonController.enableService.postgres` | `true` | Same, for PostgreSQL. |
| `laragonController.enableService.nginx` | `true` | Same, for Nginx. |
| `laragonController.enableService.redis` | `true` | Same, for Redis. |
| `laragonController.enableService.memcached` | `true` | Same, for Memcached. |
| `laragonController.services`       | `{}` (unset) | Legacy object form; individual switches override it. |
| `laragonController.databaseManagerUrl` | `http://localhost/phpmyadmin` | URL opened by the phpMyAdmin shortcut. |
| `laragonController.adminerUrl`     | `http://localhost/adminer` | URL opened by the Adminer shortcut.                        |
| `laragonController.heidiSqlPath`   | `""`         | Path to `heidisql.exe`; empty = `<laragonPath>/bin/heidisql/heidisql.exe`. |
| `laragonController.enableStartAll` | `true`       | Show the Start/Stop/Restart All controls.                                |
| `laragonController.enableOpenWww`  | `true`       | Show the Open www shortcut.                                              |
| `laragonController.enableOpenLocalhost` | `true`  | Show the Open localhost shortcut.                                        |
| `laragonController.enablePhpMyAdmin` | `true`     | Show the phpMyAdmin shortcut.                                            |
| `laragonController.enableHeidiSql` | `true`       | Show the HeidiSQL shortcut.                                              |
| `laragonController.enableAdminer`  | `true`       | Show the Adminer shortcut.                                               |
| `laragonController.enableTerminal` | `true`       | Show the Terminal shortcut.                                              |

## Troubleshooting

- **"Laragon not found at ..."**: Laragon is not at the default path. Set
  `laragonController.laragonPath` to your installation folder.
- **A service is missing from the dashboard**: either its binaries were not
  found (check the detection paths in the [Services](#services) table), or it
  is switched off in `laragonController.services`. For PostgreSQL a missing
  row means it has not been added to Laragon yet.
- **phpMyAdmin or Adminer says "Forbidden"**: that comes from Apache, not this
  extension: the alias file (`etc/apache2/alias/phpmyadmin.conf` or
  `adminer.conf`) must point at a folder that actually exists (e.g.
  `C:/laragon/www/phpmyadmin`, `C:/laragon/etc/apps/adminer`), and Apache must
  be restarted afterwards. The shortcut URL can also be changed with
  `laragonController.databaseManagerUrl` / `laragonController.adminerUrl`.
- **HeidiSQL does not open**: no `heidisql.exe` was found at
  `<laragonPath>/bin/heidisql/heidisql.exe`. Point `laragonController.heidiSqlPath`
  at the executable.
- **A service will not stop**: the extension first tries the graceful
  shutdown for each service and then force-kills the process as a fallback.
- **Restart never finishes, or the buttons stay disabled**: that was a
  bug in versions before 0.6.3, where an action could hang forever.
  Update to 0.6.3 or newer; the installed version is shown in the
  Extensions panel.
- **A console window titled with the `mysqld.exe` path appears**: also
  fixed, in 0.6.2. If you still see one, you are on an older version.

## Development

```bat
pnpm install     # install dev dependencies (TypeScript), pnpm-lock.yaml is the only lockfile
pnpm run compile # build to out/
pnpm run watch   # rebuild on change
node out/services.js   # sanity check: prints detected binaries + live status
```

Do not run `npm install`: it creates a `package-lock.json` that is gitignored
and a separate dependency tree from the pnpm store.

Project layout:

```
src/
  extension.ts  commands and activation
  dashboard.ts  sidebar webview (renders one row per service automatically)
  laragon.ts    paths and control facade
  services.ts   service detection, start, stop, status (no VS Code API)
```

## Changelog

- **0.7.4**: The separate **Dashboard settings** checkbox list is gone. A gear
  icon in the dashboard header (and in the panel title bar) opens the
  extension's own Settings page, where each service has its
  `enableService.<name>` checkbox. Fewer controls, one place for settings.
- **0.7.3**: New **Dashboard settings** section in the sidebar with a checkbox
  per installed service, so services can be shown or hidden without opening
  Settings. The checkbox updates `laragonController.enableService.<name>`
  directly and the dashboard re-renders immediately.
- **0.7.2**: Per-service on/off switches are now individual settings
  (`laragonController.enableService.<name>`), so they show up as checkboxes in
  the Settings UI instead of a hard-to-edit object. A service that is switched
  off is hidden from the dashboard and skipped by Start/Stop/Restart All; the
  dashboard updates as soon as the switch changes. The old combined
  `laragonController.services` object still works as a fallback.
- **0.7.1**: New services **Redis** and **Memcached** (auto-detected, start and
  stop handled). New `laragonController.services` setting to switch each
  service on or off per machine; a disabled service is hidden from the
  dashboard and skipped by Start/Stop/Restart All. New shortcuts **HeidiSQL**
  (desktop client) and **Adminer** (web), each with its own URL/path setting
  and on/off switch. phpMyAdmin shortcut URL is now configurable
  (`databaseManagerUrl`). Every dashboard shortcut has an
  `enable...` switch. Build uses **pnpm**; `package-lock.json` is gone.
- **0.6.3**: Restart (single and Restart All) no longer hangs: starting
  PostgreSQL through `pg_ctl` was awaited via a pipe the daemon inherits
  and keeps open forever, so the action never returned and the dashboard
  stayed busy. External calls now run with stdio ignored, settle on
  process exit, and are all time-bounded.
- **0.6.2**: MySQL start fixed properly: it now launches through
  PowerShell `Start-Process -WindowStyle Hidden`. The 0.6.1 WMI launch
  removed the terminal parent but still showed a `mysqld.exe` console
  window, and closing that window killed the server; 0.6.2 leaves no
  visible window at all.
- **0.6.1**: First attempt at a background MySQL start, via WMI
  (`Win32_Process.Create`). It removed the terminal parent but still left
  a visible `mysqld.exe` console window; superseded by 0.6.2.
- **0.6.0**: PostgreSQL service: auto-detection, `pg_ctl` start/stop,
  automatic `initdb` on first start, stale `postmaster.pid` cleanup.
- **0.5.1**: Fixed the dead **Open www** button (it called a non-existent
  VS Code command and swallowed the error); browser-open failures are now
  reported instead of failing silently.
- **0.5.0**: Initial release: Apache, MySQL and Nginx control, sidebar
  dashboard, shortcuts.

## License

MIT. See the `LICENSE` file in this repository.
