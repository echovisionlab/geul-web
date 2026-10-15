// Route groups ("scopes") for the client message catalogue. Client-safe: the root
// ClientMessagesProvider uses it on every navigation and the root layout uses it to select the
// catalogue. The route table is generated from app/ by `pnpm i18n:scopes`
// (scripts/i18n/client-message-scopes.mjs).

import { resolveClientMessageScopeForRoutes, type ClientMessageScope } from './client-message-route-match';
import { CLIENT_MESSAGE_ROUTES } from './client-message-routes.generated';

export {
  CLIENT_MESSAGE_SCOPES,
  coversClientMessageScope,
  type ClientMessageCoverage,
  type ClientMessageRouteTable,
  type ClientMessageScope,
} from './client-message-route-match';

/**
 * Scope of an internal path with search. `null` (complete catalogue) for anything that is not a
 * same-origin path. Every other path has the scope of the App Router page that serves it; a path
 * that no route pattern matches, such as `/forms/a/b` or `/oauth/help`, is a CMS Page served by
 * `app/(general)/[...slug]` (`public`, or `editor` for `?edit=true`).
 */
export function resolveClientMessageScope(pathWithSearch: string): ClientMessageScope | null {
  return resolveClientMessageScopeForRoutes(CLIENT_MESSAGE_ROUTES, pathWithSearch);
}
