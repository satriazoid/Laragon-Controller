# AGENTS.md — Laragon Controller

Instructions for an AI coding agent (or a developer) working with this
repository on a Windows machine. Following these steps builds the VS Code
extension and installs it into the user's VS Code. Everything runs locally;
no account or network service is required except pnpm / the VS Code extension
toolchain.

## What this project is

A VS Code extension (TypeScript) that starts, stops and monitors the Laragon
stack on Windows: Apache, MySQL, PostgreSQL and Nginx, plus Redis and Memcached
when present. It controls the server binaries inside a Laragon installation
directly (default `C:\laragon`); the Laragon GUI is not used. Full user
documentation: [README.md](README.md).

## Prerequisites — check first

Run these and stop with a clear report if any fails:

```bat
node --version        :: any current LTS (build-time only)
pnpm --version        :: pnpm 9+ (package manager; not npm)
code --version        :: VS Code 1.80.0 or newer
dir C:\laragon        :: Laragon install; path is configurable, see below
```

- Node.js/pnpm are needed ONLY to build. End users of the `.vsix` need just
  VS Code + Laragon.
- This project uses **pnpm** (`pnpm-lock.yaml` is the only lockfile). Never
  run `npm install` or commit `package-lock.json`; it is gitignored.
- If Laragon lives somewhere else, that is fine — the extension has a
  `laragonController.laragonPath` setting. Do not hardcode another path.

## Build and install (exact steps)

```bat
cd laragon-controller
pnpm install
pnpm run compile
pnpm dlx @vscode/vsce package --allow-missing-repository
code --install-extension laragon-controller-0.7.1.vsix --force
```

(Replace the version in the file name with the `version` from `package.json`.)

Then ask the user to run **Developer: Reload Window** in VS Code (or restart
VS Code) so the new version activates.

## Verify the installation

1. The installed extension folder exists and matches the packaged version:

   ```bat
   dir "%USERPROFILE%\.vscode\extensions" | findstr laragon
   ```

2. Service detection + live status sanity check (works without VS Code):

   ```bat
   node out\services.js
   ```

   It prints, for each service, the binary path found under the Laragon root
   (or `null`) and its current running state. A service prints `null` when its
   binaries are not installed on that machine — that is expected behaviour,
   not an error (notably PostgreSQL, which is not part of a stock Laragon).

## How the code is organised

| File              | Responsibility                                                                 |
| ----------------- | ------------------------------------------------------------------------------ |
| `src/services.ts` | All service logic, no VS Code API. Detection, start, stop, status per service. |
| `src/laragon.ts`  | Facade: config (`laragonPath`), `www` path, `control` / `controlAll`.           |
| `src/extension.ts`| Command registrations: start/stop all, Open www, Open localhost, phpMyAdmin, terminal. |
| `src/dashboard.ts`| Sidebar webview. Renders one row per entry of `SERVICE_IDS` automatically.      |

To add or change a service, edit `src/services.ts` only: extend `ServiceId`,
`SERVICE_IDS`, `SERVICE_LABEL`, `IMAGE` and `launchFor`, plus any special
start/stop handling in `start` / `stop`. The dashboard and commands pick the
change up automatically.

Service specifics worth knowing:

- **Detection** is by scanning version folders, e.g. the first folder under
  `bin/apache/` that contains `bin/httpd.exe`. Version numbers are never
  hardcoded.
- **PostgreSQL** lives at `bin/postgresql/<version>/` with `bin/pg_ctl.exe`
  and its cluster in `<version>/data`. Start/stop go through `pg_ctl` (never
  spawn `postgres.exe` directly — the daemon must detach from the caller's
  console). If `data/PG_VERSION` is missing, `start` first runs `initdb`
  (superuser `postgres`, `--auth=trust`, local development only). If no
  `postgres.exe` is running, `start` deletes a stale `data/postmaster.pid`
  before calling `pg_ctl`, because it would otherwise block the start.
- **MySQL** is started with `--defaults-file=<version>/my.ini` when present
  and stopped via `mysqladmin -u root shutdown` before falling back to a kill.
- Every `stop` ends with a `taskkill /F /T` fallback for the service image.

## Repository conventions

- `out/`, `node_modules/` and `*.vsix` are gitignored build products — never
  commit them. Distribute the `.vsix` via GitHub Releases, not in git.
- Do not commit backup files (`*.bak-*`) or local scratch/test scripts.
- Bump `version` in `package.json` for every user-visible change
  (patch = fixes, minor = new service/feature) and add a `CHANGELOG` entry in
  `README.md`.
- After changing TypeScript, `pnpm run compile` must pass with no errors
  before packaging.
