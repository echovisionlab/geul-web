import { editorRoutePreviews } from './editor-route-previews.mjs';
/** Explicit composition relationships, reviewed against the preview adapter and route source. */
export const routePreviews = [
  ...editorRoutePreviews,
  {
    route: '/admin/map/themes/[id]',
    storyTitle: 'Pages/Admin/Map Theme Editor',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/admin/menus',
    storyTitle: 'Pages/Admin/Menus',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/admin/series/[id]',
    storyTitle: 'Pages/Editors/Series',
    variant: 'Admin',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/my/series/[id]',
    storyTitle: 'Pages/Editors/Series',
    variant: 'Mine',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/campaigns/[id]',
    storyTitle: 'Pages/Editors/Campaign',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/admin/campaigns/[id]',
    storyTitle: 'Pages/Editors/Campaign',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/admin/email-layouts/[id]',
    storyTitle: 'Pages/Admin/Email Editors',
    variant: 'Layout',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/admin/email-templates/[id]',
    storyTitle: 'Pages/Admin/Email Editors',
    variant: 'Template',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },
  {
    route: '/admin/settings',
    storyTitle: 'Pages/Admin/Site Settings',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Complete shared production page composition with local data/callbacks. Live authorization, persistence, collaboration, external rendering and translation mutations remain outside; see the story description for fixture limits.',
  },

  {
    route: '/admin/map/places',
    storyTitle: 'Pages/Admin/Map Places',
    variant: 'List',
    coverage: 'page-view',
    scope:
      'Actual production list controller, query controls, creation dialog and local typed transport. External Google autocomplete and backend persistence/authorization remain outside.',
  },
  {
    route: '/admin/map/places/[id]',
    storyTitle: 'Pages/Admin/Map Places',
    variant: 'Detail',
    coverage: 'page-view',
    scope:
      'Actual production detail controller, PlaceEditor and complete metadata with typed local read/update/delete callbacks. Google map, geocoding and autocomplete services are outside the fixture.',
  },
  {
    route: '/admin/events',
    storyTitle: 'Pages/Admin/Program Event Lists',
    variant: 'Events',
    coverage: 'page-view',
    scope:
      'Actual production PageView, query table, selection/create and event type manager with typed local actions. Server authorization, event relations/publication and editor destinations remain outside.',
  },
  {
    route: '/admin/event-series',
    storyTitle: 'Pages/Admin/Program Event Lists',
    variant: 'Series',
    coverage: 'page-view',
    scope:
      'Actual production PageView, query table and local creation/deletion callbacks. Server permissions, related events and editor destination remain outside.',
  },
  {
    route: '/admin/users',
    storyTitle: 'Pages/Admin/Audience and Users',
    variant: 'Users',
    coverage: 'page-view',
    scope:
      'Actual production users PageView, table and original modal controllers with local ban/role/unsubscribe/delete callbacks. No real account mutations; server authorization and identity invariants are outside.',
  },
  {
    route: '/admin/audience-segments',
    storyTitle: 'Pages/Admin/Audience and Users',
    variant: 'Segments',
    coverage: 'page-view',
    scope:
      'Actual production segment PageView, query controls, estimate/create/edit/archive/restore dialogs with typed local transport. Server evaluation, relation constraints and persistence remain outside.',
  },
  {
    route: '/admin/settings/og-image',
    storyTitle: 'Pages/Admin/OG Image Settings',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual complete production settings controller, both panels, local save and typed run tracking. OG preview renderer image response and service generation remain outside.',
  },
  {
    route: '/admin/users/[id]',
    storyTitle: 'Pages/Admin/User Edit',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual complete production member detail controller and profile/security sections with local transport. Credential token issuance, SSO continuation, permissions and backend identity invariants remain outside.',
  },
  {
    route: '/admin/settings/mail',
    storyTitle: 'Pages/Admin/Mail Adapters',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual production adapter page and create/edit/test/delete dialogs with local typed transport. Mail delivery, server validation and credentials remain outside.',
  },
  {
    route: '/admin/email-layouts',
    storyTitle: 'Pages/Admin/Email Catalog',
    variant: 'Layouts',
    coverage: 'page-view',
    scope:
      'Actual production layout catalog, query controls, previews and create/delete dialogs with local typed transport. HTML preview uses local document data; authorization, persistence and the edit destination remain outside.',
  },
  {
    route: '/admin/email-templates',
    storyTitle: 'Pages/Admin/Email Catalog',
    variant: 'Templates',
    coverage: 'page-view',
    scope:
      'Actual production template catalog and event mapping controls with local typed transport. Delivery, authorization, persistence and the edit destination remain outside.',
  },
  {
    route: '/admin',
    storyTitle: 'Pages/Admin/Dashboard',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual dashboard controller and Core StatCards with typed local stats reader. Ready/zero/pending/error; authorization and live service counts remain outside.',
  },
  {
    route: '/admin/terms',
    storyTitle: 'Pages/Admin/Legal Policies',
    variant: 'Terms',
    coverage: 'page-view',
    scope:
      'Actual TermsListClient and shared LegalPolicyListClient with real status/search/selection/dialogs and local creation/deletion. Backend version/revision CAS, permissions and edit destination remain outside.',
  },
  {
    route: '/admin/privacy',
    storyTitle: 'Pages/Admin/Legal Policies',
    variant: 'Privacy',
    coverage: 'page-view',
    scope:
      'Actual PrivacyListClient and shared LegalPolicyListClient with privacy status/search/selection/dialogs and local creation/deletion. Backend version/revision CAS, permissions and edit destination remain outside.',
  },
  {
    route: '/admin/terms/new',
    storyTitle: 'Pages/Admin/Legal Policies',
    variant: 'TermsCreating',
    coverage: 'page-view',
    scope:
      'Actual shared PolicyVersionCreationPage used by the automatic draft creation route. Pending/success/error local action and recorded navigation. Local destination text is callback evidence only; server creation, persistence and destination editor are outside.',
  },
  {
    route: '/admin/privacy/new',
    storyTitle: 'Pages/Admin/Legal Policies',
    variant: 'PrivacyCreating',
    coverage: 'page-view',
    scope:
      'Actual shared PolicyVersionCreationPage used by the automatic draft creation route. Pending/success/error local action and recorded navigation. Local destination text is callback evidence only; server creation, persistence and destination editor are outside.',
  },
  {
    route: '/campaigns/[id]/analytics',
    storyTitle: 'Pages/Campaign/Analytics',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual CampaignAnalyticsPage controller, metrics, recipient states and pagination with typed local readers. Canonical route server access/fallback and live delivery persistence remain outside.',
  },
  {
    route: '/admin/campaigns/[id]/analytics',
    storyTitle: 'Pages/Campaign/Analytics',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual same CampaignAnalyticsPage owner used by admin alias, with typed local readers. Canonical/admin authorization and live delivery persistence remain outside.',
  },
  {
    route: '/admin/forms',
    storyTitle: 'Pages/Admin/Communication Lists',
    variant: 'Forms',
    coverage: 'page-view',
    scope:
      'Actual extracted production FormsPageView composition with original header/table/modal/pagination owners and local create/delete actions. Scalar fixture query transport; permission/publication/backend and destination edit pages remain outside.',
  },
  {
    route: '/admin/campaigns',
    storyTitle: 'Pages/Admin/Communication Lists',
    variant: 'Campaigns',
    coverage: 'page-view',
    scope:
      'Actual extracted production CampaignsPageView composition with original header/table/modal/pagination owners and local create/delete actions. Scalar fixture query transport; audience evaluation/sending/backend and destination edit pages remain outside.',
  },

  {
    route: '/admin/genres',
    storyTitle: 'Pages/Admin/Taxonomy',
    variant: 'Genres',
    coverage: 'page-view',
    scope:
      'Actual production domain PageView, table/query columns, CRUD dialogs and selection using typed local callbacks. Scalar/date filters, sorting and paging use fixture transport; authorization, backend validation, relation impacts and persistence remain outside. User-tag domain exposes create/delete only, matching production.',
  },
  {
    route: '/admin/formats',
    storyTitle: 'Pages/Admin/Taxonomy',
    variant: 'Formats',
    coverage: 'page-view',
    scope:
      'Actual production domain PageView, table/query columns, CRUD dialogs and selection using typed local callbacks. Scalar/date filters, sorting and paging use fixture transport; authorization, backend validation, relation impacts and persistence remain outside. User-tag domain exposes create/delete only, matching production.',
  },
  {
    route: '/admin/styles',
    storyTitle: 'Pages/Admin/Taxonomy',
    variant: 'Styles',
    coverage: 'page-view',
    scope:
      'Actual production domain PageView, table/query columns, CRUD dialogs and selection using typed local callbacks. Scalar/date filters, sorting and paging use fixture transport; authorization, backend validation, relation impacts and persistence remain outside. User-tag domain exposes create/delete only, matching production.',
  },
  {
    route: '/admin/categories',
    storyTitle: 'Pages/Admin/Taxonomy',
    variant: 'Categories',
    coverage: 'page-view',
    scope:
      'Actual production domain PageView, table/query columns, CRUD dialogs and selection using typed local callbacks. Scalar/date filters, sorting and paging use fixture transport; authorization, backend validation, relation impacts and persistence remain outside. User-tag domain exposes create/delete only, matching production.',
  },
  {
    route: '/admin/tags',
    storyTitle: 'Pages/Admin/Taxonomy',
    variant: 'Tags',
    coverage: 'page-view',
    scope:
      'Actual production domain PageView, table/query columns, CRUD dialogs and selection using typed local callbacks. Scalar/date filters, sorting and paging use fixture transport; authorization, backend validation, relation impacts and persistence remain outside. User-tag domain exposes create/delete only, matching production.',
  },
  {
    route: '/admin/user-tags',
    storyTitle: 'Pages/Admin/Taxonomy',
    variant: 'UserTags',
    coverage: 'page-view',
    scope:
      'Actual production domain PageView, table/query columns, CRUD dialogs and selection using typed local callbacks. Scalar/date filters, sorting and paging use fixture transport; authorization, backend validation, relation impacts and persistence remain outside. User-tag domain exposes create/delete only, matching production.',
  },
  {
    route: '/',
    storyTitle: 'Pages/Public/Documents',
    variant: 'Home',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/artists',
    storyTitle: 'Pages/Public/Documents',
    variant: 'ArtistsIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/labels',
    storyTitle: 'Pages/Public/Documents',
    variant: 'LabelsIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/releases',
    storyTitle: 'Pages/Public/Documents',
    variant: 'ReleasesIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/works',
    storyTitle: 'Pages/Public/Documents',
    variant: 'WorksIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/events',
    storyTitle: 'Pages/Public/Documents',
    variant: 'EventsIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/posts',
    storyTitle: 'Pages/Public/Documents',
    variant: 'PostsIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by this CMS route alias; route-specific pathname with validated rich-text section fixture. Home demonstrates the resolved CMS-page branch only. Backend-configured entity-list/other section kinds, missing/restricted branches, server queries and metadata remain outside; this is not the live entity listing.',
  },
  {
    route: '/login/error',
    storyTitle: 'Pages/Auth/Login Error',
    variant: 'Generic',
    coverage: 'page-view',
    scope:
      'Actual LoginErrorPageView production error/recovery branches using identity-error fixtures. No authentication, server account actions or telemetry.',
  },
  {
    route: '/changelog',
    storyTitle: 'Pages/Public/Utilities',
    variant: 'Changelog',
    coverage: 'page-view',
    scope:
      'Actual ChangelogPageView production release/list rendering using authored release data. Server authorization and filesystem loading remain outside.',
  },
  {
    route: '/sitemap',
    storyTitle: 'Pages/Public/Utilities',
    variant: 'Sitemap',
    coverage: 'page-view',
    scope:
      'Actual SitemapPageView production navigation/list surface. Application shell and server authorization remain outside.',
  },
  {
    route: '/terms/history',
    storyTitle: 'Pages/Legal/History',
    variant: 'Terms',
    coverage: 'page-view',
    scope:
      'Actual TermsHistoryClient production active/archived rows, period formatting and navigation with locale-specific seeded query data. Query transport/server fetch and failure recovery remain outside.',
  },
  {
    route: '/privacy/history',
    storyTitle: 'Pages/Legal/History',
    variant: 'Privacy',
    coverage: 'page-view',
    scope:
      'Actual PrivacyHistoryClient production active/archived rows, period formatting and navigation with locale-specific seeded query data. Query transport/server fetch and failure recovery remain outside.',
  },
  {
    route: '/my/profile',
    storyTitle: 'Pages/Account/Full Pages',
    variant: 'Profile',
    coverage: 'page-view',
    scope:
      'Actual complete MyProfilePageView heading and original ProfileForm controller with local nickname/profile mutation callbacks. Session projection, live identity persistence and account shell are outside.',
  },
  {
    route: '/my/security',
    storyTitle: 'Pages/Account/Full Pages',
    variant: 'Security',
    coverage: 'page-view',
    scope:
      'Actual complete MySecurityPageView and original SecurityForm sections, local session callbacks and local passkey flow read. Server freshness/access, OAuth and WebAuthn ceremonies and real deletion are outside.',
  },
  {
    route: '/my/settings',
    storyTitle: 'Pages/Account/Full Pages',
    variant: 'Settings',
    coverage: 'page-view',
    scope:
      'Actual complete MySettingsPageView with empty local backups, language/newsletter/cookie/token/MCP sections and local callbacks. Backup storage/navigation, server role/session projection, credentials and identity persistence are outside.',
  },
  {
    route: '/my/settings',
    storyTitle: 'Pages/Account/Full Pages',
    variant: 'SettingsWithLocalBackups',
    coverage: 'page-view',
    scope:
      'Actual MySettingsPageView placement with several orphan journal fixtures and local discard confirmation. Backup storage, liveness, editor navigation, server session/access and other settings persistence are outside.',
  },
  {
    route: '/series/[idOrSlug]',
    storyTitle: 'Pages/Public/Series',
    variant: 'Populated',
    scope:
      'Production SeriesPublicView and SeriesPublicPostsView composition; sample rows/local share dialog. Navigation is contained inside the preview; route read, SSR and permission behavior are outside.',
  },
  {
    route: '/verify',
    storyTitle: 'Pages/Auth/Verification',
    variant: 'Flow',
    scope:
      'Production VerificationFlowView with a local choose-email/code/applying/passed adapter. No identity issuance, delivery, session continuation or server verification.',
  },
  {
    route: '/s/[token]',
    storyTitle: 'Pages/Share/Password Gate',
    variant: 'Locked',
    scope:
      'Production SharePasswordView and local password validation. Token validation, expiry, access reason and entity destination controller remain outside.',
  },
  {
    route: '/login',
    storyTitle: 'Pages/Auth/Login',
    variant: 'Email',
    coverage: 'page-view',
    scope:
      'Actual LoginFlowView with local email/code/resend/start-over callbacks, invalid/expired/pending states. Identity issuance, passkeys, social providers and server sessions remain outside.',
  },
  {
    route: '/admin/map/themes',
    storyTitle: 'Pages/Admin/Map Themes',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual MapThemeListPageView including local copy form, deletion confirmation and default switching. Create action, navigation, persistence and admin permission checks remain outside.',
  },
  {
    route: '/event-series/[idOrSlug]',
    storyTitle: 'Pages/Public/Event Series',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual ProgramEventSeriesPublicView/EventSeriesEventsTableView with local search, load more and share callbacks; empty/loading/error states. Server filtering, edit branch, metadata and permissions remain outside.',
  },
  {
    route: '/works/[idOrSlug]',
    storyTitle: 'Pages/Public/Entity Detail',
    variant: 'Work',
    coverage: 'page-view',
    scope:
      'Actual WorkViewClient public detail header, metadata and credits, sparse/phone states. Fixtures intentionally have no rich text/media tree; edit, SSR, localization and signed delivery remain outside.',
  },
  {
    route: '/events/[idOrSlug]',
    storyTitle: 'Pages/Public/Entity Detail',
    variant: 'Event',
    coverage: 'page-view',
    scope:
      'Actual ProgramEventViewClient public details/links and sparse/phone states. Rich content, media, edit branch, authorization and server localization remain outside.',
  },
  {
    route: '/terms',
    storyTitle: 'Pages/Legal/Public Document',
    variant: 'Terms',
    coverage: 'page-view',
    scope:
      'Actual TermsPageClient active version/date, upcoming notice, empty body and history/print controls. Seeded query transport disabled; rich document, token-preview and translation branches remain outside.',
  },
  {
    route: '/privacy',
    storyTitle: 'Pages/Legal/Public Document',
    variant: 'Privacy',
    coverage: 'page-view',
    scope:
      'Actual PrivacyPageClient active version/date, upcoming notice, empty body and history/print controls. Seeded query transport disabled; rich document, token-preview and translation branches remain outside.',
  },
  {
    route: '/forms/[slug]',
    storyTitle: 'Pages/Forms/Public Response',
    variant: 'Response',
    coverage: 'page-view',
    scope:
      'Complete production PublicFormView response/access/header composition and typed local submission callbacks. Validation and local success navigation are interactive. Server schema/access projection and canonical editing branches remain separate.',
  },
  {
    route: '/forms/[slug]/success',
    storyTitle: 'Pages/Forms/Public Response',
    variant: 'Success',
    coverage: 'page-view',
    scope:
      'Complete production FormSuccessPageView, branding owner and shared Core form container. Form existence/fallback and server metadata checks remain outside.',
  },
  {
    route: '/user/[id]',
    storyTitle: 'Pages/User/Profile Full Page',
    variant: 'Public',
    coverage: 'page-view',
    scope:
      'Actual complete UserProfilePageView and production published-post table view with query controls, paging and local profile modal callbacks. Server profile/access projection, persistence and real deletion are outside.',
  },
  {
    route: '/admin/artists',
    storyTitle: 'Pages/Admin/Entity Lists',
    variant: 'Artists',
    coverage: 'page-view',
    scope:
      'Actual production ArtistsPageView extracted from the server route. Domain columns, row menus, creation/deletion controllers, selection and URL query controls use local typed actions/navigation. Text search, scalar fixture filters/sort/pagination only; other operators, auth, draft editor navigation and persistence remain outside.',
  },
  {
    route: '/admin/labels',
    storyTitle: 'Pages/Admin/Entity Lists',
    variant: 'Labels',
    coverage: 'page-view',
    scope:
      'Actual production LabelsPageView extracted from the server route. Domain columns, row menus, creation/deletion controllers, selection and URL query controls use local typed actions/navigation. Text search, scalar fixture filters/sort/pagination only; other operators, auth, draft editor navigation and persistence remain outside.',
  },
  {
    route: '/admin/releases',
    storyTitle: 'Pages/Admin/Entity Lists',
    variant: 'Releases',
    coverage: 'page-view',
    scope:
      'Actual production ReleasesPageView extracted from the server route. Domain columns, row menus, creation/deletion controllers, selection and URL query controls use local typed actions/navigation. Text search, scalar fixture filters/sort/pagination only; other operators, auth, draft editor navigation and persistence remain outside.',
  },
  {
    route: '/my/artists',
    storyTitle: 'Pages/Account/Owned Lists',
    variant: 'Artists',
    coverage: 'page-view',
    scope:
      'Actual production MyArtistsTable; local typed query/create transport, empty/loading/error branches where the production owner exposes them. Text search/pagination operate on fixtures; backend filter/sort semantics, auth and navigation destinations remain outside.',
  },
  {
    route: '/my/works',
    storyTitle: 'Pages/Account/Owned Lists',
    variant: 'Works',
    coverage: 'page-view',
    scope:
      'Actual production MyWorksPageView; local typed query/create transport, empty/loading/error branches where the production owner exposes them. Text search/pagination operate on fixtures; backend filter/sort semantics, auth and navigation destinations remain outside.',
  },
  {
    route: '/my/posts',
    storyTitle: 'Pages/Account/Owned Lists',
    variant: 'Posts',
    coverage: 'page-view',
    scope:
      'Actual production MyPostsPageView; local typed query/create transport, empty/loading/error branches where the production owner exposes them. Text search/pagination operate on fixtures; backend filter/sort semantics, auth and navigation destinations remain outside.',
  },
  {
    route: '/my/series',
    storyTitle: 'Pages/Account/Owned Lists',
    variant: 'Series',
    coverage: 'page-view',
    scope:
      'Actual production MySeriesPageView; local typed query/create transport, empty/loading/error branches where the production owner exposes them. Text search/pagination operate on fixtures; backend filter/sort semantics, auth and navigation destinations remain outside.',
  },
  {
    route: '/onboarding/nickname',
    storyTitle: 'Pages/Auth/Nickname Onboarding',
    variant: 'Ready',
    coverage: 'page-view',
    scope:
      'Actual NicknameOnboarding controller including debounce, unavailable/check-error/submission-error/pending states and local complete/logout actions. Session, uniqueness/persistence and redirects remain outside.',
  },
  {
    route: '/oauth/authorize/consent',
    storyTitle: 'Pages/Auth/OAuth Consent',
    variant: 'OfflineAccess',
    coverage: 'page-view',
    scope:
      'Actual McpConsentPageView extracted unchanged from server route, offline/session scopes and local approve/reject forms. Challenge/session/delegation/Hydra validation, persistence and redirects remain outside.',
  },
  {
    route: '/posts/[idOrSlug]',
    storyTitle: 'Pages/Public/Documents',
    variant: 'Post',
    coverage: 'page-view',
    scope:
      'Actual PostViewContent with typed generated rich text, header, hero/pinned/empty document layout, TOC, series links, local markdown export and local empty comments/anonymous snapshot. Comment creation/moderation, media authorization, share/access/SSR/edit branches remain outside.',
  },
  {
    route: '/[...slug]',
    storyTitle: 'Pages/Public/Documents',
    variant: 'Page',
    coverage: 'page-view',
    scope:
      'Actual PageContentView with generated rich-text section and actual pinned/empty/phone document layout. Service-backed section kinds, media, localization/access/share checks and edit branch remain outside.',
  },
  {
    route: '/admin/files',
    storyTitle: 'Pages/Admin/File Manager',
    variant: 'Browser',
    coverage: 'page-view',
    scope:
      'Actual FileManagerView and actual useFileManagerI18n. Local folder/query/type/sort/selection/create/rename/delete/move/detail callbacks in one browser with grid/list/settings and selection controls, plus distinct detail/empty/error/loading/author stories. Responsive sizes use the viewport toolbar. Authentication, app shell, byte upload, server confirmations and persistence remain outside.',
  },

  {
    route: '/account/recover',
    storyTitle: 'Pages/Account/Lifecycle',
    variant: 'RecoveryRequest',
    coverage: 'page-view',
    scope:
      'Actual production account lifecycle controller/render PageView with local typed request/mutation transport. Request/submitted/error/pending and invalid/success/failure states; backend token validation, mail delivery, account/subscription persistence, metadata and redirects remain outside.',
  },
  {
    route: '/account/recovery/confirm',
    storyTitle: 'Pages/Account/Lifecycle',
    variant: 'RecoveryConfirmed',
    coverage: 'page-view',
    scope:
      'Actual production account lifecycle controller/render PageView with local typed request/mutation transport. Request/submitted/error/pending and invalid/success/failure states; backend token validation, mail delivery, account/subscription persistence, metadata and redirects remain outside.',
  },
  {
    route: '/account/deletion/confirm',
    storyTitle: 'Pages/Account/Lifecycle',
    variant: 'DeletionConfirmed',
    coverage: 'page-view',
    scope:
      'Actual production account lifecycle controller/render PageView with local typed request/mutation transport. Request/submitted/error/pending and invalid/success/failure states; backend token validation, mail delivery, account/subscription persistence, metadata and redirects remain outside.',
  },
  {
    route: '/account/deletion/cancel',
    storyTitle: 'Pages/Account/Lifecycle',
    variant: 'DeletionCancelled',
    coverage: 'page-view',
    scope:
      'Actual production account lifecycle controller/render PageView with local typed request/mutation transport. Request/submitted/error/pending and invalid/success/failure states; backend token validation, mail delivery, account/subscription persistence, metadata and redirects remain outside.',
  },
  {
    route: '/unsubscribe',
    storyTitle: 'Pages/Account/Lifecycle',
    variant: 'Unsubscribed',
    coverage: 'page-view',
    scope:
      'Actual production account lifecycle controller/render PageView with local typed request/mutation transport. Request/submitted/error/pending and invalid/success/failure states; backend token validation, mail delivery, account/subscription persistence, metadata and redirects remain outside.',
  },
  {
    route: '/artists/[idOrSlug]',
    storyTitle: 'Pages/Public/Catalog Entity Detail',
    variant: 'Artist',
    coverage: 'page-view',
    scope:
      'Actual ArtistPublicView extracted unchanged from ArtistPublicContent, including actual ArtistWorks search/filter owner and populated/empty states. Server read/localization resolution, metadata JSON-LD and auth/services remain outside.',
  },
  {
    route: '/labels/[idOrSlug]',
    storyTitle: 'Pages/Public/Catalog Entity Detail',
    variant: 'Label',
    coverage: 'page-view',
    scope:
      'Actual LabelPublicView extracted unchanged from LabelPublicContent with populated/empty states. Server read/localization resolution, metadata JSON-LD and auth/services remain outside.',
  },
  {
    route: '/releases/[idOrSlug]',
    storyTitle: 'Pages/Public/Catalog Entity Detail',
    variant: 'Release',
    coverage: 'page-view',
    scope:
      'Actual ReleasePublicView extracted unchanged from ReleasePublicContent with populated/empty states. Server read/localization resolution, metadata JSON-LD and auth/services remain outside.',
  },
  {
    route: '/admin/clients',
    storyTitle: 'Pages/Admin/Collections',
    variant: 'Clients',
    coverage: 'page-view',
    scope:
      'Actual ClientsPageView with domain columns/row menus/create/delete, selection and URL controls backed by local typed actions. Scalar fixture search/filter/sort/paging only; backend authorization/validation/persistence and editor navigation outside.',
  },
  {
    route: '/admin/series',
    storyTitle: 'Pages/Admin/Collections',
    variant: 'Series',
    coverage: 'page-view',
    scope:
      'Actual SeriesPageView with creation form, domain columns/row menus/delete, selection and URL controls backed by local typed actions. Scalar fixture search/filter/sort/paging only; backend authorization/validation/persistence and editor navigation outside.',
  },
  {
    route: '/admin/works',
    storyTitle: 'Pages/Admin/Collections',
    variant: 'Works',
    coverage: 'page-view',
    scope:
      'Actual WorksPageView complete production query/mutation controller with local typed actions and create/delete/requery. Fixture text search/paging only; backend filtering/sorting/authorization/validation/persistence and editor destination outside.',
  },
  {
    route: '/forms/[slug]/dashboard',
    storyTitle: 'Pages/Forms/Operations',
    variant: 'Dashboard',
    coverage: 'page-view',
    scope:
      'Actual FormDashboardView access/data controller and charts with local typed query transports; populated/empty/error/locked/invalid states. Signed token, access authorization, real aggregation and persistence outside.',
  },
  {
    route: '/forms/[slug]/password',
    storyTitle: 'Pages/Forms/Operations',
    variant: 'Password',
    coverage: 'page-view',
    scope:
      'Actual FormPasswordContent access/verification controller and sessionStorage flow with local password signal. Final navigation contained; signed share/token validation, real passwords and authorization outside.',
  },
  {
    route: '/admin/forms/[id]/submissions',
    storyTitle: 'Pages/Forms/Operations',
    variant: 'Submissions',
    coverage: 'page-view',
    scope:
      'Actual AdminFormSubmissionsPage including real country/date/search/sort/pagination and deletion controller with local typed actions. Server validation/permission/persistence outside.',
  },
  {
    route: '/admin/forms/[id]/submissions/[submissionId]',
    storyTitle: 'Pages/Forms/Operations',
    variant: 'Detail',
    coverage: 'page-view',
    scope:
      'Actual FormSubmissionDetailPageView extracted unchanged from server route with production metadata/response rendering and deletion confirmation; local typed deletion callback. Server schema/read/permissions/persistence outside.',
  },
  {
    route: '/category/[slug]',
    storyTitle: 'Pages/Public/Post Taxonomy',
    variant: 'Category',
    coverage: 'page-view',
    scope:
      'Actual PostTaxonomyListPage complete query controller/render tree with local typed read transport. Search, scalar fixture filter/sort and pagination; taxonomy lookup/notFound, JSON-LD, root shell and backend semantics outside.',
  },
  {
    route: '/tag/[slug]',
    storyTitle: 'Pages/Public/Post Taxonomy',
    variant: 'Tag',
    coverage: 'page-view',
    scope:
      'Actual PostTaxonomyListPage complete query controller/render tree with local typed read transport. Search, scalar fixture filter/sort and pagination; taxonomy lookup/notFound, JSON-LD, root shell and backend semantics outside.',
  },
  {
    route: '/admin/clients/[id]',
    storyTitle: 'Pages/Admin/Client Editor',
    variant: 'Edit',
    coverage: 'page-view',
    scope:
      'Actual ClientDetailPageView full production query/mutation/baseline form, light/dark logo upload/crop controls with local typed read/create/update/asset callbacks; captured navigation. New/edit/pending/save-failed states. Multipart transport, asset linking, authorization/validation/persistence outside.',
  },
  {
    route: '/admin/posts',
    storyTitle: 'Pages/Admin/Content Lists',
    variant: 'Posts',
    coverage: 'page-view',
    scope:
      'Actual PostsPageView unchanged server render extraction, domain columns/authors/row menus, create/delete/bulk selection and URL controls; local typed scalar fixture read/mutations. Auth/server validation/persistence and draft editor destinations outside.',
  },
  {
    route: '/admin/pages',
    storyTitle: 'Pages/Admin/Content Lists',
    variant: 'Pages',
    coverage: 'page-view',
    scope:
      'Actual PagesPageView unchanged server render extraction, domain columns/row menus, create/delete/bulk selection and URL controls; local typed scalar fixture read/mutations. Auth/server validation/persistence and draft editor destinations outside.',
  },
  {
    route: '/admin/translations',
    storyTitle: 'Pages/Admin/Translation',
    variant: 'Overview',
    coverage: 'page-view',
    scope:
      'Actual production overview controller with typed in-memory RPC data, refresh and empty/error/pending states. Locale/entity health tables use production owners. Backend auth, translation execution, collaboration events and server data remain outside.',
  },
  {
    route: '/admin/translations/jobs',
    storyTitle: 'Pages/Admin/Translation',
    variant: 'Jobs',
    coverage: 'page-view',
    scope:
      'Actual production active-jobs controller and cancellation using typed local RPC data. Refresh, empty and read failure states; machine translation, runtime lifecycle stream and server cancellation remain outside.',
  },
  {
    route: '/admin/translations/settings',
    storyTitle: 'Pages/Admin/Translation',
    variant: 'Settings',
    coverage: 'page-view',
    scope:
      'Actual production dirty settings form and provider CRUD/toggle/confirmation controller with typed in-memory RPC. Ready/empty/read-error/pending/save-error states. Backend CAS, credentials, auth and persistence remain outside.',
  },
  {
    route: '/terms/history/[id]',
    storyTitle: 'Pages/Legal/History Detail',
    variant: 'Terms',
    coverage: 'page-view',
    scope:
      'Actual route history-detail client with matching per-locale initial data; archived/missing/unknown dates, metadata and navigation. Queries disabled. Rich text, translated fallback notice, edit branch, server access and query failure recovery remain outside.',
  },
  {
    route: '/privacy/history/[id]',
    storyTitle: 'Pages/Legal/History Detail',
    variant: 'Privacy',
    coverage: 'page-view',
    scope:
      'Actual route history-detail client with matching per-locale initial data; archived/missing/unknown dates, metadata and navigation. Queries disabled. Rich text, translated fallback notice, edit branch, server access and query failure recovery remain outside.',
  },
  {
    route: '/admin/emails',
    storyTitle: 'Pages/Admin/Email Events',
    variant: 'Notices',
    coverage: 'page-view',
    scope:
      'Actual production page containing removed-database-log and external-dashboard notices. There is no event table or mutation controller on this route.',
  },
  {
    route: '/forms',
    storyTitle: 'Pages/Public/Documents',
    variant: 'FormsIndex',
    coverage: 'page-view',
    scope:
      'Exact shared PageContentView owner used by the forms CMS route alias; explicit pathname and validated rich-text section fixture. Backend-configured section kinds, missing/restricted branches, server queries and metadata remain outside.',
  },
];

export const boundaryPreviews = [
  {
    file: 'app/(general)/error.tsx',
    storyTitle: 'Pages/Application/Boundaries',
    variant: 'ServerError',
    scope: 'Actual ApplicationErrorPage surface; local retry only, not Next boundary invocation or telemetry.',
  },
  {
    file: 'app/admin/error.tsx',
    storyTitle: 'Pages/Application/Boundaries',
    variant: 'ServerError',
    scope:
      'Actual ApplicationErrorPage surface; local retry only, admin home target and permission context remain outside.',
  },
  {
    file: 'app/error.tsx',
    storyTitle: 'Pages/Application/Boundaries',
    variant: 'ServerError',
    scope: 'Actual reexported general ApplicationErrorPage surface; local retry only.',
  },
  {
    file: 'app/not-found.tsx',
    storyTitle: 'Pages/Application/Boundaries',
    variant: 'NotFound',
    scope: 'Actual ApplicationErrorPage 404 surface; not server locale or Next notFound invocation.',
  },
  {
    file: 'app/global-error.tsx',
    storyTitle: 'Pages/Application/Boundaries',
    variant: 'RootFallback',
    scope: 'Actual RootErrorPageView surface; not html/body replacement, fallback provider or telemetry.',
  },
];

export const layoutPreviews = [
  {
    file: 'app/(general)/layout.tsx',
    storyTitle: 'Pages/Application/Frames',
    variant: 'Public',
    coverage: 'layout-view',
    scope:
      'Actual ShellView frame with local drawer/menu callbacks. Child is placeholder; server cookie/user/menu projection, real spotlight, language/consent/signout controllers outside.',
  },
  {
    file: 'app/admin/layout.tsx',
    storyTitle: 'Pages/Application/Frames',
    variant: 'Admin',
    coverage: 'layout-view',
    scope:
      'Actual AdminShellView navigation/frame with local expanded/compact/section callbacks. Child is placeholder; server session/admin guards and complete menu projection outside.',
  },
  {
    file: 'app/(general)/my/layout.tsx',
    storyTitle: 'Pages/Application/Frames',
    variant: 'Account',
    coverage: 'layout-view',
    scope:
      'Actual UserShellView account frame with local tab controller/placeholder child. Server allowed-section guards, user/session projection and avatar upload controller outside.',
  },
];
