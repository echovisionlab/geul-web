import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { Code, createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { ArtistService as PublicArtistService } from '@echovisionlab/geul-proto/public/artist_pb.ts';
import { CategoryService as PublicCategoryService } from '@echovisionlab/geul-proto/public/category_pb.ts';
import { ClientService as PublicClientService } from '@echovisionlab/geul-proto/public/client_pb.ts';
import { FileService as PublicFileService } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { FormService as PublicFormService } from '@echovisionlab/geul-proto/public/form_pb.ts';
import { LabelService as PublicLabelService } from '@echovisionlab/geul-proto/public/label_pb.ts';
import { ManifestService } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import { MapPlaceService as PublicMapPlaceService } from '@echovisionlab/geul-proto/public/map_place_pb.ts';
import { MapThemeService as PublicMapThemeService } from '@echovisionlab/geul-proto/public/map_theme_pb.ts';
import { PageService as PublicPageService } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { PostService as PublicPostService } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { PrivacyService as PublicPrivacyService } from '@echovisionlab/geul-proto/public/privacy_pb.ts';
import {
  ProgramEventSeriesService as PublicProgramEventSeriesService,
  ProgramEventService as PublicProgramEventService,
  ProgramEventTypeService as PublicProgramEventTypeService,
} from '@echovisionlab/geul-proto/public/program_event_pb.ts';
import { ReleaseService as PublicReleaseService } from '@echovisionlab/geul-proto/public/release_pb.ts';
import { SeriesService as PublicSeriesService } from '@echovisionlab/geul-proto/public/series_pb.ts';
import { ShareLinkService as PublicShareLinkService } from '@echovisionlab/geul-proto/public/share_link_pb.ts';
import { SitemapService as PublicSitemapService } from '@echovisionlab/geul-proto/public/sitemap_pb.ts';
import { NewsletterService as PublicNewsletterService } from '@echovisionlab/geul-proto/public/newsletter_pb.ts';
import { TagService as PublicTagService } from '@echovisionlab/geul-proto/public/tag_pb.ts';
import { TermsService as PublicTermsService } from '@echovisionlab/geul-proto/public/terms_pb.ts';
import { AccountService as PublicAccountService } from '@echovisionlab/geul-proto/public/account_pb.ts';
import { MemberService as PublicMemberService } from '@echovisionlab/geul-proto/public/member_pb.ts';
import { WorkService as PublicWorkService } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { AdminService } from '@echovisionlab/geul-proto/secure/admin_pb.ts';
import { ArtistService } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { MemberCriteriaService } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { CampaignService } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { CategoryService } from '@echovisionlab/geul-proto/secure/category_pb.ts';
import { ClientService } from '@echovisionlab/geul-proto/secure/client_pb.ts';
import { CommentService } from '@echovisionlab/geul-proto/secure/comment_pb.ts';
import { EmailLayoutService } from '@echovisionlab/geul-proto/secure/email_layout_pb.ts';
import { EmailSuppressionService } from '@echovisionlab/geul-proto/secure/email_suppression_pb.ts';
import { EmailTemplateService } from '@echovisionlab/geul-proto/secure/email_template_pb.ts';
import { FileService } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { LinkPreviewService } from '@echovisionlab/geul-proto/secure/link_preview_pb.ts';
import { FormService } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { FormatService } from '@echovisionlab/geul-proto/secure/format_pb.ts';
import { GenreService } from '@echovisionlab/geul-proto/secure/genre_pb.ts';
import { LabelService } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { MailAdapterService } from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import { MapPlaceService } from '@echovisionlab/geul-proto/secure/map_place_pb.ts';
import { MapThemeService } from '@echovisionlab/geul-proto/secure/map_theme_pb.ts';
import { MenuService } from '@echovisionlab/geul-proto/secure/menu_pb.ts';
import { PageService } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { PostService } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { PrivacyService } from '@echovisionlab/geul-proto/secure/privacy_pb.ts';
import {
  ProgramEventSeriesService,
  ProgramEventService,
  ProgramEventTypeService,
} from '@echovisionlab/geul-proto/secure/program_event_pb.ts';
import { ReleaseService } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import { SeriesService } from '@echovisionlab/geul-proto/secure/series_pb.ts';
import { ShareLinkService } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { SiteSettingService } from '@echovisionlab/geul-proto/secure/site_setting_pb.ts';
import { StyleService } from '@echovisionlab/geul-proto/secure/style_pb.ts';
import { TagService } from '@echovisionlab/geul-proto/secure/tag_pb.ts';
import { TermsService } from '@echovisionlab/geul-proto/secure/terms_pb.ts';
import { TrackService } from '@echovisionlab/geul-proto/secure/track_pb.ts';
import { TranslationService } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { AccountService } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { MemberService } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import { WorkService } from '@echovisionlab/geul-proto/secure/work_pb.ts';
import { forwardIncomingRequestMetadataHeaders } from '@/lib/api/request-metadata-headers';
import { parseEditorWriteToken } from '@/lib/editor/editor-write-token';
import { buildCookieHeader } from '@/lib/auth/session-cookie';
import { clearInvalidSessionCookie } from '@/lib/auth/invalid-session-cookie';
import { isConnectErrorCode } from '@/lib/api/connect-error';
import { getApiUrl, getSessionCookieName } from '@/lib/env';
import { getRequestHeaders } from '@/lib/utils/header.server';

// Create transport for public API requests (no auth needed)
function createPublicTransport(acceptLanguageOverride?: string | null) {
  return createConnectTransport({
    baseUrl: getApiUrl(),
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      const headersList = await getRequestHeaders();
      forwardIncomingRequestMetadataHeaders(headers, headersList);
      headers.delete('Cookie');
      if (acceptLanguageOverride) {
        headers.set('Accept-Language', acceptLanguageOverride);
      }
      return fetch(input, {
        ...init,
        headers,
        cache: 'no-store',
      });
    },
  });
}

const getServerCookieHeader = cache(async (): Promise<string> => {
  const cookieStore = await cookies();
  return buildCookieHeader(cookieStore.getAll());
});

const hasServerSessionCookie = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const sessionCookieName = getSessionCookieName();
  return cookieStore.getAll().some((cookie) => cookie.name === sessionCookieName);
});

/**
 * Every server request to the API funnels through here, so a lost session is handled once instead
 * of in each Server Action. A 401 alone does not prove the session ended, so the current session is
 * checked once per request; when it is gone the cookie is deleted. Deleting a cookie in a Server
 * Action makes Next re-render the page and its layouts: signed-in layouts redirect to sign in and
 * the session provider receives the signed-out state.
 */
// The session read itself already clears the cookie when it is rejected (getSessionFromCookie).
function isCurrentSessionRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return url.endsWith('/GetCurrentSession');
}

const confirmSessionLoss = cache(async (): Promise<void> => {
  const transport = await createServerTransport({ confirmSessionLoss: false });
  try {
    await createClient(MemberService, transport).getCurrentSession({});
  } catch (error) {
    if (isConnectErrorCode(error, Code.Unauthenticated)) {
      await clearInvalidSessionCookie();
    }
  }
});

// Create transport for server-side requests (SSR, Server Components)
// Forwards session cookies to the Go API for Kratos auth
async function createServerTransport(options?: {
  acceptLanguageOverride?: string | null;
  authOptional?: boolean;
  editorOrigin?: string;
  confirmSessionLoss?: boolean;
}) {
  const cookieHeader = await getServerCookieHeader();
  const headersList = await getRequestHeaders();
  const acceptLanguage = options?.acceptLanguageOverride ?? headersList.get('accept-language');

  const buildHeaders = (initHeaders: HeadersInit | undefined, includeCookie: boolean) => {
    const headers = new Headers(initHeaders);
    forwardIncomingRequestMetadataHeaders(headers, headersList);
    if (options?.editorOrigin) {
      const { origin, expectedMember } = parseEditorWriteToken(options.editorOrigin);
      headers.set('Geul-Client-Origin', origin);
      if (expectedMember) {
        headers.set('Geul-Expected-Member', expectedMember);
      }
    }
    if (includeCookie && cookieHeader) {
      headers.set('Cookie', cookieHeader);
    } else {
      headers.delete('Cookie');
    }
    if (acceptLanguage) {
      headers.set('Accept-Language', acceptLanguage);
    }
    return headers;
  };

  return createConnectTransport({
    baseUrl: getApiUrl(),
    fetch: async (input, init) => {
      const response = await fetch(input, {
        ...init,
        headers: buildHeaders(init?.headers, true),
        cache: 'no-store',
      });

      if (
        response.status === 401 &&
        options?.confirmSessionLoss !== false &&
        !isCurrentSessionRequest(input) &&
        (await hasServerSessionCookie())
      ) {
        await confirmSessionLoss();
      }

      if (options?.authOptional && cookieHeader && (response.status === 401 || response.status === 403)) {
        return fetch(input, {
          ...init,
          headers: buildHeaders(init?.headers, false),
          cache: 'no-store',
        });
      }

      return response;
    },
  });
}

// Public API clients (no auth required, but forwards cookies for optional auth)
export async function createManifestClient(acceptLanguageOverride?: string | null) {
  return createClient(ManifestService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicManifestClient(acceptLanguageOverride?: string | null) {
  return createClient(ManifestService, createPublicTransport(acceptLanguageOverride));
}

export async function createPublicFileClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicFileService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicPageClient() {
  return createClient(PublicPageService, createPublicTransport());
}

export async function createPublicPageClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicPageService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicPostClient() {
  return createClient(PublicPostService, createPublicTransport());
}

export async function createPublicPostClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicPostService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicProgramEventClient() {
  return createClient(PublicProgramEventService, createPublicTransport());
}

export async function createPublicProgramEventClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(
    PublicProgramEventService,
    await createServerTransport({ acceptLanguageOverride, authOptional: true }),
  );
}

export async function createPublicProgramEventTypeClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(
    PublicProgramEventTypeService,
    await createServerTransport({ acceptLanguageOverride, authOptional: true }),
  );
}

export async function createPublicProgramEventSeriesClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(
    PublicProgramEventSeriesService,
    await createServerTransport({ acceptLanguageOverride, authOptional: true }),
  );
}

export function createPublicCategoryClient() {
  return createClient(PublicCategoryService, createPublicTransport());
}

export function createPublicArtistClient() {
  return createClient(PublicArtistService, createPublicTransport());
}

export async function createPublicArtistClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicArtistService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicTagClient() {
  return createClient(PublicTagService, createPublicTransport());
}

export function createPublicWorkClient() {
  return createClient(PublicWorkService, createPublicTransport());
}

export async function createPublicWorkClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicWorkService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicReleaseClient() {
  return createClient(PublicReleaseService, createPublicTransport());
}

export function createPublicSeriesClient() {
  return createClient(PublicSeriesService, createPublicTransport());
}

export async function createPublicSeriesClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicSeriesService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export async function createPublicReleaseClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(
    PublicReleaseService,
    await createServerTransport({ acceptLanguageOverride, authOptional: true }),
  );
}

export async function createPublicLabelClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicLabelService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export async function createPublicClientClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicClientService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export async function createPublicFormClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicFormService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicNewsletterClient() {
  return createClient(PublicNewsletterService, createPublicTransport());
}

export function createPublicMemberClient() {
  return createClient(PublicMemberService, createPublicTransport());
}

export function createPublicAccountClient() {
  return createClient(PublicAccountService, createPublicTransport());
}

export function createPublicShareLinkClient() {
  return createClient(PublicShareLinkService, createPublicTransport());
}

export function createPublicSitemapClient() {
  return createClient(PublicSitemapService, createPublicTransport());
}

export function createPublicMapPlaceClient() {
  return createClient(PublicMapPlaceService, createPublicTransport());
}

export async function createPublicMapPlaceClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(
    PublicMapPlaceService,
    await createServerTransport({ acceptLanguageOverride, authOptional: true }),
  );
}

export async function createPublicPrivacyClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(
    PublicPrivacyService,
    await createServerTransport({ acceptLanguageOverride, authOptional: true }),
  );
}

export async function createPublicTermsClientWithAuth(acceptLanguageOverride?: string | null) {
  return createClient(PublicTermsService, await createServerTransport({ acceptLanguageOverride, authOptional: true }));
}

export function createPublicMapThemeClient() {
  return createClient(PublicMapThemeService, createPublicTransport());
}

// Create a new client for each server request (to avoid sharing state)
export async function createArtistClient() {
  return createClient(ArtistService, await createServerTransport());
}

export async function createFileClient(editorOrigin?: string) {
  return createClient(FileService, await createServerTransport({ editorOrigin }));
}

export async function createLinkPreviewClient() {
  return createClient(LinkPreviewService, await createServerTransport());
}

export async function createLabelClient() {
  return createClient(LabelService, await createServerTransport());
}

export async function createReleaseClient(editorOrigin?: string) {
  return createClient(ReleaseService, await createServerTransport({ editorOrigin }));
}

export async function createMemberClient() {
  return createClient(MemberService, await createServerTransport());
}

export async function createAccountClient() {
  return createClient(AccountService, await createServerTransport());
}

export async function createWorkClient(editorOrigin?: string) {
  return createClient(WorkService, await createServerTransport({ editorOrigin }));
}

export async function createCategoryClient() {
  return createClient(CategoryService, await createServerTransport());
}

export async function createFormClient() {
  return createClient(FormService, await createServerTransport());
}

export async function createMenuClient() {
  return createClient(MenuService, await createServerTransport());
}

export async function createPageClient(editorOrigin?: string) {
  return createClient(PageService, await createServerTransport({ editorOrigin }));
}

export async function createPostClient(editorOrigin?: string) {
  return createClient(PostService, await createServerTransport({ editorOrigin }));
}

export async function createProgramEventClient(editorOrigin?: string) {
  return createClient(ProgramEventService, await createServerTransport({ editorOrigin }));
}

export async function createProgramEventSeriesClient() {
  return createClient(ProgramEventSeriesService, await createServerTransport());
}

export async function createProgramEventTypeClient() {
  return createClient(ProgramEventTypeService, await createServerTransport());
}

export async function createTagClient() {
  return createClient(TagService, await createServerTransport());
}

export async function createGenreClient() {
  return createClient(GenreService, await createServerTransport());
}

export async function createStyleClient() {
  return createClient(StyleService, await createServerTransport());
}

export async function createFormatClient() {
  return createClient(FormatService, await createServerTransport());
}

export async function createSeriesClient() {
  return createClient(SeriesService, await createServerTransport());
}

export async function createClientClient() {
  return createClient(ClientService, await createServerTransport());
}

export async function createPrivacyClient() {
  return createClient(PrivacyService, await createServerTransport());
}

export async function createTermsClient() {
  return createClient(TermsService, await createServerTransport());
}

export async function createMapPlaceClient() {
  return createClient(MapPlaceService, await createServerTransport());
}

export async function createTrackClient(editorOrigin?: string) {
  return createClient(TrackService, await createServerTransport({ editorOrigin }));
}

export async function createTranslationClient() {
  return createClient(TranslationService, await createServerTransport());
}

export async function createMapThemeClient() {
  return createClient(MapThemeService, await createServerTransport());
}

export async function createEmailTemplateClient(editorOrigin?: string) {
  return createClient(EmailTemplateService, await createServerTransport({ editorOrigin }));
}

export async function createEmailLayoutClient(editorOrigin?: string) {
  return createClient(EmailLayoutService, await createServerTransport({ editorOrigin }));
}

export async function createEmailSuppressionClient() {
  return createClient(EmailSuppressionService, await createServerTransport());
}

export async function createCommentClient() {
  return createClient(CommentService, await createServerTransport());
}

export async function createCampaignClient(editorOrigin?: string) {
  return createClient(CampaignService, await createServerTransport({ editorOrigin }));
}

export async function createSiteSettingClient() {
  return createClient(SiteSettingService, await createServerTransport());
}

export async function createAdminClient() {
  return createClient(AdminService, await createServerTransport());
}

export async function createShareLinkClient() {
  return createClient(ShareLinkService, await createServerTransport());
}

export async function createMemberCriteriaClient() {
  return createClient(MemberCriteriaService, await createServerTransport());
}

export async function createMailAdapterClient() {
  return createClient(MailAdapterService, await createServerTransport());
}
