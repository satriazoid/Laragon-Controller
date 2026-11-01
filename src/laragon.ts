import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as services from './services';

export type ServiceId = services.ServiceId;
export type Status = services.Status;
export type Action = services.Action;

export const SERVICE_IDS = services.SERVICE_IDS;
export const SERVICE_LABEL = services.SERVICE_LABEL;
export const ACTION_LABEL = services.ACTION_LABEL;

export function serviceFlags(): services.ServiceFlags {
  const cfg = vscode.workspace.getConfiguration('laragonController');
  const legacy = cfg.get<Partial<services.ServiceFlags>>('services') ?? {};
  const flags = {} as services.ServiceFlags;
  for (const id of SERVICE_IDS) {
    const individual = cfg.get<boolean>(`enableService.${id}`);
    flags[id] = individual ?? legacy[id] ?? services.SERVICE_DEFAULT_ENABLED[id];
  }
  return flags;
}

export function enabledServices(): ServiceId[] {
  return services.enabledServices(serviceFlags());
}

export function laragonPath(): string {
  return vscode.workspace.getConfiguration('laragonController').get<string>('laragonPath', 'C:/laragon');
}

export function laragonExe(): string {
  return path.join(laragonPath(), 'laragon.exe');
}

export function wwwPath(): string {
  return path.join(laragonPath(), 'www');
}

export function isInstalled(): boolean {
  return fs.existsSync(laragonPath());
}

export function hasService(id: ServiceId): boolean {
  return services.hasService(laragonPath(), id);
}

export function getStatus(): Promise<Status> {
  return services.getStatus(laragonPath());
}

export async function control(action: Action, id: ServiceId): Promise<void> {
  const root = laragonPath();
  if (action === 'start') {
    await services.start(root, id);
  } else if (action === 'stop') {
    await services.stop(root, id);
  } else {
    await services.restart(root, id);
  }
}

export async function controlAll(action: Action): Promise<void> {
  const root = laragonPath();
  if (action === 'restart') {
    await controlAll('stop');
    await controlAll('start');
    return;
  }
  const active = enabledServices();
  const ids = action === 'stop' ? [...active].reverse() : active;
  for (const id of ids) {
    if (services.hasService(root, id)) {
      await control(action, id);
    }
  }
}
