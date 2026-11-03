# Client bundle architecture review (2026-10-12)

This review asks whether the current first-load size is the floor. It is not. About 130 kB of the
shared JavaScript is React DOM and the Next runtime, which cannot be removed. The rest is mostly
design choices: what the root layout mounts, which modules client components import, and how the
pages fetch and validate data. Measurements use the method in [the bundle budget](./bundle-budget.md):
gzip level 9 per file, `route-first-load-modules.mjs` attribution on a `build-sourcemaps` build of the
working tree. Attribution gzip values are estimates (each chunk's ratio applied to a module's bytes).

## Shared first load (initial measurement)

This is the initial 2026-10-12 measurement, before the implementations recorded below.
Current outstanding work is listed under [Opportunities](#opportunities).

Before → after the initial changes: **294.4 → 284.2 kB** JS (24 → 23 files). CSS 35.5 kB.

| Part                                                   | ~gzip kB | Needed on every route?                                                                                                                                                                   |
| ------------------------------------------------------ | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React DOM + React + scheduler                          |       64 | Yes (framework floor)                                                                                                                                                                    |
| Next client runtime and router                         |       65 | Yes (framework floor)                                                                                                                                                                    |
| React Aria / Stately / RAC / `@internationalized`      |       72 | No. About 53 kB is overlay, collection, toast and live-announcer code from `ConfirmDialogHost` (Modal → Dialog → RAC Menu) and `AppNotificationRegion` (Toast). Can be loaded on demand. |
| `components/core` (incl. `design-tokens.ts` 3.1)       |       18 | Partly; follows the providers above                                                                                                                                                      |
| next-intl / use-intl / ICU parser                      |       12 | Provider yes; the ICU parser (about 3–6 kB) only without precompiled messages                                                                                                            |
| TanStack Query                                         |      8.5 | No. Public pages barely use it; root provider only                                                                                                                                       |
| All-locale error copy (`global-error`)                 |      5.9 | Yes, by design (renders when chunks fail)                                                                                                                                                |
| Session, cookie consent, analytics loader, theme, i18n |      ~10 | Mostly yes; consent view could be on demand (~1.5 kB)                                                                                                                                    |
| Error boundaries (`features/application-error`)        |      3.1 | Yes                                                                                                                                                                                      |
| Turbopack runtime                                      |        4 | Yes                                                                                                                                                                                      |
| ~~`@connectrpc/connect` + `@bufbuild/protobuf`~~       |   ~~10~~ | **Removed** (error boundaries only needed `instanceof ConnectError`)                                                                                                                     |

Telemetry is not in the client bundle: `instrumentation-client.ts` only dispatches a route-progress
event, OpenTelemetry is server-only, and Google Analytics loads only after analytics consent.

Layout layers on top of the shared set: `(general)` (Shell, PostSpotlight, LanguageMenu) was 42.6 kB,
now 27.7 kB; `admin` (AdminShell) about 15 kB. Admin pages with browser RPC clients add about 30 kB protobuf
and 19 kB generated descriptors on top (for example `/admin`).

## Per-document payload that is not JavaScript

Every route is dynamic (`ƒ`); only `/api/health` is static. The root layout reads cookies, headers and the
session, so no HTML can be cached by a CDN. The client message catalogue is RSC data inlined in every HTML
document; it is re-sent on every full load and is never cached like a chunk.

Since item 8 (below), each route group ships only the message paths its client components can request,
for anonymous and signed-in users alike (`lib/i18n/client-messages.ts`, [docs/i18n.md](../i18n.md)).

| Catalogue (JSON, gzip)                                                     | en kB | ko kB | Routes                                                                                        |
| -------------------------------------------------------------------------- | ----: | ----: | --------------------------------------------------------------------------------------------- |
| `public` (includes `forms` paths)                                          |  12.8 |  14.7 | Home, entity lists/details, legal, CMS pages, `/category`, `/tag`, `/user/[id]`, `/s/[token]` |
| `forms`                                                                    |  10.1 |  11.7 | `/forms/*`                                                                                    |
| `auth`                                                                     |   7.1 |   8.2 | `/login`, `/account/*`, `/verify`, `/oauth/*`, `/onboarding/*`, `/subscribe*`, `/unsubscribe` |
| `account`                                                                  |   9.7 |  11.0 | `/my/*`                                                                                       |
| `admin`                                                                    |  31.9 |  35.8 | `/admin/*`                                                                                    |
| `editor`                                                                   |  29.7 |  33.6 | `?edit=true` on public/form routes, `/campaigns/*`                                            |
| Full (before: every signed-in document and the unaudited anonymous routes) |  46.5 |  52.4 | Now only the client fallback chunk after cross-scope navigation                               |

Before item 8, the reduced catalogue was 19.5 kB (en) for anonymous users on audited public routes; everything
else received the full catalogue.

Largest namespaces: `adminList` 5.9, `pageEditor` 5.5, `editorCommon` 4.4, `common` 4.4, `tools` 2.7 kB.

## Implemented (behavior-preserving)

| Change                                                                                                                                                           | Routes                          | First-load JS (gzip)         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------- |
| `error-status.ts` uses `connectErrorShapeCode` (`lib/api/connect-error-shape.ts`), the structural test of `ConnectError[Symbol.hasInstance]`; test compares both | all 116                         | −10.2 kB                     |
| `lib/utils/menu.ts` uses `MENU_LINK_TYPE` instead of the generated `LinkType` (which loads the manifest descriptor, `media_pb` and the protobuf registry)        | all `(general)` routes          | −15 kB more (−25.3 total)    |
| Label and artist public views receive list-block props and the country name from the server (`*-public-prepared.ts`) instead of parsing with zod in the client   | `/labels/[id]`, `/artists/[id]` | −95.5 kB more (−120.8 total) |

Route mean 430.6 → 417.9 kB. `pnpm perf:bundle:update` lowered 118 budget values and raised none. Four editor
routes measured +0.4 to +1.4 kB between the two builds; that comes from concurrent working-tree edits, not
from these changes (none of their modules changed).

## Implemented: public view pages without the browser RPC stack

Items 1, 2, 3 and 5b below. Measured on an isolated snapshot of the working tree (same lockfile and
`node_modules`), `build-sourcemaps` before and after copying only these changes in, so concurrent edits do
not enter the deltas. First-load JS, gzip kB (KiB, as `perf:bundle` reports).

| Route                                          | Before | After |     Δ | What left the first load                                                       |
| ---------------------------------------------- | -----: | ----: | ----: | ------------------------------------------------------------------------------ |
| `/privacy`, `/terms`                           |  398.6 | 324.3 | −74.3 | connect-web, protobuf, `privacy_pb`/`terms_pb`, block catalogue, materializer  |
| `/privacy/history`, `/terms/history`           |  394.7 | 320.4 | −74.3 | same                                                                           |
| `/privacy/history/[id]`, `/terms/history/[id]` |  399.2 | 324.8 | −74.4 | same                                                                           |
| `/category/[slug]`, `/tag/[slug]`              |  463.4 | 386.5 | −76.8 | `post-browser` (connect-web, protobuf, `post_pb`, `common_pb`, table builders) |
| `/event-series/[idOrSlug]`                     |  474.3 | 407.3 | −67.0 | `program-event-browser` (connect-web, protobuf, `program_event_pb`)            |
| `/posts/[idOrSlug]`                            |  420.5 | 363.0 | −57.5 | `post_pb` (secure and public), `file_pb` descriptors and the protobuf registry |
| `/releases/[idOrSlug]`                         |  425.9 | 363.9 | −61.9 | `file_pb`, `block_content_pb`, download RPC client                             |
| `/works/[idOrSlug]`, `/events/[idOrSlug]`      |  401.5 | 356.7 | −44.7 | `file_pb` descriptor and the protobuf registry                                 |
| `/forms/[slug]`                                |  510.6 | 473.7 | −36.9 | `libphonenumber-js` (forms without a phone field)                              |
| `/s/[token]`                                   |  709.1 | 617.3 | −91.9 | post view proto values and `libphonenumber-js`                                 |
| `/admin/forms/[id]/builder`                    |  737.8 | 698.9 | −38.9 | `libphonenumber-js` now loads when the builder mounts (preloaded, not removed) |
| shared (all routes)                            |  284.8 | 284.8 |     0 |                                                                                |

Route mean 417.9 → 408.9 kB. Other routes moved by −2.4 to +1.6 kB (chunk regrouping; admin/editor only).
On the working tree (with concurrent edits) `pnpm perf:bundle` passed for all 116 routes; `perf:bundle:update`
lowered 116 values. It would also have raised 52 (CSS +1 KiB on `(general)` routes from concurrent style edits,
`/admin/forms/[id]/settings` JS +2 KiB); those were kept at their previous values.

- **1, generated proto values.** Constant mirrors typed with the generated enums, each with an equality test:
  `features/media-download/download-wire-values.ts` (`PublicMediaEntityType`, `FileDownloadAvailability`,
  `FileDownloadAction`), `features/post/post-wire-values.ts` (`PostStatus`, `PostAction`),
  `PROGRAM_EVENT_LOCATION_MODE` in `lib/types/program-event/location-mode.ts`. `AuthorizedDownloadAction`
  imports the download RPC client on the first authorization click. Enforcement:
  `scripts/performance/public-client-imports.test.ts` walks every route entry outside `admin`, `my`,
  `campaigns` and `editor-lab-local` from the server component into its `'use client'` graph (static imports;
  `import()` and type-only imports are allowed; `'use server'` and `server-only` modules stop the walk) and fails
  on `@echovisionlab/geul-proto`, `@bufbuild/protobuf`, `@connectrpc/connect-web` or `libphonenumber-js`, printing
  the import chain. It fails on the pre-change tree with these routes. An ESLint rule could not see the
  server/client boundary, so this is a test.
- **2, legal pages.** The server already rendered the document and passed it as `initialData`; the queries keep
  the same keys and `initialData`, but their `queryFn`s import `privacy-browser`/`terms-browser` on demand. The
  browser module loads only for `?preview&token`, a failed server fetch, or a refetch of stale data (window
  focus after 60 s), exactly when it ran before. Output, TOC, language menu, print and history links are unchanged.
- **3, listings.** `/category` and `/tag` render the first page on the server
  (`lib/queries/post-taxonomy-list.server.ts`, same request builder as the browser query, now in
  `post-taxonomy-list.ts`) and pass it as `initialData` for the default query; search, filters, sorting and
  pagination stay client state and import `post-browser` on the first change. Visible difference: the first page
  is in the HTML instead of a loading table until the browser fetch returns. `/event-series` already rendered its
  first page; the type filter options now come from the server too (`listProgramEventTypeOptions`), and the
  list/“show more” fetchers import `program-event-browser` on demand. On a server fetch failure the pages fall
  back to the previous browser fetch.
- **5b, phone validation.** `PhoneField` is a `next/dynamic` import (SSR on). `FormRenderer` preloads it when the
  form has a `tel` field, so later steps do not wait; the form builder preloads it on mount. The value shape and
  empty check moved to `lib/types/phone/phone-number-data.ts` (no `libphonenumber-js`); `useFieldValidation`
  imports `PhoneNumber` for the debounced format check, which the phone field has already loaded.

Not done here: the lazy rich-text runtime (`DefaultBlockView`, `GeneratedFileBlockView`) still imports block and
file enums; it is not first-load JS but loads on every page with content. `/my/*`, `/campaigns/[id]` and admin
routes keep their proto imports (allowed by the test).

## Implemented: on-demand overlays, server-rendered shell, scoped React Query (items 4, 5, 6)

**Overlay hosts (4).** `ConfirmDialogHost` and `NotificationHost` (`AppNotificationRegion` uses it) render nothing
until the first `confirmDialogs.open()` / `notifications.show()`; then they load the renderer
(`ConfirmDialogStack`, `NotificationRegion`) and stay mounted. Requests made earlier wait in the module stores
(`confirm-dialog-store.ts`, the `ToastQueue`) and appear when the chunk arrives; a failed chunk request is retried
(0.5, 2, 5 s) instead of dropping them. Toast timers start when a toast is displayed, as before. The trigger keeps
focus while the renderer loads, so the dialog restores focus to it. `loading="eager"` exists for Storybook/tests.

**Shell (6).** `features/shell/Shell.tsx` is a server component: it reads the manifest, settings and `shell`/`common`
messages for the request and renders `ShellLayout` (header structure, menus, footer copy, version, social links)
inside `ShellRuntime`. `ShellRuntime` (client) owns what the client must decide: navigation/account panel state,
the session user (cookie snapshot while the session resolves), theme mode, the current route (active items, closing
the drawer on navigation), the login return path, the role-gated changelog link and the platform shortcut label.
Islands in `ShellIslands.tsx` read it from context: menu toggle, home/secondary/footer links, search and theme
buttons, account menu/drawer, desktop navigation, cookie/changelog actions, plus `LanguageMenu`. Menus, hints and
drawers use the new Core variants `OnDemandDropdownMenu`, `OnDemandTooltip` and `OnDemandDrawer`: the trigger is
built from React Aria's trigger hooks and renders/hydrates without the Menu, Popover, Tooltip or Modal modules; the
surface loads on first pointer enter, focus or press (`ApplicationFrame` preloads its drawer from the toggle) and is
shown as soon as it arrives. The drawer's navigation list (Disclosure groups) is its own chunk, and the drawer opens
when both are ready, so it never opens empty. Post search mounts through `PostSpotlightLauncher`: the shortcut and the
open event are handled immediately, the palette (CommandPalette) loads on the first request or when a search button is
hovered/focused, and the pending-open flag keeps the first request. `ShellView` (Storybook/tests) keeps its controlled
props API and renders the same `ShellLayout` through a state provider. `SocialLinksDisplayView` (footer) and
`ContentLanguageMenu` (content pages) switched to the on-demand variants too.

**React Query (5).** No root provider. `ReactQueryProvider` (one browser `QueryClient`, so the cache is shared as
before) sits in the `admin` and `my` layouts and in provider-only layouts for the routes whose render path reaches
React Query: `/posts/[idOrSlug]` (comments), `/user/[id]`, `/unsubscribe`, `/category/[slug]`, `/tag/[slug]`,
`/event-series/[idOrSlug]`, `/privacy`, `/terms`, `/forms/[slug]`, `/s/[token]`, `/campaigns/[id]`,
`/editor-lab-local`. Lazy roots that use it (editors behind `?edit=true`, map/form block runtimes, post search) wrap
themselves with `withQueryClient(import(...))`, which loads the provider with the chunk. `LanguageMenu` no longer uses
`useMutation`. Guard: `scripts/performance/query-provider-placement.test.ts` runs `route-package-reach.mjs`
(static vs `import()`-only reach of a package per route, server and client modules) and fails if a route that reaches
React Query has no provider in its layout chain, if a lazy root is unwrapped, if the root layout imports the provider,
or if `/`, CMS pages, `/artists/[id]`, `/works/[id]`, `/login` or `/sitemap` reach it statically.

**Measured.** Baseline: APFS clone of the working tree before these changes; after: the working tree, both
`build-sourcemaps`. Concurrent edits (zod/mini, phone field) are in the after build, so only rows whose
`route-first-load-modules.mjs` attribution changed only in the packages below are listed. First-load JS gzip KiB.

| Route                        | Before | After |     Δ | Left the first load (attributed ~gzip)                                                  |
| ---------------------------- | -----: | ----: | ----: | --------------------------------------------------------------------------------------- |
| shared (all routes)          |  284.8 | 220.7 | −64.1 | 23 → 18 files                                                                           |
| `/` (CMS `/[...slug]` −68.5) |  345.0 | 276.4 | −68.6 | react-aria −36.7, RAC −10.3, query-core −9.1, react-stately −4.2, Core −3.6, shell −1.1 |
| `/login`                     |  330.5 | 265.8 | −64.7 | react-aria −32.9, RAC −9.5, query-core −9.1, react-stately −4.2, Core −4.0              |
| `/privacy`, `/terms`         |  324.3 | 267.1 | −57.3 | same overlay groups; React Query stays (legal queries use `initialData`)                |
| `/artists/[idOrSlug]`        |  354.8 | 329.7 | −25.1 | query-core −9.1, react-aria −6.6, RAC −3.9 (the page's `ArtistWorkSection` keeps menus) |
| `/works/[idOrSlug]`          |  356.7 | 333.7 | −23.0 | same pattern                                                                            |
| `/posts/[idOrSlug]`          |  363.0 | 353.7 |  −9.3 | react-aria −5.0, RAC −1.5 (comments keep React Query and eager menus/tooltips)          |
| `/admin`                     |  359.2 | 352.4 |  −6.8 | react-aria −4.7, RAC −2.2                                                               |

The 40 public `(general)` routes moved by −9.3 to −71.9 (mean −56.6). Editors and admin keep their eager overlays
(+0.7 to +1.9 on four editor routes: the small light trigger modules are now separate from the eager ones).
`/admin/forms/[id]/builder` grew +45 from a concurrent change (`FormBuilder` now imports `PhoneField` statically,
`libphonenumber-js` 37.6), so `pnpm perf:bundle` fails on that route and the budget was not regenerated.

**UX parity evidence.** Server-rendered markup of `ShellView` in four states (anonymous, pending theme, cookie
snapshot, signed in) is identical before/after except React `useId` strings (`.artifacts/performance/shell/markup`).
`OnDemandDropdownMenu`/`OnDemandTooltip` tests compare their SSR markup with the eager components and check opening
before the surface loaded (focus moves into the menu), item actions, Escape and focus return, `aria-describedby`.
Host tests open a confirmation and a toast queued before the renderer existed and restore focus to the trigger.
`scripts/design-system/story-screenshot-compare.mjs` compared 26 Storybook cases on a baseline and the current
Storybook (frames public/signed-in/nested navigation and public documents with the shell harness; 1440 and 390 px;
light and dark; hovered search and theme tooltips, open account menu, hover navigation menu, open navigation
drawer, open language menu, footer): 0 differing pixels in every case.

**Not verified / follow-ups.** Real-network first-open latency was not measured in a browser (Storybook preloads
the surfaces; the production app needs a backend). Public page components that still import eager overlays and keep
them in their routes' first load: `CommentItem`, `PostHeader`, `LocationPlaceMenu` (posts), `ArtistWorkSection`
(artists); each is a one-line switch to the on-demand variant. Found, unchanged (same before/after): on phones the
signed-in account drawer closes about 50 ms after opening in the Frames story, probably because the hidden desktop
account `DropdownMenu` receives the same `opened` state (not verified); production uses the same structure and should be checked.

## Opportunities

Savings are first-load gzip unless stated. "Measured" means a build or fixture in this review;
"attributed" means the bytes of the modules that would leave, from `route-first-load-modules.mjs`.

### Needs an owner decision

| #   | Item                                                                                                                                                                                                                                                                                                                                      | Saving                                            | Routes        | Effort | Risk / UX                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------- | ------ | ---------------------------------------------------------------------------------------- |
| 9   | **Cacheable public HTML.** Move session, colour scheme and messages selection out of the root layout's per-request inputs so anonymous public pages can be static/ISR (locale in URL or `Vary`).                                                                                                                                          | TTFB and server cost, not bytes                   | public routes | XL     | Architecture change; locale routing                                                      |
| 10  | **CSS chunking `graph`.** `experimental.cssChunking: { type: 'graph', requestCost: 20000, weightDistribution: 0.5 }` measured: shared CSS 35.7 → 22.1 kB, route mean 37.1 → 30.0 kB, but CSS files per route 5.0 → 13.2. The default `loose` mode puts editor CSS (Tiptap, toolbar, video controls, shader nodes, ~8 kB) in the root CSS. | −7 kB render-blocking CSS mean (measured)         | all           | S      | Experimental option; cascade order across chunks must be visually checked; more requests |
| 11  | **next-intl `experimental.messages.precompile`.** Removes the ICU parser from the client and formats faster.                                                                                                                                                                                                                              | −3 to −6 (attributed parser + intl-messageformat) | all           | M      | Experimental; message catalogue loader change; `t.raw` callers must be audited           |

### Not recommended

- React Compiler: adds memo-cache code to every component (larger bundles); its benefit is render work in editors, not size.
- `optimizePackageImports`: Turbopack already drops unused barrel exports through `sideEffects`; `@tabler/icons-react` is optimized by default.
- Theme CSS: only light/dark variables are emitted (3.6 kB gzip of tokens); presets live in `lib/theme/themes.ts`. No unused theme CSS.
- Fonts: one stylesheet per locale profile from the CDN with `preconnect` and `display=swap`; `Noto Color Emoji` subsets download only for emoji glyphs.

## Item 8: scoped client messages (implemented)

**Design.** The provider structure stays the same: one `NextIntlClientProvider` in the root layout. Only its
`messages` input changed. `resolveClientMessageScope(path)` (`lib/i18n/client-message-scope.ts`, client-safe)
maps the request path to `public`, `forms`, `auth`, `account`, `admin` or `editor`. `?edit=true` and
`?view=edit` select `editor`, because public and form routes render their editor for that query.
`selectClientMessages` copies that scope's message paths from
`lib/i18n/client-message-scopes.generated.ts`. The paths are namespaces or sub-trees. For example, public
pages get `pageEditor.embed`, `pageEditor.blockEditor.badges.posts` and `editorCommon.media` instead of all
of `pageEditor` and `editorCommon`. `pnpm i18n:scopes` generates the file
(`scripts/i18n/client-message-scopes.mjs`). For every `app/**/page.tsx`, with and without `?edit=true`, it
walks the client-reachable modules of the page and its ancestor layout/error/not-found files and collects
their `useTranslations` paths. Edit-only modules (`EDIT_MODE_MODULES`) count only toward `editor`.

The root layout passes `clientMessageCoverage(path)`, the scopes that the inlined catalogue can serve.
When client-side navigation leaves those scopes, `ClientMessagesProvider` loads the complete catalogue
chunk, as before. For signed-in users, it prefetches that chunk when the browser is idle, so moving to
`/my`, `/admin` or an editor does not wait.

Nested route-group providers were not used. They would put providers in `(general)/layout.tsx` and in
every edit route, and edit modes depend on search params, which layouts cannot read.

**Guard.** `lib/i18n/client-message-scopes.test.ts` fails, with the import chain, if any client
component's `useTranslations` path is missing from its scope. It also fails on unregistered dynamic
namespaces, and on edit-mode modules imported by a route that does not branch on `?edit=true`.
`pnpm i18n:check` (CI) fails when the generated file is stale.

**HTML documents.** Measured on a snapshot build (`next start`, signed out) with
`scripts/performance/html-document-size.mjs`. A mock answered only the manifest RPC, so page bodies show
their not-found/error state. Only the root layout's inlined catalogue differs between the two builds.

| Route                      | Before gzip kB | After gzip kB |     Δ | Catalogue JSON raw kB (before → after) |
| -------------------------- | -------------: | ------------: | ----: | -------------------------------------: |
| `/`                        |           30.8 |          23.9 |  −6.9 |                            62.4 → 40.7 |
| `/posts/example`           |           30.2 |          23.4 |  −6.7 |                            62.4 → 40.7 |
| `/privacy`                 |           31.6 |          24.8 |  −6.8 |                            62.4 → 40.7 |
| `/about` (CMS page)        |           54.2 |          18.9 | −35.3 |                           160.6 → 40.7 |
| `/category/example`        |           54.1 |          18.8 | −35.3 |                           160.6 → 40.7 |
| `/login`                   |           58.6 |          17.0 | −41.6 |                           160.6 → 21.7 |
| `/forms/example`           |           54.8 |          16.6 | −38.3 |                           160.6 → 30.3 |
| `/my`                      |           54.3 |          15.6 | −38.7 |                           160.6 → 29.6 |
| `/admin`                   |           53.9 |          38.6 | −15.3 |                          160.6 → 107.3 |
| `/posts/example?edit=true` |           54.4 |          36.9 | −17.5 |                           160.6 → 99.6 |

For signed-in users, every document used to carry the full catalogue (the "before" rows for `/about` and
later). They now get their scope's catalogue: about −30 to −41 kB gzip on public, account and auth
documents, and about −15 to −18 kB in admin and editors. The cost is one cacheable chunk, prefetched when
idle.

## Item 7: client zod → `zod/mini` (implemented)

**What changed.** Every client-reachable module that imported classic `zod` now validates with `zod/mini`
through `@/lib/zod-mini` (`lib/zod-mini/index.ts`). That module re-exports `zod/mini` and installs the English
locale once (`config(en())`); classic zod installs it on its first schema, `zod/mini` does not, and without it
default messages would read "Invalid input". It is listed in `package.json` `sideEffects` so the `config` call
is kept. Both entry points run the same `zod/v4/core` parser, so the migration is an API translation:
`.optional()` → `z.optional()`, `.default()` → `z._default()`, `.min()`/`.max()` → `.check(z.minLength()/z.gte()…)`,
`.refine()`/`.superRefine()` → `.check(z.refine()/z.superRefine())`, `.transform()` → `z.pipe(…, z.transform())`,
`z.preprocess(fn, s)` → `z.pipe(z.transform(fn), s)` (classic builds the same pipe), `.strict()` → `z.strictObject`,
`.extend()`/`.partial()` → `z.extend()`/`z.partial()`, `.catch()` → `z.catch()`. Shared schemas used by the server
moved too (one definition; the server runs the same parser).

Migrated (43 modules): the public form runtime (`lib/form/validation-zod.ts`, `build.ts`), `lib/types/form`
(`schema.ts`, `guards.ts`), `lib/types/phone` (`PhoneNumber.ts`, `phone-number-data.ts`), the list-input factory
`lib/types/trpc/schema.ts` and the release/user schemas built on it, `lib/types/common/social-links.ts`,
`lib/types/map-block/schema.ts`, all 25 page-block schema modules under `features/page/blocks`, the collaboration
protocol (`lib/collab/block-room-bootstrap.ts`, `block-room-protocol.ts`, `TypedMetaMap.ts`, the form and
campaign field schemas), `lib/upload/upload-session-store.ts`, and the Member criteria date picker
(`features/admin/member-criteria/criteria-date.ts`, extracted from `MemberCriteriaConfigFields`). `TypedMetaMap` and
`useCollaborativeTypedState` accept any `zod/v4/core` object schema, because map-theme and metadata-AI maps use
Common's classic schemas. Two moves avoided a migration: `createMapThemeInputSchema` (only used by the
create-theme server action; it extends Common's classic schemas) moved to `lib/types/map-theme/input-schema.ts`
(`server-only`), so `schema.ts` (theme defaults, imported by the theme list) has no zod; and Common's runtime-event
parser (`parseEditorRuntimeEventMessage`, classic zod) is loaded with `import()` when the first provider
subscription starts (`lib/collab/subscribe-runtime-events.ts`). Events that arrive before that chunk are queued and
delivered in order once it loads, then delivery is synchronous as before; unsubscribing drops the queue. That
import was the only classic zod on `/my/*` and on admin pages that can upload files.

**Equivalence evidence.** Before any schema changed, `lib/zod-mini/equivalence-cases.ts` (153 cases,
1,820 inputs: every field type × validator predicate × custom/default messages, conditional forms with
`superRefine` paths, persisted form/condition schemas, list inputs with every filter type, every page-block parser
with defaults, enum and type violations, section and nested column schemas, immersive scene units, collaboration
field schemas and `TypedMetaMap`, the bootstrap envelope, upload session storage, the segment date coercion) was
run against the classic schemas and recorded in `equivalence.golden.json`: `success`, parsed data, every issue
(code, path, message, extra fields) and thrown messages. `equivalence.test.ts` replays the table against the
migrated code and requires the same outcomes (time zone and clock pinned for the date validators). It passed
unchanged after the migration; its outcomes included 931 issues with zod's default English messages (60 distinct, such as "Invalid input: expected string, received number"), so a missing locale
failed it. On 2026-10-18 the table and its 20,000-line golden file were retired: a recorded output that size could
not be reviewed, and it pinned the classic schemas' output rather than the stored contracts. Parse tests next to
each block, section and form schema now take their expected defaults and rejections from the shared block catalog. Two fixture edits after recording were identity changes: color strings renamed to non-color strings
(design-token scan) and a random-length Yjs update size removed from one snapshot. The existing suites
(`validation-zod`, `build`, page blocks, block-room protocol/bootstrap, upload store, map theme) pass unchanged.

Known differences, none observable in the UI: thrown errors are named `$ZodError` instead of `ZodError` (same
class hierarchy, same `message` and `issues`; no code reads the name), and `zod/mini` installs no cycle memoizer, so
a cyclic input object would overflow the stack in the recursive form-condition and column schemas instead of
parsing. Inputs come from JSON and Yjs, which cannot be cyclic.

**Enforcement.** `scripts/performance/client-zod-imports.test.ts` builds the client module graph
(`scripts/performance/client-module-graph.mjs`: from every `'use client'` module through value imports, re-exports
and `import()`, skipping type-only imports and `'use server'` modules) and fails, with the import chain, when a
client-reachable module imports `zod` or any `zod/*` entry other than through `@/lib/zod-mini`. It also pins the
client imports of Common modules that use classic zod (it follows Common's source) so new ones fail review.
Server-only modules (22 files, for example `lib/env.ts`, `lib/types/work/schema.ts`, the post/work meta schemas)
keep classic zod. `node scripts/performance/client-module-graph.mjs . --package zod` lists offenders,
`--why <file>` prints a chain.

**Measured.** `build-sourcemaps` of the working tree before and after (other agents were editing, so route totals
moved for other reasons too); zod bytes are attributed from source maps, gzip kB (1000 bytes). Before, every route
below loaded the same 89.6 kB classic zod chunk (core, classic API and all 40+ locales).

| Routes                                                                                                                                                                                                | zod before | zod after |        Δ | Left in the first load                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | --------: | -------: | ------------------------------------------------------------------------------------- |
| `/my`, `/my/artists`, `/my/posts`, `/my/profile`, `/my/security`, `/my/series`, `/my/settings`, `/my/works`                                                                                           |       89.6 |         0 |    −89.6 | none                                                                                  |
| `/admin/clients/[id]`, `/admin/files`, `/admin/settings`, `/admin/translations`, `/admin/translations/jobs`, `/admin/users/[id]`, `/admin/map/themes`                                                 |       89.6 |         0 |    −89.6 | none                                                                                  |
| `/forms/[slug]`, `/s/[token]`, `/admin/member-criteria`                                                                                                                                               |       89.6 |      27.1 |    −62.5 | `zod/mini` 2, core 24.4, English locale 0.7                                           |
| Editors and editor-backed admin pages (`/campaigns/[id]`, `/admin/campaigns/[id]`, email templates/layouts, form builder/settings/translations, menus, series, map theme editor, `/editor-lab-local`) |       89.6 | 92.8–94.8 | +3 to +5 | classic zod via Common, plus `zod/mini` (1.9) where editor code uses migrated schemas |

Route totals in the same builds: `/forms/[slug]` 522.8 → 418.6, `/s/[token]` 726.1 → 564.1, `/my/security`
528.9 → 424.2, `/admin/member-criteria` 533.2 → 467.7 kB (these include concurrent changes; the zod column is
the part this item explains). `zod/mini` core is 24 kB under Turbopack, not the 6.7 kB esbuild fixture: Turbopack
keeps the whole `core/schemas.js` and `core/api.js` modules. On editors the attribution total is a little higher
partly because the classic chunk is now split across more chunks. `pnpm perf:bundle` passes; the budget was
regenerated from this build keeping the lower of old and new values (CSS budgets raised by concurrent CSS edits were
not raised).

**Geul Common moved to `zod/mini` (0.5.0).** Editors used to keep classic zod through Geul Common's collaboration
modules. Common 0.5.0 (echovisionlab/geul-common#29) migrates all 16 schema modules to `zod/mini`; a golden file
recorded with classic zod (69 cases, 1,585 inputs) proves identical results. This repository adopted that migration and now consumes Common 0.7.2;
three server-side derivations use the functional API (`zm.pick`/`zm.required`, `zm.safeExtend`, `zm.extend`), and
`scripts/performance/client-zod-imports.test.ts` requires that no Common module reaches classic zod. Measured in the
integrated build (first-load JS, gzip): `/campaigns/[id]` 888.2 → 817.0, `/admin/campaigns/[id]` 856.6 → 785.2,
`/admin/email-templates/[id]` 804.5 → 732.7, admin form settings 785.1 → 711.7, builder 746.8 → 674.7,
`/editor-lab-local` 990.3 → 918.0 kB. The collab server configures the English zod locale at startup
(geul-editor-collab 0.4.1).
