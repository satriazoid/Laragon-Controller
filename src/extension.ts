import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DashboardProvider } from './dashboard';
import { ACTION_LABEL, Action, control, controlAll, getStatus, hasService, laragonPath, SERVICE_LABEL, wwwPath } from './laragon';
import type { ServiceId } from './laragon';

async function runAll(action: Action): Promise<void> {
  try {
    await controlAll(action);
    vscode.window.showInformationMessage(`Laragon: ${ACTION_LABEL[action]} all services.`);
  } catch (err) {
    vscode.window.showErrorMessage(`Laragon: ${(err as Error).message}`);
  }
}

async function openRoot(): Promise<void> {
  const dir = wwwPath();
  if (!fs.existsSync(dir)) {
    vscode.window.showErrorMessage(`Laragon: www folder not found at "${dir}".`);
    return;
  }
  try {
    // 'revealFileSystemResource' is not a real VS Code command, so the old
    // call failed silently and this button looked dead. The built-in command
    // to show a folder in the OS file manager is 'revealFileInOS'.
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(dir));
  } catch (err) {
    vscode.window.showErrorMessage(`Laragon: failed to open www folder: ${(err as Error).message}`);
  }
}

async function openExternalUrl(url: string): Promise<void> {
  const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
  if (!opened) {
    vscode.window.showErrorMessage(`Laragon: could not open ${url} in a browser.`);
  }
}

// Start the services a shortcut depends on, wait until they report running,
// then open the URL. Without this the button opens a page that is not being
// served yet and the user only sees a connection error or a 403.
async function ensureServices(ids: ServiceId[]): Promise<boolean> {
  const required = ids.filter((id) => hasService(id));
  if (!required.length) {
    return true;
  }
  let status = await getStatus();
  const down = required.filter((id) => status[id] !== 'running');
  if (!down.length) {
    return true;
  }

  const names = down.map((id) => SERVICE_LABEL[id]).join(', ');
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Laragon: starting ${names}...` },
    async () => {
      for (const id of down) {
        try {
          await control('start', id);
        } catch (err) {
          vscode.window.showErrorMessage(`Laragon: could not start ${SERVICE_LABEL[id]}: ${(err as Error).message}`);
          return false;
        }
      }
      // start() returns before the server is accepting connections; poll for a
      // short window so the browser does not race the server startup.
      for (let attempt = 0; attempt < 20; attempt++) {
        status = await getStatus();
        if (required.every((id) => status[id] === 'running')) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      vscode.window.showErrorMessage(`Laragon: ${names} did not come up in time. Check the service log.`);
      return false;
    }
  );
}

async function openWebWithServices(url: string, ids: ServiceId[]): Promise<void> {
  const ready = await ensureServices(ids);
  if (!ready) {
    return;
  }
  await openExternalUrl(url);
}

function launchWeb(): void {
  const url = 'http://localhost';
  const browser = vscode.workspace.getConfiguration('laragonController').get<string>('defaultBrowser', '').trim();
  void vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Laragon: opening http://localhost...' },
    async () => {
      if (!(await ensureServices(['apache']))) {
        return;
      }
      if (!browser) {
        await openExternalUrl(url);
        return;
      }
      execFile(browser, [url], { windowsHide: true }, (err) => {
        if (err) {
          vscode.window.showErrorMessage(`Laragon: failed to launch "${browser}": ${err.message}`);
        }
      });
    }
  );
}

function openDatabaseManager(): void {
  const url = vscode.workspace
    .getConfiguration('laragonController')
    .get<string>('databaseManagerUrl', 'http://localhost/phpmyadmin')
    .trim() || 'http://localhost/phpmyadmin';
  // phpMyAdmin needs the web server for the page and a database for login.
  void openWebWithServices(url, ['apache', 'mysql']);
}

function openApp(exePath: string, label: string): void {
  if (!exePath || !fs.existsSync(exePath)) {
    vscode.window.showErrorMessage(`Laragon: ${label} not found at "${exePath}".`);
    return;
  }
  execFile(exePath, [], { cwd: path.dirname(exePath), windowsHide: false }, (err) => {
    if (err) {
      vscode.window.showErrorMessage(`Laragon: failed to launch ${label}: ${err.message}`);
    }
  });
}

function openHeidiSql(): void {
  const configured = vscode.workspace
    .getConfiguration('laragonController')
    .get<string>('heidiSqlPath', '')
    .trim();
  const exe = configured || path.join(laragonPath(), 'bin', 'heidisql', 'heidisql.exe');
  openApp(exe, 'HeidiSQL');
}

function openAdminer(): void {
  const url = vscode.workspace
    .getConfiguration('laragonController')
    .get<string>('adminerUrl', 'http://localhost/adminer')
    .trim() || 'http://localhost/adminer';
  void openWebWithServices(url, ['apache']);
}

function openTerminal(): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const cwd = folder ? folder.uri.fsPath : fs.existsSync(wwwPath()) ? wwwPath() : laragonPath();
  vscode.window.createTerminal({ name: 'Laragon', cwd }).show();
}

async function openSettings(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:satriazoid.laragon-controller');
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new DashboardProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DashboardProvider.viewType, provider),
    vscode.commands.registerCommand('laragonController.refresh', () => provider.refreshNow()),
    vscode.commands.registerCommand('laragonController.openSettings', openSettings),
    vscode.commands.registerCommand('laragonController.startAll', () => runAll('start')),
    vscode.commands.registerCommand('laragonController.stopAll', () => runAll('stop')),
    vscode.commands.registerCommand('laragonController.restartAll', () => runAll('restart')),
    vscode.commands.registerCommand('laragonController.openRoot', openRoot),
    vscode.commands.registerCommand('laragonController.launchWeb', launchWeb),
    vscode.commands.registerCommand('laragonController.openDatabaseManager', openDatabaseManager),
    vscode.commands.registerCommand('laragonController.openHeidiSql', openHeidiSql),
    vscode.commands.registerCommand('laragonController.openAdminer', openAdminer),
    vscode.commands.registerCommand('laragonController.openTerminal', openTerminal)
  );

  if (vscode.workspace.getConfiguration('laragonController').get<boolean>('autoStartOnOpen', false)) {
    void runAll('start');
  }
}
