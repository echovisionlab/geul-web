import type { getMessagesForLocale } from './messages';

type Messages = Awaited<ReturnType<typeof getMessagesForLocale>>;
export type ClientMessages = Messages;

// Restrict the smaller catalogue to audited anonymous routes. Other routes and
// authenticated sessions retain the full catalogue, including editor dialogs.
const PUBLIC_ROUTES = new Set(['/', '/privacy', '/terms', '/works', '/tools', '/tools/transcode']);
// These entity details also fall back to the read-only Page renderer. Arbitrary
// Page slugs cannot be distinguished from other routes here, so stay full.
const PUBLIC_DETAIL_ROUTE = /^\/(posts|works|releases|artists)\/[^/]+$/;
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
  return (
    (PUBLIC_ROUTES.has(url.pathname) || PUBLIC_DETAIL_ROUTE.test(url.pathname)) &&
    !url.searchParams.getAll('edit').includes('true')
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
