# Laragon Controller

Control and monitor your Laragon stack (**Apache, MySQL, PostgreSQL and Nginx**)
from the VS Code sidebar. No need to keep the Laragon GUI open or switch windows:
the extension starts and stops the server binaries directly.

## Features

- Activity Bar panel with live status (polled every 3 seconds) for every service
  found in your Laragon installation.
- **Start All / Stop All / Restart All**, plus per-service start, stop and restart.
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
  - **Terminal**: opens a terminal at the current project root.
- Toast notifications when services start or stop, and real error messages when
  something fails (nothing fails silently).
- Works without the Laragon GUI running.

## Services

Services are **auto-detected** by scanning the Laragon folder. A service only
appears (and only gets controlled) when its binaries exist on the machine.
If several version folders exist for the same service, the first matching
folder is the one that gets controlled:

| Service    | Detected at                                                     | Started via                                   | Default port |
| ---------- | --------------------------------------------------------------- | --------------------------------------------- | ------------ |
| Apache     | `bin/apache/*/bin/httpd.exe`                                    | `httpd.exe`                                   | 80           |
| MySQL      | `bin/mysql/*/bin/mysqld.exe`                                    | `mysqld.exe --defaults-file=<version>/my.ini`, started hidden via PowerShell `Start-Process` (background, no terminal window) | 3306         |
| PostgreSQL | `bin/postgresql/*/bin/pg_ctl.exe`, cluster in `<version>/data`  | `pg_ctl start` / `pg_ctl stop`                | 5432         |
| Nginx      | `bin/nginx/*/nginx.exe`                                         | `nginx.exe`                                   | 81           |

Apache listens on port 80 and Nginx on port 81, so both web servers can run at
the same time.

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
     code --install-extension laragon-controller-0.6.3.vsix
     ```
3. Reload VS Code when prompted. The **Laragon** icon appears in the Activity
   Bar. Done.

### Option B: build from source

```bat
git clone <this-repo-url>
cd laragon-controller
npm install
npm run compile
```

Then either press `F5` in VS Code to run it in an Extension Development Host,
or package and install it as in Option A:

```bat
npx @vscode/vsce package --allow-missing-repository
code --install-extension laragon-controller-0.6.3.vsix --force
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
- Shortcut buttons: **Open www**, **Open localhost**, **phpMyAdmin**,
  **Terminal**.
- All actions are also available as commands (`Laragon: ...`) in the Command
  Palette.

## Settings

| Setting                            | Default      | Description                                                              |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `laragonController.laragonPath`    | `C:/laragon` | Laragon installation folder.                                             |
| `laragonController.autoStartOnOpen`| `false`      | Start all services automatically when VS Code opens.                     |
| `laragonController.pollingInterval`| `3000`       | Status check interval in milliseconds (minimum 1000).                    |
| `laragonController.defaultBrowser` | `""`         | Browser executable used for `http://localhost`; empty = system default.  |

## Troubleshooting

- **"Laragon not found at ..."**: Laragon is not at the default path. Set
  `laragonController.laragonPath` to your installation folder.
- **A service never shows up**: its binaries were not found; check the
  detection paths in the [Services](#services) table. For PostgreSQL this
  means it has not been added to Laragon yet.
- **phpMyAdmin says "Forbidden"**: that comes from Apache, not this
  extension: Laragon's `etc/apache2/alias/phpmyadmin.conf` must point at an
  existing phpMyAdmin folder (e.g. `C:/laragon/www/phpmyadmin`) and Apache
  must be restarted afterwards.
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
npm install     # install dev dependencies (TypeScript)
npm run compile # build to out/
npm run watch   # rebuild on change
node out/services.js   # sanity check: prints detected binaries + live status
```

Project layout:

```
src/
  extension.ts  commands and activation
  dashboard.ts  sidebar webview (renders one row per service automatically)
  laragon.ts    paths and control facade
  services.ts   service detection, start, stop, status (no VS Code API)
```

## Changelog

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
