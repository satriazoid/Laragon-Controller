![Laragon Controller](image/banner-lc.png)

[English](#english) | [Bahasa Indonesia](#bahasa-indonesia)

---

<a id="english"></a>

## English

Control and monitor your Laragon stack (**Apache, MySQL, PostgreSQL, Nginx,
Redis and Memcached**) from the VS Code sidebar. No need to keep the Laragon
GUI open or switch windows: the extension starts and stops the server binaries
directly.

Jump to the [Bahasa Indonesia](#bahasa-indonesia) section for the Indonesian
version of this document.

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
its `enableService.<name>` setting is not `false`. If several version folders
exist for the same service, the first matching folder is the one that gets
controlled:

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

---

<a id="bahasa-indonesia"></a>

## Bahasa Indonesia

[English](#english) | [Bahasa Indonesia](#bahasa-indonesia)

Kendalikan dan pantau stack Laragon (**Apache, MySQL, PostgreSQL, Nginx,
Redis dan Memcached**) langsung dari sidebar VS Code. Laragon GUI tidak perlu
dibuka dan tidak perlu berpindah jendela: ekstensi menjalankan dan
menghentikan binary server secara langsung.

## Fitur

- Panel Activity Bar dengan status langsung (dicek setiap 3 detik) untuk setiap
  service yang ditemukan di instalasi Laragon.
- **Start All / Stop All / Restart All**, plus start, stop dan restart per
  service.
- **Pilih service mana yang kamu punya**: matikan service di pengaturan dan
  service itu hilang dari dashboard serta dilewati Start/Stop All. Berguna
  kalau Laragon kamu punya Redis atau Memcached tapi tidak pernah dipakai.
- **Dukungan PostgreSQL**: terdeteksi otomatis bila ada di Laragon; pada start
  pertama ekstensi bahkan menyiapkan cluster database untukmu (lihat di bawah).
- **Berjalan di background**: service berjalan tanpa jendela konsol atau
  terminal yang harus dibiarkan terbuka, dan tetap hidup saat VS Code atau
  terminal ditutup. Tidak perlu hak administrator dan tidak ada yang dipasang
  sebagai Windows service. Server berjalan sebagai user kamu sendiri.
- Shortcut cepat:
  - **Open www**: membuka folder `www` di file explorer OS.
  - **Open localhost**: membuka `http://localhost` di browser.
  - **phpMyAdmin**: membuka `http://localhost/phpmyadmin`.
  - **HeidiSQL**: menjalankan aplikasi HeidiSQL dari
    `bin/heidisql/heidisql.exe`.
  - **Adminer**: membuka `http://localhost/adminer`.
  - **Terminal**: membuka terminal di root project saat ini.
  Setiap shortcut bisa dimatikan lewat pengaturan.
- Notifikasi saat service menyala atau mati, dan pesan error yang jelas bila
  ada yang gagal (tidak ada kegagalan yang senyap).
- Berjalan tanpa membuka Laragon GUI.

## Services

Service **terdeteksi otomatis** dengan memindai folder Laragon. Sebuah service
hanya muncul (dan hanya dikendalikan) bila binary-nya ada di mesin dan setting
`enableService.<nama>`-nya tidak `false`. Bila ada beberapa folder versi untuk
service yang sama, folder pertama yang cocok yang dikendalikan:

| Service    | Terdeteksi di                                                   | Dijalankan via                                | Port default |
| ---------- | --------------------------------------------------------------- | --------------------------------------------- | ------------ |
| Apache     | `bin/apache/*/bin/httpd.exe`                                    | `httpd.exe`                                   | 80           |
| MySQL      | `bin/mysql/*/bin/mysqld.exe`                                    | `mysqld.exe --defaults-file=<versi>/my.ini`, dijalankan tersembunyi lewat PowerShell `Start-Process` (background, tanpa jendela terminal) | 3306 |
| PostgreSQL | `bin/postgresql/*/bin/pg_ctl.exe`, cluster di `<versi>/data`    | `pg_ctl start` / `pg_ctl stop`                | 5432         |
| Nginx      | `bin/nginx/*/nginx.exe`                                         | `nginx.exe`                                   | 81           |
| Redis      | `bin/redis/*/redis-server.exe`                                  | `redis-server.exe <dir>/redis.windows.conf`   | 6379         |
| Memcached  | `bin/memcached/*/memcached.exe`                                 | `memcached.exe`                               | 11211        |

Apache memakai port 80 dan Nginx port 81, jadi keduanya bisa jalan bersamaan.

### Memilih service kamu

Setiap service punya switch sendiri di Settings UI, di bawah **Laragon
Controller → Enable Service**:

| Setting                                     | Default | Service    |
| ------------------------------------------- | ------- | ---------- |
| `laragonController.enableService.apache`    | `true`  | Apache     |
| `laragonController.enableService.mysql`     | `true`  | MySQL      |
| `laragonController.enableService.postgres`  | `true`  | PostgreSQL |
| `laragonController.enableService.nginx`     | `true`  | Nginx      |
| `laragonController.enableService.redis`     | `true`  | Redis      |
| `laragonController.enableService.memcached` | `true`  | Memcached  |

Matikan sebuah service, service itu hilang dari dashboard dan dilewati Start
All / Stop All / Restart All. Nyalakan lagi, service tersebut langsung muncul
kembali. Service yang binary-nya tidak terpasang tidak akan muncul walaupun
switch-nya menyala.

Bentuk gabungan lama dari switch yang sama masih tersedia sebagai
`laragonController.services` (objek dengan nama service sebagai key). Itu hanya
cadangan: begitu switch `enableService.<nama>` diatur, nilainya yang dipakai.
Sebaiknya pakai switch individual.

### Catatan MySQL

- MySQL dijalankan lewat PowerShell `Start-Process -WindowStyle Hidden`.
  Menjalankan `mysqld` langsung (atau lewat WMI) masih memunculkan jendela
  konsol, dan menutup jendela itu mematikan server. Peluncuran tersembunyi
  membuatnya jadi proses background murni tanpa pemilik terminal: tidak ada
  jendela untuk dibuka atau ditutup, dan tetap berjalan saat VS Code atau
  terminal ditutup.
- Stop tetap lewat `mysqladmin shutdown`, dengan fallback force-kill.
- Shutdown rapi mengasumsikan setup MySQL bawaan Laragon (user `root`, tanpa
  password). Bila kamu memasang password root, `mysqladmin` tidak bisa
  autentikasi dan stop akan beralih ke force-kill `mysqld.exe`. Tetap mati,
  hanya kurang rapi.

### Catatan PostgreSQL

- PostgreSQL **bukan bagian dari instalasi Laragon standar**. Bila file
  `bin/postgresql/<versi>/bin/pg_ctl.exe` tidak ada, tambahkan PostgreSQL ke
  Laragon dulu (*Quick Add* di Laragon, atau ekstrak distribusi resmi
  PostgreSQL untuk Windows ke `bin/postgresql/<versi>/`). Ekstensi akan
  mendeteksinya otomatis. Tidak perlu konfigurasi.
- **Start pertama menyiapkan cluster**: bila `<versi>/data` belum punya
  cluster, ekstensi menjalankan `initdb` dengan superuser `postgres` dan
  **autentikasi trust untuk koneksi lokal**. Nyaman untuk development lokal
  saja. Jangan buka server seperti itu ke jaringan.
- PostgreSQL dikelola lewat `pg_ctl`, jadi database tetap berjalan terlepas
  dari VS Code dan jendela konsol.

## Kebutuhan

- Windows 10/11 (ekstensi ini khusus Windows).
- VS Code **1.80.0** atau lebih baru.
- Laragon terpasang (default `C:\laragon`; bisa diubah, lihat Pengaturan).
- Tidak perlu hak administrator, dan tidak ada yang perlu dipasang selain
  ekstensi itu sendiri: Windows PowerShell, yang sudah ada di Windows,
  dipakai untuk menjalankan MySQL secara tersembunyi.

Itu saja. Node.js **tidak** dibutuhkan untuk *memakai* ekstensi yang sudah
dipaketkan, hanya untuk membangunnya dari source.

## Instalasi

### Opsi A: instal `.vsix` yang sudah dipaketkan (langsung pakai)

1. Dapatkan `laragon-controller-<versi>.vsix`. Saat ini dibagikan sebagai
   file (belum ada di VS Code Marketplace); kamu juga bisa build sendiri,
   lihat [Development](#development).
2. Instal, pilih salah satu:
   - **VS Code UI**: buka panel Extensions, menu `...`, pilih
     **Install from VSIX...**, lalu pilih filenya.
   - **Command line**:
     ```bat
     code --install-extension laragon-controller-0.7.4.vsix
     ```
3. Reload VS Code saat diminta. Ikon **Laragon** muncul di Activity Bar.
   Selesai.

### Opsi B: build dari source

```bat
git clone <this-repo-url>
cd laragon-controller
pnpm install
pnpm run compile
```

Lalu tekan `F5` di VS Code untuk menjalankannya di Extension Development Host,
atau paketkan dan instal seperti Opsi A:

```bat
pnpm dlx @vscode/vsce package --allow-missing-repository
code --install-extension laragon-controller-0.7.4.vsix --force
```

### Instalasi dengan AI coding agent

Repo ini menyertakan `AGENTS.md` berisi langkah setup yang tepat dan
machine-readable. Berikan repo (atau URL-nya) ke AI coding agent kamu dan
katakan:

> Read `AGENTS.md` and `README.md` in this repo, then build and install the
> Laragon Controller extension into my VS Code, and verify the installation.

Agent bisa menyelesaikan seluruh alur tanpa pengawasan: memasang dependency,
compile, memaketkan `.vsix`, menginstalnya dan memverifikasi file terpasang.

### Membagikan ekstensi

Kirim file `.vsix`. Mesin tujuan butuh setup sama (Windows 10/11, VS Code,
Laragon); setelah itu semua yang ada di README ini berlaku apa adanya:
service terdeteksi otomatis, tidak perlu hak administrator, dan satu-satunya
setting yang biasanya perlu diubah adalah `laragonController.laragonPath` bila
Laragon ada di luar `C:\laragon`. PostgreSQL tetap harus ada di Laragon
tersebut dulu (lihat catatan PostgreSQL di atas).

## Penggunaan

Buka panel **Laragon** di Activity Bar:

- **Start All / Stop All / Restart All** untuk seluruh stack.
- Tombol **Start / Stop / Restart** per service; titik menunjukkan status
  (hijau = jalan, merah = mati, kuning = sibuk/tidak diketahui).
- **Ikon gear** di header (juga di title bar panel) membuka halaman Settings
  ekstensi ini, sudah terfilter ke `Laragon Controller`. Di sana ada checkbox
  `enableService.<nama>` per service yang dijelaskan pada
  [Memilih service kamu](#memilih-service-kamu).
- Tombol shortcut: **phpMyAdmin**, **HeidiSQL**, **Adminer**, **Open www**,
  **Open localhost**, **Terminal**. Masing-masing bisa disembunyikan lewat
  pengaturan.
- Semua aksi juga tersedia sebagai command (`Laragon: ...`) di Command Palette.

## Pengaturan

| Setting                            | Default      | Deskripsi                                                              |
| ---------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `laragonController.laragonPath`    | `C:/laragon` | Folder instalasi Laragon.                                              |
| `laragonController.autoStartOnOpen`| `false`      | Jalankan semua service otomatis saat VS Code dibuka.                   |
| `laragonController.pollingInterval`| `3000`       | Interval cek status dalam milidetik (minimum 1000).                    |
| `laragonController.defaultBrowser` | `""`         | Browser yang dipakai untuk `http://localhost`; kosong = default sistem.|
| `laragonController.enableService.apache` | `true` | Tampilkan Apache di dashboard dan ikut di Start/Stop All. |
| `laragonController.enableService.mysql` | `true` | Sama, untuk MySQL. |
| `laragonController.enableService.postgres` | `true` | Sama, untuk PostgreSQL. |
| `laragonController.enableService.nginx` | `true` | Sama, untuk Nginx. |
| `laragonController.enableService.redis` | `true` | Sama, untuk Redis. |
| `laragonController.enableService.memcached` | `true` | Sama, untuk Memcached. |
| `laragonController.services`       | `{}` (belum diatur) | Bentuk objek lama; switch individual menimpa ini. |
| `laragonController.databaseManagerUrl` | `http://localhost/phpmyadmin` | URL yang dibuka shortcut phpMyAdmin. |
| `laragonController.adminerUrl`     | `http://localhost/adminer` | URL yang dibuka shortcut Adminer.                          |
| `laragonController.heidiSqlPath`   | `""`         | Path ke `heidisql.exe`; kosong = `<laragonPath>/bin/heidisql/heidisql.exe`. |
| `laragonController.enableStartAll` | `true`       | Tampilkan tombol Start/Stop/Restart All.                               |
| `laragonController.enableOpenWww`  | `true`       | Tampilkan shortcut Open www.                                           |
| `laragonController.enableOpenLocalhost` | `true`  | Tampilkan shortcut Open localhost.                                     |
| `laragonController.enablePhpMyAdmin` | `true`     | Tampilkan shortcut phpMyAdmin.                                         |
| `laragonController.enableHeidiSql` | `true`       | Tampilkan shortcut HeidiSQL.                                           |
| `laragonController.enableAdminer`  | `true`       | Tampilkan shortcut Adminer.                                            |
| `laragonController.enableTerminal` | `true`       | Tampilkan shortcut Terminal.                                           |

## Troubleshooting

- **"Laragon not found at ..."**: Laragon tidak ada di path default. Atur
  `laragonController.laragonPath` ke folder instalasimu.
- **Service tidak muncul di dashboard**: binary-nya tidak ditemukan (cek path
  deteksi di tabel [Services](#services)), atau switch-nya dimatikan di
  `enableService.<nama>`. Untuk PostgreSQL, baris yang hilang berarti
  PostgreSQL belum ditambahkan ke Laragon.
- **phpMyAdmin atau Adminer menampilkan "Forbidden"**: itu dari Apache, bukan
  dari ekstensi ini: file alias (`etc/apache2/alias/phpmyadmin.conf` atau
  `adminer.conf`) harus menunjuk ke folder yang benar-benar ada (misalnya
  `C:/laragon/www/phpmyadmin`, `C:/laragon/etc/apps/adminer`), lalu Apache
  harus di-restart. URL shortcut juga bisa diubah lewat
  `laragonController.databaseManagerUrl` / `laragonController.adminerUrl`.
- **HeidiSQL tidak terbuka**: `heidisql.exe` tidak ditemukan di
  `<laragonPath>/bin/heidisql/heidisql.exe`. Arahkan
  `laragonController.heidiSqlPath` ke executable-nya.
- **Service tidak mau berhenti**: ekstensi mencoba shutdown rapi dulu untuk
  tiap service, lalu force-kill proses sebagai cadangan.
- **Restart tidak pernah selesai, atau tombol tetap disabled**: itu bug pada
  versi sebelum 0.6.3, di mana sebuah aksi bisa menggantung selamanya. Update
  ke 0.6.3 atau lebih baru; versi terpasang terlihat di panel Extensions.
- **Muncul jendela konsol berjudul path `mysqld.exe`**: juga sudah diperbaiki
  di 0.6.2. Kalau masih muncul, kamu memakai versi lama.

## Development

```bat
pnpm install     # pasang dependency dev (TypeScript), pnpm-lock.yaml satu-satunya lockfile
pnpm run compile # build ke out/
pnpm run watch   # build ulang saat ada perubahan
node out/services.js   # cek cepat: menampilkan binary terdeteksi + status langsung
```

Jangan jalankan `npm install`: itu membuat `package-lock.json` yang sudah masuk
gitignore dan dependency tree terpisah dari store pnpm.

Struktur project:

```
src/
  extension.ts  command dan aktivasi
  dashboard.ts  webview sidebar (membuat satu baris per service otomatis)
  laragon.ts    path dan facade kontrol
  services.ts   deteksi service, start, stop, status (tanpa VS Code API)
```

## Changelog

Lihat [Changelog di bagian English](#english). Isinya sama, hanya berbeda
bahasa.

## Lisensi

MIT. Lihat file `LICENSE` di repo ini.

