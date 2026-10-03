// Compatibility exports. Browser consumers should import the matching domain leaf.
export { createAdminClient } from './browser/secure-admin';
export { createAIClient, createAIDocumentClient } from './browser/secure-ai';
export { createArtistClient } from './browser/secure-artist';
export { createClientClient } from './browser/secure-client';
export { createEmailLayoutClient } from './browser/secure-email-layout';
export { createFileClient } from './browser/secure-file';
export { createFormClient } from './browser/secure-form';
export { createLabelClient } from './browser/secure-label';
export { createMenuClient } from './browser/secure-menu';
export { createSeriesClient } from './browser/secure-series';
export { createSiteSettingClient } from './browser/secure-site-setting';
export { createPostClient } from './browser/secure-post';
export { createPageClient } from './browser/secure-page';
export { createReleaseClient } from './browser/secure-release';
export { createWorkClient } from './browser/secure-work';
export { createMemberClient } from './browser/secure-member';
export { createAccountClient } from './browser/secure-account';
export { createTranslationClient } from './browser/secure-translation';
export { createPublicPrivacyClient, createPublicPrivacyClientWithLocale } from './browser/public-privacy';
export { createPublicFileClient } from './browser/public-file';
export { createPublicTermsClient, createPublicTermsClientWithLocale } from './browser/public-terms';
export { createPublicPostClient, createPublicPostClientWithLocale } from './browser/public-post';
export {
  createPublicProgramEventClientWithLocale,
  createPublicProgramEventSeriesClientWithLocale,
  createPublicProgramEventTypeClientWithLocale,
} from './browser/public-program-event';
export { createPublicReleaseClient } from './browser/public-release';
export { createPublicWorkClient, createPublicWorkClientWithLocale } from './browser/public-work';
