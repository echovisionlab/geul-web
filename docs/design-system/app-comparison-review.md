# Actual consumer-view observations and reproduction plan

Updated: 2026-10-12. This document records **13 browser observations** saved from Geul Storybook 6012
and **4 Toolbar keyboard movements**. The observations cover 12 product View fixtures and one Core Button specimen.
The follow-up order remains Button → Field → Toolbar → DataTable → AppDialog.

Evidence: [portable observation report](../../design/storybook/carbon-browser-review.json).
The original report was saved at 2026-10-11 17:24:42.105 UTC; individual timestamps, DOM values and screenshots are preserved.
SHA-256 values for 42 current source files were captured later at `sourceSnapshotCapturedAt`.
Source hashes were not saved at observation time, so **equivalence between current source and historical observations is unverified**.
This documentation pass did not rerun browser interaction, tests, MCP or network checks.

## Saved browser observations

| Target                  | Observed state, theme/locale                                             | Verified scope                                                                                                                                                                                     | Screenshots: 390 / 834 / 1440                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth Button            | `pages-auth-oauth-consent--long-names`, light/ko                         | Cancel/connect actions use content width, approximately 51.77×38.30px each, padding 8×12px. Document scrollWidth matched each requested DOM viewport width.                                        | [390](../../design/storybook/previews/carbon-review/oauth-390.jpg) / [834](../../design/storybook/previews/carbon-review/oauth-834.jpg) / [1440](../../design/storybook/previews/carbon-review/oauth-1440.jpg)                   |
| Profile Field           | `pages-account-full-pages--profile`, dark/ko, one social link            | Mobile social-link/input layout. Standard container measured 390/834/992px; desktop x=224px. Editing/saving is outside this record.                                                                | [390](../../design/storybook/previews/carbon-review/profile-390.jpg) / [834](../../design/storybook/previews/carbon-review/profile-834.jpg) / [1440](../../design/storybook/previews/carbon-review/profile-1440.jpg)             |
| Posts Toolbar/DataTable | `pages-admin-content-lists--posts`, light/ko, title descending, two rows | Listening Notes and First Draft. Cards at 390px; table at 834/1440px. Wide container=390/834/1200px; desktop x=120px. Search, Filter/Sort and bulk menus=28px high; row menu=30px; glyph SVG=16px. | [390](../../design/storybook/previews/carbon-review/posts-390.jpg) / [834](../../design/storybook/previews/carbon-review/posts-834.jpg) / [1440](../../design/storybook/previews/carbon-review/posts-1440.jpg)                   |
| Posts deletion Dialog   | Same Posts story, light/ko, Listening Notes confirmation                 | Recorded role=dialog, title relationship and **initial focus on Cancel**. Width=368/446/446px; height≈151.80px. Cancel neutral/low, delete danger/strong; both actions=36px high.                  | [390](../../design/storybook/previews/carbon-review/post-dialog-390.jpg) / [834](../../design/storybook/previews/carbon-review/post-dialog-834.jpg) / [1440](../../design/storybook/previews/carbon-review/post-dialog-1440.jpg) |
| Core Button pending     | `core-actions-button--loading`, dark/en, 1440×900px                      | After correction, `Saving` appears once. Original observation recorded one AX button name `Saving` and a separate ProgressBar named `Saving`. DOM: `aria-busy=true`, native `disabled=false`.      | [pending](../../design/storybook/previews/carbon-review/button-pending.jpg)                                                                                                                                                      |

DOM observations distinguish Profile's **992px** standard width from Posts' **1200px** wide width after preview-width CSS correction.
Current stories also consume `LayoutContainer size="standard"` and `size="wide"`, backed by `62rem` and `75rem`.
Current source correspondence is separate from hash equivalence with historical code.
Posts `tableCount=2` means **DOM table count**, not data-row count. Query and screenshots show two data rows.
Do not describe the sorted end state as the initial ready query.

Pending Button is not counted as a product consumer screen.
AX names in the JSON are recorded observations; a complete AX tree is not attached.
Preserve the `SavingSaving` correction evidence without extending it to repeat-activation blocking,
spinner geometry or every naming-input combination.

### Capture scope and input conditions

The 13 original `.png` files contain JPEG bytes. Portable `.jpg` copies preserve those bytes.
Three image dimensions differ from their recorded DOM viewport; **they do not pass full-viewport visual review**.

| Screen         | DOM viewport | Actual image | Limitation                            |
| -------------- | ------------ | ------------ | ------------------------------------- |
| OAuth 834      | 834×1112     | 514×1112     | Right side is outside the capture     |
| Profile 1440   | 1440×900     | 733×900      | Right side is outside the capture     |
| Pending Button | 1440×900     | 1425×891     | Capture extent/resizing is unverified |

CUA screenshots contain actual pixels from the app pane.
Pane changes or tool resizing may explain differences, but the cause was not established.
Do not classify capture differences as product overflow. Preserve requested widths and DOM `innerWidth` measurements.
Matching dimensions in the other captures also do not establish complete design approval.
OAuth's tablet height was **1112px**; the other tablet observations used **1024px**.

The 12 product View observations recorded coarse pointer **false**. Pending and Toolbar keyboard records omit pointer conditions.
They do not verify touch/coarse behavior or VoiceOver/Orca integration.
They do not approve authenticated routes, backends, full shells, Dialog Tab containment/Escape/cancel restoration,
or all theme/locale/state combinations.

### Saved Toolbar keyboard observations

| Input                | Focus destination | Recorded outline |
| -------------------- | ----------------- | ---------------- |
| ArrowRight from Bold | Italic            | 2px              |
| Home                 | Bold              | 2px              |
| End                  | Align left        | 2px              |
| Right                | Bold              | 2px              |

Labels match the Core ToolbarSurface Formatting specimen.
The original omits story ID, time, viewport, theme and locale; exact execution context remains unverified.
Do not count these four records as verification of Posts collection toolbars, RTL, nested toolbars or input-control keyboard contracts.

## Comparison scope

- **Core specimens** isolate shared APIs, states and geometry. They are not application-consumer evidence.
- **Product View fixtures** inject local data/actions into the actual route View and controller.
  The targets below reproduce their screen and specified local behavior without login or server queries.
- **Actual routes** include Next server, authentication, authorization, server data and the parent shell.
  Historical observations used Geul dev 6012; the app did not run because required environment variables were missing.
  The current default Geul Storybook origin is **http://localhost:6010**.
  Fixture review below does not establish actual-route passes.

Shared providers consume the actual design theme, locale messages/fonts, UTC and baseline CSS.
The StoryCanvas title/locale/theme row belongs to Storybook; Pages use common inset=none.
The following page fixtures do not include the full Public/Account/Admin shell.
A placeholder child in separate `Pages/Application/Frames` stories does not prove composition with a page.
Sources: [preview](../../.storybook/preview.tsx), [StoryCanvas](../../.storybook/StoryCanvas.tsx),
[page coverage](./page-preview-coverage.md).

## Follow-up comparison targets

Reproduction links below use default origin **6010**. For another dev/static build, use the same story ID at that origin.
Confirm ID availability in the selected build's `index.json`.

| Order     | Product View fixture and consumer path                                                                                                                                                                                   | Local reproduction                                                                                                                                                      | Actual-route requirements                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button    | [OAuth Consent / Offline Access](http://localhost:6010/?path=/story/pages-auth-oauth-consent--offline-access). `OAuthConsentPagePreview → McpConsentPageView → Button`                                                   | Studio MCP/June Han data, cancel/connect forms and local completion Alert after callback. Long names: `pages-auth-oauth-consent--long-names`.                           | `/oauth/authorize/consent` requires one valid `consent_challenge`, session, author permission and Hydra request/delegation validation. Authentication, persisted consent and redirect are outside the fixture. |
| Field     | [Account / Full Pages / Profile](http://localhost:6010/?path=/story/pages-account-full-pages--profile). `MyProfilePageView → ProfileForm → ProfileFormView → Field/Input`                                                | Local author profile, nickname lookup/save callbacks, Bio count/Textarea, Website and social links. `--profile-failed`/`--profile-disabled` reproduce failure/disabled. | `/my/profile` requires the session user and `getMyProfile()` summary. Server saving and parent UserShell are outside.                                                                                          |
| Toolbar   | [Admin / Content Lists / Posts](http://localhost:6010/?path=/story/pages-admin-content-lists--posts). `PostsPageView → PostsTableContent → ServerDataTableSelectableSection → DataTableSelectionToolbar → ToolbarLayout` | Actual search, Filter, Sort, selection count and row/bulk menus; local URL query and scalar filter/sort/paging.                                                         | `/admin/posts` requires AdminLayout session/admin guard and `listPostsAdmin()`. Full AdminShell/server permissions are outside.                                                                                |
| DataTable | Same [Posts fixture](http://localhost:6010/?path=/story/pages-admin-content-lists--posts). `ServerDataTable.Content → ServerDataTableContent → DataTableView`                                                            | Listening Notes(published), First Draft(draft), domain columns, authors/dates, selection and row menus; `--posts-empty`/`--posts-error`.                                | Same `/admin/posts` requirements. Fixture filter/sort fields are a subset of the route list and do not establish complete server-query equivalence.                                                            |
| AppDialog | Select **Delete** in Listening Notes' row menu in Posts. `PostModals → ConfirmationDialog → ConfirmModal → OverlayDialog`                                                                                                | Named deletion message, Cancel and danger/strong confirmation; local row removal/focus restoration after confirmation. No server deletion.                              | No separate `/appDialog` route/component exists. Core owners are OverlayDialog and ContentModal/FormModal/ConfirmModal; this is the `/admin/posts` deletion path.                                              |

Ordinary Button defaults to neutral/medium; OAuth cancellation is neutral/low.
A submit connect action is not automatically a strong CTA.
Final deletion uses danger/strong from [confirmation intent](../../features/confirmation/ui/confirmation-intent.ts).
Admin Posts' New Post uses actual CreatePostButton with a local creation callback, providing another ordinary-command consumer specimen.

Outer `ServerDataTable.Toolbar → DataTableToolbar` and inner `DataTableSelectionToolbar` both consume ToolbarLayout.
The inner adapter uses `actions-end`. This collection toolbar checks ordinary Tab order and native search-input keys.
Do not include ToolbarSurface Arrow/Home/End command movement as this screen's pass result.

For longer Dialog body/disabled confirmation also use
[actual ArtistDeleteDialogView / Exact Impact](http://localhost:6010/?path=/story/feature-admin-delete-dialog--exact-impact),
`--loading` and `--stale-or-failed`.
This is a standalone domain View fixture, not a full app screen.
Here `--loading` means deletion-impact **query pending**, not deletion execution.
Posts' local deletion completes immediately and cannot demonstrate sustained execution pending.

Sources: [OAuth story](../../stories/pages/OAuth.stories.tsx),
[McpConsentPageView](../../features/auth/McpConsentPageView.tsx),
[Account story](../../stories/pages/MyAccountPages.stories.tsx),
[ProfileFormView](../../features/my/ui/ProfileForm/ProfileFormView.tsx),
[Admin story](../../stories/pages/AdminContent.stories.tsx),
[PostsPageView](../../features/admin/post/PostsPageView.tsx),
[SelectableSection](../../features/data-table/ServerDataTable/ServerDataTableSelectableSection.tsx),
[PostModals](../../features/admin/post/PostModals.tsx),
[ArtistDeleteDialogView](../../features/admin/artist/ArtistDeleteDialogView.tsx).
Route sources: [OAuth](<../../app/(general)/oauth/authorize/consent/page.tsx>),
[Profile](<../../app/(general)/my/profile/page.tsx>),
[Posts](../../app/admin/posts/page.tsx), [Admin guard](../../app/admin/layout.tsx).

## Core comparison specimens

| Target    | Story IDs to inspect separately                                                                                  | Limitation                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Button    | `core-actions-button--default`, `--semantic-matrix`, `--multiline-label`, `--loading`, `--disabled`              | Ordinary commands use default/neutral-medium; Primary accent/strong is not the application-wide default.            |
| Field     | `core-layout-field--basic`, `--long-content`, `--error-state`, `--inline`                                        | Field label/actions/control/error contract; product form-controller verification remains separate.                  |
| Toolbar   | `core-layout-toolbarlayout--table-controls`; `core-layout-toolbarsurface--formatting`                            | Check Layout and Surface separately; Core slots do not replace Posts consumer review.                               |
| DataTable | `core-data-display-datatableview--selectable-and-sortable`, `--compact-list`, `--inline-list`                    | Compare Core mobileLayout choices; Posts' ServerDataTableContent uses default cards.                                |
| AppDialog | `core-overlays-confirmmodal--destructive`, `--loading`, `--disabled`; `feature-confirmation-dialog--interactive` | Core/Dialog or shared confirmation-only fixture; product data, deletion impact and route authorization are outside. |

Check both source declaration and running-index availability for `core-actions-button--default`.
The 13 historical observations do not include that default specimen.

Additional long Field values appear in `feature-my-profileform--long-values`.
It uses actual ProfileFormView in a 640px/max-width:100% wrapper, not the full Profile page width.
Core specimens also have StoryCanvas and story-specific padded/centered layouts;
record whole viewport and actual control/surface width separately.

## Follow-up 390/834/1440 procedure

1. Select one origin/build; record source revision, build time, story ID, args, theme and locale.
   Static builds do not update with source. Do not assume dev and static origins represent the same build.
2. Open standalone iframes at **390×844**, **834×1112** and **1440×900 CSS px**.
   To compare historical 834×1024 records, reproduce that height separately.
   Example: `http://localhost:6010/iframe.html?id=pages-auth-oauth-consent--offline-access&viewMode=story&globals=theme:light;locale:en`.
   Verify iframe `innerWidth/innerHeight`, not window width including the manager sidebar.
   Historical tablet/desktop presets were 768/1280. Verify actual widths and explicitly set 834/1440 when needed.
   Preset names do not substitute for CSS viewport measurement.
3. Wait for fonts, locale/theme and story play completion. Compare the same state at three widths.
   Start with light/en, then dark/en and light/ko; record long de translations and ar RTL separately.
   Narrow width alone does not reproduce touch/coarse input. Record `any-pointer: coarse` and touch emulation;
   perform a separate coarse comparison where required.
4. Check Button wrap/content width/icon-indicator order/focus/pressed/disabled/loading;
   Field label/actions/control/error wrap, input size and description relationships;
   Toolbar search/Filter/Sort/menu reflow, DOM Tab order and selection count;
   DataTable cards transitions, preserved fields, selection, row menus and overflow;
   Dialog body scrolling, content/action wrap, initial focus, Tab containment, Escape and cancel restoration.
   Distinguish internal table scrolling from page-wide horizontal overflow.
5. Dialogs/menus portal into iframe `document.body`; do not capture only the story root.
   Record the open Posts deletion Dialog at each width, then verify local deletion/focus separately.
   Restart the fixture before reviewing the next state.

Posts play opens/selects/closes Filter, then changes/applies Sort.
Do not record the end state as initial ready query. Record observed sort/row order or reset identical query state first.
Reload may rerun play. `KeyboardPostDeletion` confirms removal and closes the Dialog automatically;
its end screen is not an **open Dialog** specimen.
`KeyboardProfileLinks` also adds/reorders/deletes and is separate from Profile ready.

Each result records `story ID / source·build / viewport / actual surface width / pointer / theme·locale /
state·query / screenshot / expected / observed / defect owner / unverified scope`.
Compare the documented contract with actual app View rendering to assign Core, adapter or domain-layout ownership.

## Reproduction and focused interaction commands

Run from the repository root. Declared runtime: Node 24.21.0.
Reuse an existing server when available. These commands were not run during this documentation investigation.

```sh
# Current-source Geul dev; skip if 6010 is already running
pnpm storybook

# Refresh a static build; run sequentially in a separate terminal
pnpm storybook:build
pnpm storybook:preview
```

Historical observations used Geul 6012 with default dependency resolution.
`LOCAL_CONTRACTS=1` requires sibling geul-common/src, geul-event-contracts packages/event/src and packages/proto/gen/api,
and geul-telemetry/src. It failed in the observed environment because these sibling sources were absent.
Commands below also use the default config. Use `--config vitest.local-contracts.config.ts` only when those sources are available.
Static root defaults to storybook-static; `UI_KIT_ROOT` selects another build.
App `pnpm dev` reads `.env` and starts port 3000, but starting a server does not create the required authentication,
Hydra requests or backend data for the routes above.

```sh
# Actual consumer local create/delete, Field edit/save, error/disabled and focus contracts
./node_modules/.bin/vitest run \
  stories/pages/AdminContent.test.tsx \
  features/my/ui/ProfileForm/ProfileFormView.test.tsx

# OAuth form/scope disclosure rendering only; not approve/reject behavior
./node_modules/.bin/vitest run \
  stories/pages/PageExpansions.test.tsx \
  -t 'renders actual OAuth consent forms with requested scope disclosure'

# Existing Posts/Pages Filter, Sort and deletion play in the browser
./node_modules/.bin/test-storybook --index-json --url http://127.0.0.1:6010 \
  --maxWorkers 1 --includeTags a11y-lists \
  -- --testPathPatterns pages-admin-content-lists

# Actual Profile social-link add, keyboard reorder and deletion play
./node_modules/.bin/test-storybook --index-json --url http://127.0.0.1:6010 \
  --maxWorkers 1 --includeTags a11y-account \
  -- --testPathPatterns pages-account-full-pages
```

The runner requires that build's index and browser runtime. Set `--url` to the chosen origin.
Confirm that tags/patterns selected actual tests. Browser commands execute existing play;
they **do not generate the complete 390/834/1440 matrix**.
Jsdom is not evidence for CSS layout, font measurement, native focus containment or viewport visuals.
Interaction/a11y rule passes are not design approval, actual server-route verification or VoiceOver/Orca acceptance.

Command sources: [package scripts](../../package.json), [Storybook config](../../.storybook/main.ts),
[static server](../../scripts/design-system/serve-kit.mjs), [local test config](../../vitest.local-contracts.config.ts).
Existing tests: [AdminContent](../../stories/pages/AdminContent.test.tsx),
[ProfileFormView](../../features/my/ui/ProfileForm/ProfileFormView.test.tsx),
[OAuth rendering](../../stories/pages/PageExpansions.test.tsx),
[Filter/Sort play](../../stories/pages/AdminListAccessibility.ts).
