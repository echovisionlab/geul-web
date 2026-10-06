import type { getMessagesForLocale } from './messages';

type Messages = Awaited<ReturnType<typeof getMessagesForLocale>>;
export type ClientMessages = Messages;

// Restrict the smaller catalogue to audited anonymous routes. Other routes and
// authenticated sessions retain the full catalogue, including editor dialogs.
const PUBLIC_ROUTES = new Set([
  '/',
  '/privacy',
  '/privacy/history',
  '/terms',
  '/terms/history',
  '/posts',
  '/works',
  '/artists',
  '/labels',
  '/releases',
  '/events',
  '/tools',
]);
// Each audited entity has exactly one identifier. Unknown Page slugs, extra
// segments and protected modes retain the full catalogue.
const PUBLIC_DETAIL_ENTITIES = new Set([
  'posts',
  'works',
  'releases',
  'artists',
  'labels',
  'events',
  'series',
  'event-series',
]);
const EXISTING_PUBLIC_ROUTES = new Set(['/', '/privacy', '/terms', '/works', '/tools']);
const EXISTING_PUBLIC_DETAIL_ENTITIES = new Set(['posts', 'works', 'releases', 'artists']);
const PROTECTED_QUERY_PARAMS = ['share', 'password', 'preview', 'token'] as const;

function isPublicIdentifier(segment: string): boolean {
  try {
    const decoded = decodeURIComponent(segment);
    return (
      decoded.length > 0 &&
      !decoded.includes('/') &&
      !decoded.includes('\\') &&
      !['.', '..', 'new', 'edit'].includes(decoded)
    );
  } catch {
    return false;
  }
}

function isPublicDetailRoute(pathname: string): boolean {
  const segments = pathname.split('/');
  if (segments.length === 3) {
    return PUBLIC_DETAIL_ENTITIES.has(segments[1]) && isPublicIdentifier(segments[2]);
  }
  return (
    segments.length === 4 &&
    ['privacy', 'terms'].includes(segments[1]) &&
    segments[2] === 'history' &&
    isPublicIdentifier(segments[3])
  );
}
const PRIVATE_NAMESPACES = [
  'adminShell',
  'adminList',
  'adminSettings',
  'adminUserDetail',
  'artistAdminDetail',
  'labelAdminDetail',
  'artistManagers',
  'workCollaborators',
  'auth',
  'security',
  'settings',
  'profile',
  'memberOnboarding',
  'formAdmin',
  'privacyEditor',
  'termsEditor',
  'legalEditorCommon',
  'releaseEditor',
  'editorMetadata',
  'editorHeader',
  'campaignEditor',
  'campaignAnalytics',
  'postEditor',
  'postParticipants',
  'workEditor',
  'pageEditor',
  'aiAssistant',
  'metadataPanel',
  'translationPanel',
  'translationPanelMenu',
  'translationPanelEmail',
  'translationOverviewPage',
  'translationJobsPage',
  'translationSettingsPage',
  'ogImagePreview',
  'ogImageSettings',
  'summaryField',
  'fileManager',
  'mapInsertModal',
  'createPlaceModal',
  'placeEditor',
] as const satisfies readonly (keyof Messages)[];

export function isReducedCatalogueRoute(pathWithSearch: string): boolean {
  if (!pathWithSearch.startsWith('/') || pathWithSearch.startsWith('//')) {
    return false;
  }

  const url = new URL(pathWithSearch, 'http://internal');
  const segments = url.pathname.split('/');
  const previouslyAudited =
    EXISTING_PUBLIC_ROUTES.has(url.pathname) ||
    (segments.length === 3 && EXISTING_PUBLIC_DETAIL_ENTITIES.has(segments[1]) && isPublicIdentifier(segments[2]));
  return (
    (PUBLIC_ROUTES.has(url.pathname) || isPublicDetailRoute(url.pathname)) &&
    !url.searchParams.getAll('edit').includes('true') &&
    !url.searchParams.getAll('view').includes('edit') &&
    (previouslyAudited || !PROTECTED_QUERY_PARAMS.some((parameter) => url.searchParams.has(parameter)))
  );
}

export function selectClientMessages(
  messages: Messages,
  context: { pathWithSearch: string; hasSession: boolean },
): Partial<Messages> {
  if (context.hasSession || !isReducedCatalogueRoute(context.pathWithSearch)) {
    return messages;
  }

  const selected: Partial<Messages> = { ...messages };
  for (const namespace of PRIVATE_NAMESPACES) {
    delete selected[namespace];
  }
  // editorCommon also owns public media/executable messages, so retain it.
  // programEventAdmin also owns public Page event-list labels, so retain it.
  return selected;
}
