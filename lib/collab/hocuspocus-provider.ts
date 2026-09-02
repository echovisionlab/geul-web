import type { HocuspocusProvider } from '@hocuspocus/provider';

/**
 * Preserve the resident socket when updating provider configuration.
 * HocuspocusProvider creates a new websocket provider when setConfiguration
 * receives no websocketProvider, even if the provider already owns one.
 */
export function setHocuspocusResumeToken(provider: HocuspocusProvider, token: string): void {
  provider.setConfiguration({
    token,
    websocketProvider: provider.configuration.websocketProvider,
  });
}
