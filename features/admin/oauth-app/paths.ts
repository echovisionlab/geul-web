/** Admin routes of OAuth apps. Client IDs of connected AI tools are URLs, so each ID is one encoded segment. */
export const OAUTH_APPS_PATH = '/admin/oauth-apps';
export const NEW_OAUTH_APP_PATH = `${OAUTH_APPS_PATH}/new`;

export function oauthAppPath(clientId: string): string {
  return `${OAUTH_APPS_PATH}/apps/${encodeURIComponent(clientId)}`;
}

export function connectedToolPath(clientId: string): string {
  return `${OAUTH_APPS_PATH}/tools/${encodeURIComponent(clientId)}`;
}
