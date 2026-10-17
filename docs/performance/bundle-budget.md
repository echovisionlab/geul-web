# Client bundle budget

Every route's first-load client JavaScript and CSS has a checked-in gzip budget.
`pnpm perf:bundle` reads the existing production build output (`.next`) and fails
when a route, the shared set, or an unbudgeted new route exceeds it. It does not
build. CI runs it immediately after `pnpm build` in the `quality` job.

What the shared set contains, what each route group adds, and the remaining design options are in
[the bundle architecture review](./bundle-architecture-review.md).

```sh
pnpm build                 # or: node scripts/performance/next-client-build.mjs <tree> build
pnpm perf:bundle           # report + check against scripts/performance/route-bundle-budget.json
pnpm perf:bundle:update    # rewrite the budget from the current build (review the diff)
node scripts/performance/route-bundle-budget.mjs . --json .artifacts/performance/routes.json --top 40
```

## What is measured

First load = `build-manifest.json` `rootMainFiles` plus every `entryJSFiles` /
`entryCSSFiles` list in the route's client reference manifest (root and segment
layouts, error and not-found boundaries, and the page). This set equals Next's own
`.next/diagnostics/route-bundle-stats.json` `firstLoadChunkPaths` for all 116 routes.
Lazy chunks (`next/dynamic`, `import()`) and the legacy `nomodule` polyfill are
excluded. Sizes are per-file gzip level 9 (budgeted) and brotli quality 11
(reported). They are not CDN transfer or request counts.

The budget is generated with headroom of max(3%, 4 KiB), rounded up to 1 KiB.
A route missing from the budget must fit the 75th-percentile route; add it with
`pnpm perf:bundle:update` when it is intentionally larger. Regenerating the budget
is a reviewed decision. Do not raise it to make an unexplained regression pass.

## Email authoring measurement (2026-10-16)

The email line-break change adds GitHub-style Markdown paste and a selection formatting
menu to the email/campaign editor. Source tracing with `route-package-reach.mjs` confirms
the new static path from `EmailTiptapEditor.tsx` through `markdown-paste.ts` to
`react-markdown` and `remark-gfm`. The contextual selection menu is also a new static
dependency of that profile. The existing full editor already uses these facilities.

[PR #137 CI run 38870898175](https://github.com/echovisionlab/geul-web/actions/runs/38870898175)
built commit `566764ffcbfafe6272b8c3d387dc212b43828c45` successfully, then reported
these first-load JS values for build `D2Se--Khoh1JLRegkLilk`:

| Route                         | Measured gzip | Previous budget | Updated budget |
| ----------------------------- | ------------: | --------------: | -------------: |
| `/(general)/campaigns/[id]`   |     907.9 KiB |       869.0 KiB |      936.0 KiB |
| `/admin/campaigns/[id]`       |     878.0 KiB |       835.0 KiB |      905.0 KiB |
| `/admin/email-templates/[id]` |     824.9 KiB |       781.0 KiB |      850.0 KiB |

Only these three JS limits are updated for the additional authoring functionality.
The limits retain the standard 3% headroom, rounded up to 1 KiB; using the upper edge
of the CI report's 0.1 KiB rounding gives the same integer limits. Shared JS, CSS and
all other route budgets remain unchanged. The budget's `measuredBuildId` still
identifies the earlier whole-app baseline; this section records the scoped update.

This source trace identifies the added dependency paths, not exact per-package gzip
attribution. The CI run did not retain source maps. Loading the editor or parser on
demand is a separate optimization that needs first-paste and selection interaction
verification; the current change preserves synchronous authoring behavior.

## Site logo slots and editor chunking (2026-10-17)

PR #143 (logo slots, contracts 0.10.0) measured with `next-client-build.mjs . build-sourcemaps` against a
`main` build:

- `/admin/settings/og-image` gained the OG background uploader (drop zone, cropper, upload protos,
  +76 KiB). `SiteOgImagePanel` now loads the uploader with `next/dynamic`, so the route stays within its
  unchanged 426 KiB budget.
- Editor routes load `geul-proto/content/block_content_pb.ts` (86.8 KiB raw) twice: once alone and once
  inlined into the block-room codec chunk, both in the page's chunk group. A commit bisect places the change
  at the contracts 0.10.0 bump together with the logo-slot commit that needs it; the proto files' imports are
  unchanged, so module sizes moved Turbopack's chunk-merging, not the module graph. Next 16.3 exposes no JS
  chunking control. The editor runtime no longer imports the block-room journal (and with it the codec) only
  to ask whether it has settled (`block-room-journal-durability.ts`), but the codec still reaches these
  routes through translation previews, so the duplicate remains.

Only these five JS limits are raised (standard headroom, max(3%, 4 KiB), rounded up to 1 KiB):

| Route                               |   Measured | Previous budget | Updated budget |
| ----------------------------------- | ---------: | --------------: | -------------: |
| `/(general)/campaigns/[id]`         |  936.8 KiB |       936.0 KiB |      965.0 KiB |
| `/admin/email-templates/[id]`       |  851.6 KiB |       850.0 KiB |      878.0 KiB |
| `/admin/forms/[id]/(edit)/settings` |  751.3 KiB |       750.0 KiB |      774.0 KiB |
| `/admin/series/[id]`                |  695.9 KiB |       691.0 KiB |      717.0 KiB |
| `/editor-lab-local`                 | 1010.3 KiB |      1008.0 KiB |     1041.0 KiB |

Removing the duplicate means loading the block-room codec behind `import()` on these routes, which needs the
translation preview and collaboration startup to tolerate an asynchronous codec; that is a separate change.

## Finding the cause of a regression

```sh
node scripts/performance/next-client-build.mjs <tree> build-sourcemaps
node scripts/performance/route-first-load-modules.mjs <tree> /login --route-only
node scripts/performance/route-first-load-modules.mjs <tree> /_not-found --modules --top 40
node scripts/performance/route-package-reach.mjs . --package @tanstack/react-query --why /posts/[idOrSlug]
```

`build-sourcemaps` is the same production build plus client source maps
(`GEUL_BUNDLE_SOURCEMAPS=1`, read only by `next.config.mjs`). The attribution tool
uses Next's URL route names. It reports exact generated bytes per module or package
and a gzip estimate, and it labels modules without maps (JSON) separately.
`route-package-reach.mjs` works from source (no build): which routes reach a package statically or only behind
`import()`, with the import chain (`--why`) and the lazy roots (`--boundaries`).
`next-analyzer-modules.mjs` reads `next experimental-analyze --output` data, which
includes lazy chunks.

Two Turbopack behaviours dominate:

- `package.json` `sideEffects` decides whether unused barrel re-exports can be
  dropped. Without it, every Core module imports a CSS module and is treated as
  side-effectful, so `@/components/core/Input` shipped every Input variant. Modules
  imported only for their effects (bare `import './x'`) must be listed;
  `scripts/performance/side-effects-declaration.test.ts` enforces this.
- A module's used exports are computed for the whole app, not per route. One
  `import { siGithub } from 'simple-icons'` emits every icon used anywhere, and a
  constant imported from a zod schema module brings zod with it. Keep client
  constants in dependency-free modules.

## Measurement (2026-10-12)

Isolated trees: baseline is HEAD `6a5c53d` in a detached worktree; current is a
snapshot of the working tree's tracked and non-ignored files, excluding dotenv files.
Both use the same lockfile, `pnpm install --frozen-lockfile --offline`, Node
24.21.0, Next 16.3.8 Turbopack, and serialized `next-client-build.mjs` builds.
"Before fix" is the uncommitted Core migration. "After" adds the fixes below
(and concurrent working-tree edits). Values are first-load JS in kB, gzip level 9.

| Route                |   HEAD | Before fix |  After |
| -------------------- | -----: | ---------: | -----: |
| Shared (all routes)  |  329.8 |      342.2 |  330.4 |
| `/`                  |  495.7 |      503.4 |  410.9 |
| `/posts/[idOrSlug]`  |  591.5 |      674.0 |  469.3 |
| `/works/[idOrSlug]`  |  590.7 |      673.7 |  471.9 |
| `/labels/[idOrSlug]` | 1078.3 |     1184.2 |  515.6 |
| `/login`             |  469.2 |      551.5 |  396.5 |
| `/my/security`       |  604.8 |      626.1 |  542.5 |
| `/admin`             |  430.5 |      428.5 |  411.2 |
| `/admin/users/[id]`  |  642.5 |      758.4 |  594.3 |
| `/editor-lab-local`  | 1171.5 |     1265.6 | 1150.0 |
| `/campaigns/[id]`    |  985.8 |     1135.2 | 1065.5 |
| Mean of 116 routes   |  516.1 |      560.3 |  477.3 |

First-load CSS fell from a 58.3 kB to a 37.7 kB route mean after Mantine removal.
Twelve routes remain above HEAD: campaign and email-template editors (+67 to +80),
the public `/forms/[slug]` (+40), and form/audience admin routes (+3 to +22).

Fixes, by effect:

- `sideEffects` declaration: unused Core barrel exports dropped (for example /login −127 kB).
- `features/page/blocks/embed/limits.ts`: client embed policy no longer imports the
  zod schema, which removed classic zod and list schemas from `/`, pages and posts (about −66 kB).
- Lazy label editor on the public label page (`LazyAdminLabelDetailClient`, −595 kB).
- `SocialIdentityIcon`: login and account-email surfaces without the 37-icon catalog (−16 kB).
- Avatar cropper loaded on demand and the editor-runtime context split from its Yjs
  provider: `/my/*` −52 kB.
- Error-page particles loaded on demand (each error boundary had a copy): about −8 kB shared.

## Round two (2026-10-12)

Measured in place on the working tree (no dotenv files) with `next-client-build.mjs . build-sourcemaps`
before and after. Values are first-load JS in kB gzip level 9. Every route decreased; `pnpm perf:bundle:update`
lowered 213 budget values and raised none.

| Route                         | Before | After |
| ----------------------------- | -----: | ----: |
| Shared (all routes)           |  331.1 | 319.8 |
| `/forms/[slug]`               |  930.1 | 524.7 |
| `/campaigns/[id]`             | 1063.2 | 899.1 |
| `/admin/campaigns/[id]`       | 1024.0 | 860.1 |
| `/admin/email-templates/[id]` |  971.7 | 807.2 |
| `/editor-lab-local`           | 1146.3 | 994.6 |
| `/works/[idOrSlug]`           |  469.7 | 431.3 |
| `/artists/[idOrSlug]`         |  517.0 | 478.5 |
| `/labels/[idOrSlug]`          |  516.6 | 478.0 |
| `/releases/[idOrSlug]`        |  494.7 | 455.8 |
| `/user/[id]`                  |  441.8 | 403.5 |
| `/admin`                      |  410.8 | 387.5 |
| Mean of 116 routes            |  477.3 | 450.1 |

- Editors no longer ship Emoji data or KaTeX in any chunk that loads with the editor. `GeulTiptapEmoji`
  (`features/editor/tiptap/emoji/emoji-extension.ts`) is a schema-compatible copy of the Tiptap
  Emoji node without its bundled data. `emoji-runtime.ts` loads `emoji-data.ts` on editor focus,
  on `:` suggestion, when a picker opens, or when the document already contains an Emoji node.
  Pickers open once the data has loaded. Shortcode and Unicode conversion apply after it loads, so
  input in the first moments after the first focus, before the chunk arrives, stays plain text.
  `math-render-runtime.ts` loads KaTeX and its CSS when a math node or math editor first renders.
  The inline source stays visible until then. This removes about 105 + 74 kB, plus KaTeX CSS,
  from every editor, including the lazy post, page and work editor chunks.
- `/forms/[slug]` renders the admin `?edit=true` branch through `LazyFormEditRoute`.
  The public view never imported Yjs; the edit branch (form editor, Hocuspocus, translations panel)
  did, and the whole branch was in the public route's first load.
- Public artist, label, release, work and member profile pages receive social and streaming links
  from `prepareSocialLinksDisplay` / `prepareSocialLinkFieldsDisplay` on the server. They render them
  with the catalog-free `SocialLinksDisplayView` / `SocialIconGlyph`; output is unchanged.
- The all-locale error copy now appears once per route (only in `app/global-error.tsx`). It used to
  appear 3 to 5 times per route: in each boundary chunk and in page chunks through `QueryErrorAlert`.
  In-layout boundaries, `not-found` and `QueryErrorAlert` read the active locale from the
  `errorPage` client message namespace. That namespace is RSC data from the root layout, not a chunk,
  so these surfaces still render when chunk loading fails. `RootErrorPageView.test.tsx` keeps
  `messages/*.json` `errorPage` equal to `lib/i18n/error-page-messages.json`.

## Public runtime config and artist grid

- Public runtime settings are validated once, on the server: `lib/public-runtime-config.server.ts`
  (`server-only`, zod) is used by `app/layout.tsx` and server route handlers, and the layout
  projects the result into `<html data-geul-*>`. `lib/public-runtime-config.ts` decodes that
  projection without a schema library: URLs are used as normalized by the server, numbers fall back
  to defaults unless they are positive safe integers. A production document without the projection
  throws instead of silently using local services; development and tests use local defaults, and
  Storybook supplies `.storybook/runtime-config-fixture.ts`. `app/global-error.tsx` renders its own
  `<html>` and does not import the module. The unused `window.__GEUL_RUNTIME_CONFIG__` path is gone.
- The artist-grid page block receives server-prepared social glyphs (`ViewServer`), and none when
  `showMeta` is off, so its hydration chunk no longer carries the icon catalog. Only the editor
  canvas (`View.tsx`, lazy editor path) prepares glyphs in the browser. The route budget excludes
  dynamic chunks, so this saving is not visible in `pnpm perf:bundle`; measure the runtime chunk with
  `route-first-load-modules.mjs` when changing it.
- Public collection blocks (artists, labels, releases) use public `common.messages.no*Found` copy.
  The reduced anonymous catalogue omits `adminList`, which previously left their empty states untranslated.

## Not done

- Mantine leftovers are small. `@mantine/hooks` (71 importers) measured about 1–3 kB gzip
  per route. `@mantine/form` reaches only the eight admin/account forms that import it.
  `postcss-preset-mantine` is build-time CSS processing with no client JavaScript.
