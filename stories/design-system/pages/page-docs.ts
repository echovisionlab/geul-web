import sourceCatalog from '../../../docs/design-system/page-preview-coverage.json';
import routeCatalog from '../../../docs/design-system/ui-kit-route-index.json';

/** Page documentation consumes the generated source census, never a copied application page. */
export type DocumentationText = string;

export type PagePattern = 'auth' | 'list' | 'editor' | 'settings' | 'document' | 'operation' | 'frame' | 'boundary';

export interface PageContract {
  pattern: PagePattern;
  purpose: DocumentationText;
  scenario: DocumentationText;
}

const contract = (pattern: PagePattern, purpose: DocumentationText, scenario: DocumentationText): PageContract => ({
  pattern,
  purpose,
  scenario,
});

/** These are review tasks. Their presence does not assert that a scenario passed. */
export const pageContracts: Record<string, PageContract> = {
  'Pages/Auth/Login': contract(
    'auth',
    'Request an email code and complete sign-in.',
    'Email → request code → invalid code → resend or start over → local completion with 123456. Inspect expiry and pending separately.',
  ),
  'Pages/Auth/Login Error': contract(
    'boundary',
    'Understand why sign-in is blocked and locate recovery actions.',
    'Compare pending deletion, suspension, inactive session and security violation notices and recovery actions.',
  ),
  'Pages/Auth/Nickname Onboarding': contract(
    'auth',
    'Check nickname availability and finish onboarding.',
    'Enter taken → unavailable error → choose another name → availability feedback → completion. Separate check failure from submission failure.',
  ),
  'Pages/Auth/OAuth Consent': contract(
    'auth',
    'Read the client and access scope, then approve or reject an MCP connection.',
    'Client, delegated account and offline access → reject or connect → local result. Inspect both actions with long names.',
  ),
  'Pages/Auth/Verification': contract(
    'auth',
    'Enter an email verification code and inspect its result.',
    'Inspect input, feedback and retry actions in code, pending and error states. The identity service is outside the fixture.',
  ),
  'Pages/Account/Lifecycle': contract(
    'auth',
    'Request account recovery, confirm or cancel deletion, or unsubscribe.',
    'Selected route request or confirmation → invalid token → failure → its recovery path. Keep distinct account operations separate.',
  ),
  'Pages/Account/Full Pages': contract(
    'settings',
    'Manage personal profile, security and preferences.',
    'Selected profile, security or settings surface → edit → local save or token action → failure and recovery. Preview tokens cannot authenticate.',
  ),
  'Pages/Account/Owned Lists': contract(
    'list',
    'Find owned artists, works, posts and series.',
    'Selected domain list → search, sort or page → open an item. Inspect post creation, empty data and read failure in the corresponding stories.',
  ),
  'Pages/Admin/Content Lists': contract(
    'list',
    'Inspect, create and delete posts or CMS pages.',
    'Search or filter → row menu → confirm deletion → local row removal and focus recovery. Separate create failure from list read failure.',
  ),
  'Pages/Admin/Entity Lists': contract(
    'list',
    'Manage artists, labels and releases.',
    'Inspect domain columns → scalar search, filter or sort → create or delete → empty or error state. Draft editor navigation is a separate contract.',
  ),
  'Pages/Admin/Collections': contract(
    'list',
    'Manage client, series and work collections.',
    'Read the selected collection → query or page → create form or deletion → requery. Read the domain fixture query limitations.',
  ),
  'Pages/Admin/Communication Lists': contract(
    'list',
    'Manage form and campaign lists, status and selection.',
    'Select rows → row actions → local create or delete result. Publication, audience evaluation and delivery are outside this list fixture.',
  ),
  'Pages/Admin/Program Event Lists': contract(
    'list',
    'Find and manage program events and event series.',
    'Date and status columns → query → creation and event type management → local result. Publication and relation constraints need service review.',
  ),
  'Pages/Admin/Taxonomy': contract(
    'list',
    'Manage genres, formats, styles, categories and tags.',
    'Selected dictionary columns and counts → CRUD → failure feedback → selection and query. User tags provide create and delete only, matching production.',
  ),
  'Pages/Admin/Audience and Users': contract(
    'list',
    'Manage members and audience segments.',
    'Select users or segments → role, ban, unsubscribe, estimate or archive → confirmation or failure → local result. No real account is changed.',
  ),
  'Pages/Admin/Dashboard': contract(
    'operation',
    'Read administrative metrics and distinguish zero values from failure.',
    'Pending → local values in production StatCards → zero data → read failure. This fixture does not establish permission or live metric accuracy.',
  ),
  'Pages/Admin/Client Editor': contract(
    'settings',
    'Edit client settings and light or dark logos.',
    'Existing or new values → select, crop or remove logo → save → pending or failure. Separate local selection from persisted asset linking.',
  ),
  'Pages/Admin/User Edit': contract(
    'settings',
    'Manage a member profile, authentication and security settings.',
    'Member details or banned state → local mutation → failure recovery. Credential issuance, SSO, authorization and identity invariants need service review.',
  ),
  'Pages/Admin/Site Settings': contract(
    'settings',
    'Configure site details, logo, favicon, loader and OG assets.',
    'Current values → edit or select local files → save → preserve edits on failure. Identify omitted service-backed image generation.',
  ),
  'Pages/Admin/OG Image Settings': contract(
    'settings',
    'Save or reset home and content OG image settings.',
    'Both settings panels → edit content values → local save or reset → failure. Live rendering and generation completion are separate.',
  ),
  'Pages/Admin/Mail Adapters': contract(
    'settings',
    'Manage mail adapter configuration, testing and activation.',
    'Select adapter → create or edit → local test gate → activate or delete → failure. SMTP credentials and real delivery are outside.',
  ),
  'Pages/Admin/Menus': contract(
    'settings',
    'Edit site navigation hierarchy and ordering.',
    'Create menu → edit item → keyboard or pointer reorder → confirm deletion. Check nested action names and separation of drag and disclosure controls.',
  ),
  'Pages/Admin/Map Places': contract(
    'settings',
    'Find places and edit address, coordinates and metadata.',
    'List → place details → manual name, address and coordinates → local save or delete → failure. Map and autocomplete service controls are omitted.',
  ),
  'Pages/Admin/Map Themes': contract(
    'list',
    'Copy or delete map themes and select a default.',
    'Theme list → copy form → default restrictions → deletion confirmation → local result. New theme creation and editor navigation are separate.',
  ),
  'Pages/Admin/Map Theme Editor': contract(
    'editor',
    'Edit map theme variants and canvas controls.',
    'Header → variant tabs → production canvas controls → local default change. Local canvas does not establish tile service or network collaboration behavior.',
  ),
  'Pages/Admin/Email Catalog': contract(
    'list',
    'Manage email layouts, templates and event mappings.',
    'Protected, system and custom rows → HTML preview → create or delete → event mapping → local result. Use editor stories for authoring.',
  ),
  'Pages/Admin/Email Editors': contract(
    'editor',
    'Edit email layout code and template content.',
    'Layout or template branch → code or content edits → live preview and view modes → local test dialog. No email is delivered.',
  ),
  'Pages/Admin/Email Events': contract(
    'document',
    'Read email logging policy and external dashboard guidance.',
    'Inspect production notices and the external dashboard link. Removed database logs are not replaced with a fabricated event table.',
  ),
  'Pages/Admin/Legal Policies': contract(
    'list',
    'Manage terms or privacy versions and create a draft.',
    'Status, search and selection → create or confirm deletion → local editor or list destination → failure. Separate creating, created and failure route states.',
  ),
  'Pages/Admin/Translation': contract(
    'operation',
    'Manage translation health, active jobs and providers.',
    'Separate overview, jobs and settings → refresh, cancel, toggle or edit provider, save dirty values → local result and failure. Translation execution and WebSocket events are separate.',
  ),
  'Pages/Admin/File Manager': contract(
    'operation',
    'Browse files and folders, select, move and rename items.',
    'Open folder → grid or list, search and sort → select → move, rename or delete → details and return. Uploads remain local object URLs.',
  ),
  'Pages/Campaign/Analytics': contract(
    'operation',
    'Read campaign recipient status and metrics.',
    'Pending → metrics and recipient status → empty or failed read → table controls. No send action or live delivery result is established.',
  ),
  'Pages/Editors/Campaign': contract(
    'editor',
    'Edit campaign content, audience, layout and scheduling.',
    'Edit content or audience → preview → test, send or schedule dialog → local lifecycle or failure. Service translation panels and real delivery are excluded.',
  ),
  'Pages/Editors/Form': contract(
    'editor',
    'Edit a form through builder, settings, submissions and translations.',
    'Header and locale → real tabs and tabpanel → schema or settings edit → local share link creation and revocation → disconnected or read-only. Read each tab fixture scope.',
  ),
  'Pages/Editors/Page': contract(
    'editor',
    'Author a CMS page title, sections and layout.',
    'Title and locale → add or configure sections and content → metadata → disconnected or read-only. Use keyboard section authoring to inspect entry, menus and focus.',
  ),
  'Pages/Editors/Post': contract(
    'editor',
    'Edit post title, content, metadata and translation state.',
    'Author title and content → per-Post comment switch and document outline visibility → zen, media and preview → translation request, progress, cancellation and recovery → disconnected or read-only. Separate local fixture behavior from service behavior.',
  ),
  'Pages/Editors/Artist': contract(
    'editor',
    'Edit artist title, biography and metadata.',
    'Title and locale → content and metadata edits → disconnected or read-only → keyboard title authoring.',
  ),
  'Pages/Editors/Label': contract(
    'editor',
    'Edit label title, description and metadata.',
    'Title and locale → content and metadata edits → disconnected or read-only → keyboard title authoring.',
  ),
  'Pages/Editors/Release': contract(
    'editor',
    'Edit release title, content and metadata.',
    'Title and locale → content and metadata edits → disconnected or read-only → keyboard title authoring.',
  ),
  'Pages/Editors/Work': contract(
    'editor',
    'Edit work title, content and metadata.',
    'Title and locale → content and metadata edits → disconnected or read-only → keyboard title authoring.',
  ),
  'Pages/Editors/Program Events': contract(
    'editor',
    'Edit event or event series title and content.',
    'Event or series branch → title and locale → content and metadata → event disconnected, read-only and keyboard authoring examples.',
  ),
  'Pages/Editors/Series': contract(
    'editor',
    'Edit series details, post ordering and managers.',
    'Admin or mine branch → title, slug and poster → post order → add or remove managers → disconnection. Service translation panels are omitted.',
  ),
  'Pages/Editors/Legal': contract(
    'editor',
    'Edit a terms or privacy version title and content.',
    'Terms or privacy branch → content and preview → disconnected or read-only. Version CAS and server publication rules need separate review.',
  ),
  'Pages/Forms/Public Response': contract(
    'auth',
    'Complete public form fields, validation, steps and submission.',
    'Allowed or restricted access → required errors → conditional fields or steps → pending submission → fail once and retry → local success. Check value retention and error relationships.',
  ),
  'Pages/Forms/Operations': contract(
    'operation',
    'Inspect form submissions, details, aggregation and password access.',
    'Select submissions, detail, dashboard or password → query, confirm deletion, charts or verification → pending, failure or locked state. Signed tokens and real password verification are separate.',
  ),
  'Pages/Public/Documents': contract(
    'document',
    'Read public posts, CMS pages and CMS index aliases.',
    'Selected post, page, home or index → title, contents, pinned or empty layout → locale and export. Index examples use a rich-text section rather than live list data.',
  ),
  'Pages/Public/Catalog Entity Detail': contract(
    'document',
    'Read public artist, label or release information and relationships.',
    'Selected entity → metadata and relationships → sparse data, language fallback and unavailable media. Signed playback and download belong to media contracts.',
  ),
  'Pages/Public/Entity Detail': contract(
    'document',
    'Read public work or event metadata and credits.',
    'Work or event → links and credits → sparse data → narrow header layout. Empty content and media fixtures do not establish delivery.',
  ),
  'Pages/Public/Event Series': contract(
    'list',
    'Read an event series and find its events.',
    'Series details → event query → load more and share → empty, pending or failure. Server queries and edit branches are separate.',
  ),
  'Pages/Public/Post Taxonomy': contract(
    'list',
    'Find posts within a category or tag.',
    'Category or tag → post title, author and date → search, multi-filter, sort and page → empty or pending.',
  ),
  'Pages/Public/Series': contract(
    'document',
    'Read a series and its posts.',
    'Series header → post list → empty series → narrow layout. Domain data and route access remain outside the fixture.',
  ),
  'Pages/Public/Utilities': contract(
    'document',
    'Read the sitemap and changelog.',
    'Sitemap or changelog → entries and dates → navigation or empty history. Authorization and filesystem loading belong to server routes.',
  ),
  'Pages/Legal/Public Document': contract(
    'document',
    'Read current or scheduled terms and privacy documents.',
    'Terms or privacy → content and language fallback → scheduled or invalid preview → loading or query failure. Fixture preview tokens do not grant service access.',
  ),
  'Pages/Legal/History': contract(
    'document',
    'Find legal policy versions and their effective periods.',
    'Terms or privacy list → current, archived or unknown dates → detail link → empty list. Query transport is disabled.',
  ),
  'Pages/Legal/History Detail': contract(
    'document',
    'Read an archived legal policy metadata surface.',
    'Terms or privacy detail → missing or unknown dates → history and print. Rich-text content and query recovery are outside this fixture.',
  ),
  'Pages/Share/Password Gate': contract(
    'auth',
    'Enter a shared document password.',
    'Locked → invalid password → error or pending → retry. Token validity, expiry and the final entity controller are separate.',
  ),
  'Pages/User/Profile Full Page': contract(
    'list',
    'Read a user profile and published posts.',
    'Public or admin → published post query → local admin ban, role or deletion → empty or failure. Permission enforcement needs service review.',
  ),
  'Pages/Application/Frames': contract(
    'frame',
    'Navigate public, admin and account shells and overlays.',
    'Shell branch → drawer or user menu → navigation mode or account tabs → search, cookie preferences and theme → dismiss and return to trigger.',
  ),
  'Pages/Application/Boundaries': contract(
    'boundary',
    'Find recovery paths for errors, restricted access and missing pages.',
    'Status-specific display → notice and retry → mapped home preview. Next boundary throwing, telemetry and HTTP status are outside.',
  ),
};

export interface GeneratedState {
  variant: string;
  preview: string;
}
export interface GeneratedPagePreview {
  storyTitle: string;
  variant: string;
  coverage: string;
  scope: string;
  storySource: string;
  preview: string;
  owner?: string;
  branch?: string;
  query?: string;
  availableStates: GeneratedState[];
}
export interface GeneratedPageEntry {
  file: string;
  sha256: string;
  kind: string;
  route: string;
  family: string;
  disposition: string;
  reviewStatus: string;
  directJsx: string[];
  inheritedBoundaries: string[];
  inheritedTerminalLayouts: string[];
  redirects: Array<{ line: number; expression: string }>;
  previews: GeneratedPagePreview[];
  relatedFeatureStories: Array<{ file: string; title: string; matchingOwners: string[] }>;
}
export interface GeneratedPageCatalog {
  schemaVersion: number;
  sourceManifestHash: string;
  entrypoints: GeneratedPageEntry[];
}
export interface GeneratedRouteCatalog {
  schemaVersion: number;
  routes: Array<{
    route: string;
    source: string;
    previews: Array<{ storyId: string; variant: string; branch?: string }>;
  }>;
}
export interface PagePreviewDocumentation extends GeneratedPagePreview {
  storyId: string;
  owners: string[];
  contract: PageContract | null;
}
export interface PageDocumentationRecord extends Omit<GeneratedPageEntry, 'previews'> {
  previews: PagePreviewDocumentation[];
}

export function storyIdFromPreview(preview: string): string {
  const path = new URL(preview, 'https://storybook.invalid').searchParams.get('path') ?? '';
  return path.startsWith('/story/') ? path.slice('/story/'.length) : '';
}

export function buildPageDocumentation(
  catalog: GeneratedPageCatalog,
  routeCatalog: GeneratedRouteCatalog,
): PageDocumentationRecord[] {
  if (catalog.schemaVersion !== 2 || routeCatalog.schemaVersion !== 1 || !Array.isArray(catalog.entrypoints)) {
    throw new Error('Unsupported page documentation catalog');
  }
  return catalog.entrypoints.map((entry) => {
    const route = routeCatalog.routes.find((candidate) => candidate.source === entry.file);
    const seen = new Set<string>();
    const previews = entry.previews.flatMap((preview): PagePreviewDocumentation[] => {
      const storyId = storyIdFromPreview(preview.preview);
      const key = `${storyId}:${preview.branch ?? ''}`;
      if (!storyId || seen.has(key)) {
        return [];
      }
      seen.add(key);
      if (entry.kind === 'page' && !route?.previews.some((candidate) => candidate.storyId === storyId)) {
        throw new Error(`Page catalog mapping mismatch: ${entry.file} / ${storyId}`);
      }
      return [
        {
          ...preview,
          storyId,
          owners: [
            ...(preview.owner ? [preview.owner] : []),
            ...entry.relatedFeatureStories
              .filter((related) => related.file === preview.storySource)
              .flatMap((related) => related.matchingOwners),
          ],
          contract: pageContracts[preview.storyTitle] ?? null,
        },
      ];
    });
    return { ...entry, previews };
  });
}

export const pageDocumentation = buildPageDocumentation(sourceCatalog, routeCatalog);

export function getPageDocumentation(title: string): PageDocumentationRecord[] {
  return pageDocumentation
    .filter((entry) => entry.previews.some((preview) => preview.storyTitle === title))
    .map((entry) => ({
      ...entry,
      previews: entry.previews.filter((preview) => preview.storyTitle === title),
    }));
}

export const pageSourceManifestHash = sourceCatalog.sourceManifestHash;

/** A shared CSF module may contain several route domains; these remain labelled suite examples. */
export function previewStateGroups(preview: PagePreviewDocumentation) {
  const prefixOverrides: Record<string, string[]> = {
    Posts: ['Posts', 'PostCreate', 'KeyboardPost'],
    Pages: ['Pages', 'PageCreate', 'KeyboardPage'],
    Artists: ['Artists', 'ArtistCreate'],
    Series: ['Series', 'KeyboardManager'],
    Profile: ['Profile', 'BasicProfile', 'KeyboardProfile'],
    Settings: ['Settings', 'BasicSettings', 'SaveFailed', 'KeyboardProvider'],
    Jobs: ['Jobs', 'KeyboardJob'],
    TermsCreating: ['TermsCreat'],
    PrivacyCreating: ['PrivacyCreat'],
    RecoveryRequest: ['RecoveryRequest', 'RecoveryFailed', 'RecoveryPending', 'KeyboardRecoveryRequest'],
    RecoveryConfirmed: ['RecoveryConfirm', 'RecoveryInvalid'],
    DeletionConfirmed: ['DeletionConfirm', 'DeletionInvalid'],
    DeletionCancelled: ['DeletionCancel'],
    Unsubscribed: ['Unsubscribe'],
  };
  const prefixes = prefixOverrides[preview.variant] ?? [preview.variant];
  const focused = preview.availableStates.filter((state) =>
    prefixes.some((prefix) => state.variant.startsWith(prefix)),
  );
  const related = preview.availableStates.filter((state) => !focused.includes(state));
  return { focused, related };
}

export const pageReviewChecks: Record<PagePattern, DocumentationText[]> = {
  auth: [
    'Check label, help and error relationships and retained input values.',
    'Check duplicate action blocking, retry, status feedback and focus after success or failure.',
    'Inspect Enter submission, Tab order, autofill, mobile keyboard and IME with real input.',
  ],
  list: [
    'Check rows and counts after query, filter, sort and paging within supported fixture operators.',
    'Check row action and selection names, confirmation, focus after action and empty state.',
    'Separate intentional table scrolling from page overflow; keep essential columns and actions discoverable.',
  ],
  editor: [
    'Edit title, body and metadata in production owners; check allowed actions in read-only or disconnected states.',
    'Check toolbar, tab and overlay names, keyboard entry and exit, dismissal and focus return.',
    'Check 2D canvas and authored content separately from product toolbar overflow.',
  ],
  settings: [
    'Separate baseline, dirty values and saved result; retain values and recovery actions on failure.',
    'Identify local file selection, removal and preview scope and omitted service surfaces.',
    'Check errors and field relationships, duplicate save blocking and confirmation dialog focus.',
  ],
  document: [
    'Check heading hierarchy, content and metadata reading order, link destinations and essential information.',
    'Keep pinned, empty, sparse and source-language fallback fixtures distinct.',
    'Check long titles, URLs, dates and authored content wrapping separately from product chrome overflow.',
  ],
  operation: [
    'Distinguish pending, zero or empty data, read failure and action failure; check retry and refresh.',
    'Check chart, table and file names, state, selection targets and keyboard alternatives.',
    'Read the limits between local transport results, live aggregation, networking and persistence.',
  ],
  frame: [
    'Check current or expanded navigation state, dismissal and trigger focus return.',
    'Check that shell content, focus and navigation remain available at narrow widths and low heights.',
    'Separate fixture navigation from production route transitions and authentication propagation.',
  ],
  boundary: [
    'Check failure reason, recovery action and status-specific meaning.',
    'Reach recovery actions by keyboard and inspect destination and subsequent focus behavior.',
    'Verify rendered fallback separately from HTTP status, Next boundary activation and telemetry.',
  ],
};

export const pageViewportChecks = [
  {
    name: 'Mobile · 390 × 844',
    checks:
      'Long Korean or English text, unbroken strings, form labels and errors, toolbar or menu access, touch targets and virtual keyboard. Inspect page-wide horizontal overflow.',
  },
  {
    name: 'Tablet · 834 × 1112',
    checks:
      'Tabs, sidebars, column transitions, table or card density, both orientations and combined touch or keyboard input. Also inspect immediately around breakpoints.',
  },
  {
    name: 'Desktop · 1440 × 900',
    checks:
      'Maximum content width, toolbar spacing, table and content scrolling, hover or focus, overlays and low heights. Repeat key tasks at 200% zoom.',
  },
] as const;
