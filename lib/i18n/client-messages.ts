import type { getMessagesForLocale } from './messages';

type Messages = Awaited<ReturnType<typeof getMessagesForLocale>>;
export type ClientMessages = Messages;

// Restrict the smaller catalogue to audited anonymous routes. Other routes and
// authenticated sessions retain the full catalogue, including editor dialogs.
const PUBLIC_ROUTES = new Set(['/', '/privacy', '/terms', '/works', '/tools', '/tools/transcode']);
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
  'programEventAdmin',
] as const satisfies readonly (keyof Messages)[];

export function isReducedCatalogueRoute(pathWithSearch: string): boolean {
  if (!pathWithSearch) {
    return false;
  }

  const url = new URL(pathWithSearch, 'http://internal');
  return PUBLIC_ROUTES.has(url.pathname) && url.searchParams.get('edit') !== 'true';
}

export function selectClientMessages(
  messages: Messages,
  context: { pathWithSearch: string; hasSession: boolean },
): Partial<Messages> {
  const url = new URL(context.pathWithSearch, 'http://internal');
  if (context.hasSession || !PUBLIC_ROUTES.has(url.pathname) || url.searchParams.get('edit') === 'true') {
    return messages;
  }

  const selected: Partial<Messages> = { ...messages };
  for (const namespace of PRIVATE_NAMESPACES) {
    delete selected[namespace];
  }
  // editorCommon also owns public media/executable messages, so retain it.
  return selected;
}
