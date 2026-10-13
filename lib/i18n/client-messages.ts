import type { getMessagesForLocale } from './messages';
import {
  CLIENT_MESSAGE_SCOPES,
  resolveClientMessageScope,
  type ClientMessageCoverage,
  type ClientMessageScope,
} from './client-message-scope';
import { CLIENT_MESSAGE_SCOPE_PATHS } from './client-message-scopes.generated';

type Messages = Awaited<ReturnType<typeof getMessagesForLocale>>;
export type ClientMessages = Messages;

// The client catalogue is RSC data inlined in every HTML document, so each route group ships only
// the message paths its client components can request (lib/i18n/client-message-scopes.generated.ts,
// produced by static analysis of client-reachable modules; see docs/i18n.md). Server components
// read the complete catalogue from i18n/request.ts and are not affected.

function isPathCovered(path: string, selected: readonly string[]): boolean {
  return selected.some((candidate) => path === candidate || path.startsWith(`${candidate}.`));
}

// Scope A covers scope B when A's selection contains every path B needs; client navigation within
// covered scopes keeps the inlined catalogue, other navigation loads the complete one.
const SCOPE_COVERAGE = {} as Record<ClientMessageScope, readonly ClientMessageScope[]>;
for (const scope of CLIENT_MESSAGE_SCOPES) {
  SCOPE_COVERAGE[scope] = CLIENT_MESSAGE_SCOPES.filter((target) =>
    CLIENT_MESSAGE_SCOPE_PATHS[target].every((path) => isPathCovered(path, CLIENT_MESSAGE_SCOPE_PATHS[scope])),
  );
}

/** Scopes whose client components the catalogue selected for `pathWithSearch` can serve. */
export function clientMessageCoverage(pathWithSearch: string): ClientMessageCoverage {
  const scope = resolveClientMessageScope(pathWithSearch);
  return scope ? SCOPE_COVERAGE[scope] : 'all';
}

/** Copies the given dotted sub-trees of `messages` without mutating it. */
export function pickMessagePaths(messages: Messages, paths: readonly string[]): Partial<Messages> {
  const selected: Record<string, unknown> = {};
  for (const path of paths) {
    const segments = path.split('.');
    let source: unknown = messages;
    let target = selected;
    for (const [index, segment] of segments.entries()) {
      if (!source || typeof source !== 'object' || !(segment in source)) {
        break;
      }
      source = (source as Record<string, unknown>)[segment];
      if (index === segments.length - 1) {
        target[segment] = source;
      } else {
        const next = target[segment];
        target = (target[segment] = next && typeof next === 'object' ? next : {}) as Record<string, unknown>;
      }
    }
  }
  return selected as Partial<Messages>;
}

// Locale catalogues are module constants, so each (catalogue, scope) selection is built once.
const selections = new WeakMap<Messages, Map<ClientMessageScope, Partial<Messages>>>();

export function selectClientMessages(messages: Messages, context: { pathWithSearch: string }): Partial<Messages> {
  const scope = resolveClientMessageScope(context.pathWithSearch);
  if (!scope) {
    return messages;
  }
  let byScope = selections.get(messages);
  if (!byScope) {
    byScope = new Map();
    selections.set(messages, byScope);
  }
  let selected = byScope.get(scope);
  if (!selected) {
    selected = pickMessagePaths(messages, CLIENT_MESSAGE_SCOPE_PATHS[scope]);
    byScope.set(scope, selected);
  }
  return selected;
}
