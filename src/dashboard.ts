import * as vscode from 'vscode';
import {
  ACTION_LABEL,
  Action,
  SERVICE_IDS,
  SERVICE_LABEL,
  ServiceId,
  control,
  controlAll,
  getStatus,
  hasService,
  isInstalled,
  laragonPath,
  serviceFlags,
} from './laragon';

type Busy = ServiceId | 'all' | null;

export class DashboardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'laragonController.dashboard';

  private view?: vscode.WebviewView;
  private timer?: ReturnType<typeof setInterval>;
  private busy: Busy = null;

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.render(view.webview);

    view.webview.onDidReceiveMessage((message) => void this.onMessage(message));
    view.onDidChangeVisibility(() => (view.visible ? this.startPolling() : this.stopPolling()));
    view.onDidDispose(() => {
      this.stopPolling();
      this.view = undefined;
    });

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('laragonController') && this.view) {
        this.view.webview.html = this.render(this.view.webview);
      }
    });

    this.startPolling();
  }

  refreshNow(): void {
    void this.refresh();
  }

  private startPolling(): void {
    this.stopPolling();
    const interval = vscode.workspace.getConfiguration('laragonController').get<number>('pollingInterval', 3000);
    this.timer = setInterval(() => void this.refresh(), Math.max(1000, interval));
    void this.refresh();
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    const installed = isInstalled();
    void this.view.webview.postMessage({
      type: 'state',
      installed,
      laragonPath: laragonPath(),
      busy: this.busy,
      status: installed ? await getStatus() : null,
    });
  }

  private async onMessage(message: {
    type?: string;
    action?: Action;
    service?: ServiceId;
    name?: string;
  }): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'refresh':
        await this.refresh();
        return;
      case 'shortcut':
        await vscode.commands.executeCommand(`laragonController.${message.name}`);
        return;
      case 'command':
        if (message.action) {
          await this.runAction(message.action, message.service);
        }
        return;
    }
  }

  private rerender(): void {
    if (this.view) {
      this.view.webview.html = this.render(this.view.webview);
    }
  }

  private async runAction(action: Action, service?: ServiceId): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = service ?? 'all';
    await this.refresh();
    try {
      if (service) {
        await control(action, service);
      } else {
        await controlAll(action);
      }
      const target = service ? SERVICE_LABEL[service] : 'all services';
      vscode.window.showInformationMessage(`Laragon: ${ACTION_LABEL[action]} ${target}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Laragon: ${(err as Error).message}`);
    } finally {
      this.busy = null;
      await this.refresh();
    }
  }

  private render(webview: vscode.Webview): string {
    const nonce = nonce32();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');
    const cfg = vscode.workspace.getConfiguration('laragonController');

    const flags = serviceFlags();
    const installed = SERVICE_IDS.filter((id) => hasService(id));
    const serviceList = JSON.stringify(installed.map((id) => ({ id, label: SERVICE_LABEL[id], enabled: flags[id] })));

    const shortcuts: { id: string; label: string }[] = [];
    if (cfg.get<boolean>('enableOpenLocalhost', true)) shortcuts.push({ id: 'launchWeb', label: 'Open localhost' });
    if (cfg.get<boolean>('enablePhpMyAdmin', true)) shortcuts.push({ id: 'openDatabaseManager', label: 'phpMyAdmin' });
    if (cfg.get<boolean>('enableHeidiSql', true)) shortcuts.push({ id: 'openHeidiSql', label: 'HeidiSQL' });
    if (cfg.get<boolean>('enableAdminer', true)) shortcuts.push({ id: 'openAdminer', label: 'Adminer' });
    if (cfg.get<boolean>('enableOpenWww', true)) shortcuts.push({ id: 'openRoot', label: 'Open www' });
    if (cfg.get<boolean>('enableTerminal', true)) shortcuts.push({ id: 'openTerminal', label: 'Terminal' });
    const shortcutList = JSON.stringify(shortcuts);

    const shortcutsHtml = shortcuts
      .map(
        (s) =>
          `<button type="button" data-shortcut="${s.id}">${s.label}</button>`
      )
      .join('');
    const allEnabled = cfg.get<boolean>('enableStartAll', true);
    const allSection = allEnabled
      ? `<div class="section">
    <div class="section-title">All services</div>
    <div class="actions">
      <button class="primary" type="button" data-action="start">Start All</button>
      <button type="button" data-action="stop">Stop All</button>
      <button type="button" data-action="restart">Restart All</button>
    </div>
  </div>`
      : '';
    const shortcutsSection = shortcuts.length
      ? `<div class="section">
    <div class="section-title">Shortcuts</div>
    <div class="shortcuts">${shortcutsHtml}</div>
  </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 10px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: transparent;
  }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  .title { font-weight: 600; }
  .header-actions { display: flex; gap: 4px; }
  .section { margin-bottom: 14px; }
  .section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
  }
  button {
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 5px 8px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ffffff);
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
  button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  button.icon {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    background: transparent;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
  }
  button.icon:hover { background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1)); }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .actions button { flex: 1 1 auto; }
  .service {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--vscode-sideBarSectionHeader-background, transparent);
  }
  .service + .service { margin-top: 4px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; background: #f44336; }
  .dot.running { background: #4caf50; }
  .dot.unknown { background: #ffc107; }
  .dot.busy { background: #ffc107; }
  .service .name { flex: 1 1 auto; font-size: 12px; }
  .service .controls { display: flex; gap: 4px; }
  .service .controls button { padding: 3px 6px; font-size: 11px; }
  .shortcuts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .shortcuts button { width: 100%; text-align: left; }
  .notice {
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 12px;
    background: var(--vscode-inputValidation-warningBackground, rgba(255, 193, 7, 0.15));
    border: 1px solid var(--vscode-inputValidation-warningBorder, #ffc107);
    color: var(--vscode-foreground);
  }
  .notice code { font-family: var(--vscode-editor-font-family, monospace); }
  .hidden { display: none; }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <span class="title">Laragon Controller</span>
    <span class="header-actions">
      <button id="settings" type="button" class="icon" title="Open Laragon Controller settings" aria-label="Open settings">&#9881;</button>
      <button id="refresh" type="button" class="icon" title="Refresh status" aria-label="Refresh status">&#8635;</button>
    </span>
  </div>

  <div id="notfound" class="notice hidden" role="alert"></div>

  ${allSection}

  <div class="section">
    <div class="section-title">Services</div>
    <div id="services"></div>
  </div>

  ${shortcutsSection}

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const SERVICES = ${serviceList};

  const servicesEl = document.getElementById('services');
  const notFoundEl = document.getElementById('notfound');

  function renderServices() {
    servicesEl.textContent = '';
    SERVICES.filter(function (s) { return s.enabled; }).forEach(function (service) {
      const row = document.createElement('div');
      row.className = 'service';
      row.dataset.service = service.id;

      const dot = document.createElement('span');
      dot.className = 'dot unknown';

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = service.label;

      const controls = document.createElement('span');
      controls.className = 'controls';
      ['start', 'stop', 'restart'].forEach(function (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = action.charAt(0).toUpperCase() + action.slice(1);
        controls.appendChild(button);
      });

      row.append(dot, name, controls);
      servicesEl.appendChild(row);
    });
  }

  function applyState(state) {
    notFoundEl.classList.toggle('hidden', state.installed);
    if (!state.installed) {
      notFoundEl.textContent = 'Laragon not found at ';
      const code = document.createElement('code');
      code.textContent = state.laragonPath;
      notFoundEl.appendChild(code);
      notFoundEl.appendChild(document.createTextNode('. Update the "laragonController.laragonPath" setting.'));
    }

    const busy = state.busy;
    document.querySelectorAll('.service').forEach(function (row) {
      const id = row.dataset.service;
      const state_ = state.status ? state.status[id] : 'unknown';
      const rowBusy = busy === 'all' || busy === id;
      row.querySelector('.dot').className = 'dot ' + (rowBusy ? 'busy' : state_);
      row.querySelectorAll('button').forEach(function (button) {
        button.disabled = !state.installed || !!busy;
      });
    });

    document.querySelectorAll('.actions button').forEach(function (button) {
      button.disabled = !state.installed || !!busy;
    });
  }

  document.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) {
      return;
    }
    if (button.id === 'refresh') {
      vscode.postMessage({ type: 'refresh' });
      return;
    }
    if (button.id === 'settings') {
      vscode.postMessage({ type: 'shortcut', name: 'openSettings' });
      return;
    }
    if (button.dataset.shortcut) {
      vscode.postMessage({ type: 'shortcut', name: button.dataset.shortcut });
      return;
    }
    if (button.dataset.action) {
      const row = button.closest('.service');
      vscode.postMessage({ type: 'command', action: button.dataset.action, service: row ? row.dataset.service : undefined });
    }
  });

  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'state') {
      applyState(event.data);
    }
  });

  renderServices();
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function nonce32(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
