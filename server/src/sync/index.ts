import { mockProvider } from './mock';
import type { SyncProvider } from './types';

const providers = new Map<string, SyncProvider>();

export function registerProvider(provider: SyncProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): SyncProvider | undefined {
  return providers.get(id);
}

export function listProviders(): SyncProvider[] {
  return [...providers.values()];
}

registerProvider(mockProvider);
