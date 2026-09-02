import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { FileService as PublicFileService } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { PostService as PublicPostService } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { PrivacyService } from '@echovisionlab/geul-proto/public/privacy_pb.ts';
import {
  ProgramEventSeriesService as PublicProgramEventSeriesService,
  ProgramEventService as PublicProgramEventService,
  ProgramEventTypeService as PublicProgramEventTypeService,
} from '@echovisionlab/geul-proto/public/program_event_pb.ts';
import { ReleaseService as PublicReleaseService } from '@echovisionlab/geul-proto/public/release_pb.ts';
import { TermsService } from '@echovisionlab/geul-proto/public/terms_pb.ts';
import { WorkService as PublicWorkService } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { AdminService } from '@echovisionlab/geul-proto/secure/admin_pb.ts';
import { AIDocumentService, AIService } from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { ArtistService } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { ClientService } from '@echovisionlab/geul-proto/secure/client_pb.ts';
import { EmailLayoutService } from '@echovisionlab/geul-proto/secure/email_layout_pb.ts';
import { FileService } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { FormService } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { LabelService } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { MenuService } from '@echovisionlab/geul-proto/secure/menu_pb.ts';
import { PageService } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { PostService } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { ReleaseService } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import { SeriesService } from '@echovisionlab/geul-proto/secure/series_pb.ts';
import { SiteSettingService } from '@echovisionlab/geul-proto/secure/site_setting_pb.ts';
import { TranslationService } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { AccountService } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { MemberService } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import { WorkService } from '@echovisionlab/geul-proto/secure/work_pb.ts';
import { authenticatedBrowserFetch } from '@/lib/auth/session-events';

const BROWSER_RPC_BASE_URL = '/api/rpc';

// Browser transport with cookie credentials for authenticated requests
function createBrowserTransport() {
  return createConnectTransport({
    baseUrl: BROWSER_RPC_BASE_URL,
    fetch: authenticatedBrowserFetch,
  });
}

// ============================================
// Secure API clients (auth required via cookies)
// ============================================

export function createAdminClient() {
  return createClient(AdminService, createBrowserTransport());
}

export function createAIClient() {
  return createClient(AIService, createBrowserTransport());
}

export function createAIDocumentClient() {
  return createClient(AIDocumentService, createBrowserTransport());
}

export function createArtistClient() {
  return createClient(ArtistService, createBrowserTransport());
}

export function createClientClient() {
  return createClient(ClientService, createBrowserTransport());
}

export function createEmailLayoutClient() {
  return createClient(EmailLayoutService, createBrowserTransport());
}

export function createFileClient() {
  return createClient(FileService, createBrowserTransport());
}

export function createFormClient() {
  return createClient(FormService, createBrowserTransport());
}

export function createLabelClient() {
  return createClient(LabelService, createBrowserTransport());
}

export function createMenuClient() {
  return createClient(MenuService, createBrowserTransport());
}

export function createSeriesClient() {
  return createClient(SeriesService, createBrowserTransport());
}

export function createSiteSettingClient() {
  return createClient(SiteSettingService, createBrowserTransport());
}

export function createPostClient() {
  return createClient(PostService, createBrowserTransport());
}

export function createPageClient() {
  return createClient(PageService, createBrowserTransport());
}

export function createReleaseClient() {
  return createClient(ReleaseService, createBrowserTransport());
}

export function createWorkClient() {
  return createClient(WorkService, createBrowserTransport());
}

export function createMemberClient() {
  return createClient(MemberService, createBrowserTransport());
}

export function createAccountClient() {
  return createClient(AccountService, createBrowserTransport());
}

export function createTranslationClient() {
  return createClient(TranslationService, createBrowserTransport());
}

// ============================================
// Public API clients (no auth required)
// ============================================

// Public transport without credentials for public APIs
function createPublicBrowserTransport(acceptLanguageOverride?: string | null) {
  return createConnectTransport({
    baseUrl: BROWSER_RPC_BASE_URL,
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (acceptLanguageOverride) {
        headers.set('Accept-Language', acceptLanguageOverride);
      }
      return fetch(input, {
        ...init,
        headers,
      });
    },
  });
}

export function createPublicPrivacyClient() {
  return createClient(PrivacyService, createPublicBrowserTransport());
}

export function createPublicFileClient() {
  return createClient(PublicFileService, createPublicBrowserTransport());
}

export function createPublicPrivacyClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PrivacyService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicTermsClient() {
  return createClient(TermsService, createPublicBrowserTransport());
}

export function createPublicTermsClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(TermsService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicPostClient() {
  return createClient(PublicPostService, createPublicBrowserTransport());
}

export function createPublicPostClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicPostService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicProgramEventClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicProgramEventService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicProgramEventSeriesClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicProgramEventSeriesService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicProgramEventTypeClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicProgramEventTypeService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicReleaseClient() {
  return createClient(PublicReleaseService, createPublicBrowserTransport());
}

export function createPublicWorkClient() {
  return createClient(PublicWorkService, createPublicBrowserTransport());
}

export function createPublicWorkClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicWorkService, createPublicBrowserTransport(acceptLanguageOverride));
}
