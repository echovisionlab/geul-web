# Storybook design review evidence

Review date: 2026-10-12 (Asia/Seoul). This record identifies the reviewed source snapshots and local builds below. Later scoped changes have separate evidence.
Storybook is the review surface; production tokens, theme, Core and PageView source remain the implementation owners.

## Review entry points

Open `http://localhost:6010/?path=/story/foundations-overview--start`.
Read Getting Started, Contribution and Changelog in `Design System / Handbook`.
Use Foundations for token intent and shared geometry, Core Documentation for the public contract and live Controls,
Patterns for composed tasks, and Pages for production Views with explicit fixture/service boundaries.

Documentation is English. Language changes the running product UI; authored user content retains its own language.
Theme selects Light, Dark, Ocean Light or Ocean Dark from the same shared registry. Custom presets override existing
semantic roles rather than defining another component system. Viewport changes the running specimen dimensions.

The documentation structure follows these official references:

- [How to document your design system](https://storybook.js.org/blog/how-to-document-your-design-system-best-practices-tools/): component contracts, token intent, working examples, use rules and contribution criteria.
- [Structuring your Storybook](https://storybook.js.org/blog/structuring-your-storybook/): entry guidance, Documentation, Default/Playground, named states and compositions.
- [4 ways to document your design system](https://storybook.js.org/blog/4-ways-to-document-your-design-system-with-storybook/): official Docs addon with actual source, APIs, Controls and usage guidance.

## Implementation scope

- Source-derived component and page contracts link to current owners and actual CSF examples.
- Live Controls enrich only arguments exposed by a story; union branches and prohibited props remain source contracts.
- English documentation stays English under another UI locale. Locale, direction, fonts and themes reach real previews.
- Named custom themes reach document variables, portaled controls, the source editor and diagrams.
- Repository Penpot generation/synchronization, artifacts and commands have been retired. Remote projects and unrelated product connections were not deleted.
- Token and spacing cleanup is performed at the shared owner. Equal values with different semantic purposes are retained.

## Verification record

Before the later executable-title repair, the recorded story build passed 1,313 states in 244 groups, including configured play and axe checks.
No story failed or was skipped. The selected source regressions passed 409 tests in 47 files;
design-system tooling passed 137 tests. Storybook and Core type checks, scoped lint/style checks,
generated catalog freshness and shared ownership checks passed.

Browser observations cover actual controls and production page Views at 320px, 390px, 834px and
1440px, English/Korean/Arabic UI, and all four theme presets. English documentation, right-to-left
UI, portaled controls, live Controls, source notation, local table overflow and keyboard math
scrolling were checked directly. Source notation remained at least 4.5:1 against its editor,
line-highlight and selection backgrounds in each preset. Hydrated diagram examples expose one
named image, preserve authored descriptions and report no axe violations.

Documentation-only regressions additionally cover open examples across header changes,
explicit closing, independent document state and installed SDK string-control names. The
pinned Docs compatibility patch retains control IDs, callbacks, limits and read-only behavior.
These document changes follow the full application-story run; application Core, PageView and
story APIs remain unchanged. The final documentation build is checked separately in the browser.

The machine-readable [browser and execution evidence](/design-system-review/documentation-browser-review.json)
is saved at `design/storybook/documentation-browser-review.json` with screenshot paths and earlier
failed runs. It records the tested source manifest and execution conditions. The full story run
respects each story's globals; it is not a 20-language × 4-theme × device matrix. Browser viewport
overrides use a fine pointer and do not establish physical touch-device acceptance.

Recorded source regressions cover pending announcements after source unmount, Notification lifetime, custom theme
provider ownership, diagram refresh, selection eligibility descriptions, table semantics, control target geometry and
locale/documentation separation. These tests cover their stated contracts; they are not screen-reader acceptance.

## Interaction and geometry follow-up

The later review corrections are recorded at `design/storybook/interaction-review.json`.
Shared Chart tooltips appear at their measured pointer position without a position transition.
Contextual editor menus share compact Core toolbar geometry; executable runtime controls remain inline,
and nested title/source editing suppresses unrelated selection menus. File browser toolbar and content
share one inset, and list landmarks have distinct localized names. Cookie consent exposes the single
analytics preference and two explicit save/reject actions. Grip feedback changes ink without adding a
filled square; compound date values retain intrinsic spacing and a focus underline.

This follow-up has its own scoped source, story and browser evidence. It does not replace or extend
the earlier full-run result to changed source. The exact counts, reports, source/build identities,
viewport observations and screenshots are in the follow-up record.

Reorder controls retain keyboard and drag sensors. Archive, page-section and form-builder consumers
still need an explicit click/tap reorder command to establish a non-drag single-pointer alternative;
keyboard support alone does not establish WCAG 2.5.7 acceptance. Viewport emulation does not establish
physical touch or assistive-technology acceptance.

## Compact product follow-up

The subsequent compact interface corrections are documented in [the shared contract](./compact-interface-contract.md)
and have independent execution evidence at `design/storybook/compact-product-review.json`.
They affect shared progress/overlay defaults, real editor dropdown ownership, account controls, link/translation/identity
composition, upload preparation, query-aware pagination, sortable rendering and the post hero/document relationship.
Earlier counts remain attached to their snapshots and do not extend to these later source changes.
The follow-up record distinguishes source/render-count checks, browser plays and responsive observations from live
backend, asset transport, physical touch and assistive-technology acceptance.

## Remaining integration boundaries

The full 1,313-state run above precedes the later executable-title repair described in the
[changelog](./changelog.md#2026-10-12--executable-title-editing). That repair changes the nested
editor event boundary and title input value. Its scoped source, story and browser evidence is
recorded separately at `design/storybook/executable-title-review.json`; the earlier full-run
result does not claim coverage of the later source.

Pages render production Views with deterministic local data and service adapters. Authentication, authorization,
email delivery, server persistence, SSR/route loading, realtime collaboration and external media/map services require
their actual application environment. The page catalog identifies each story's excluded scope.

Automated axe checks, browser accessibility structure and keyboard plays do not establish VoiceOver/Orca acceptance.
Actual assistive-technology runs must record OS, browser, build, locale, theme, task, expected/heard output and result.
No assistive-technology or backend acceptance is inferred from story registration or passing test counts.

Authored 3D asset alternative information, map descriptions, captions and transcripts depend on supplied content.
The review does not invent missing asset descriptions or transcripts. Review results for those content/service
contracts remain separate from the shared component checks.

The user's visual design review and application deployment are separate decisions. This preparation does not record
design approval or deployment.

## Repeat the checks

```sh
pnpm design-system:generate
pnpm design-system:check
pnpm design-system:test
pnpm storybook:typecheck
pnpm storybook:build
pnpm storybook:preview
pnpm storybook:test
```

After source changes, rebuild before reviewing or testing. The static preview has no live source reload.
Record the tested build and execution conditions again; do not carry an old pass into a changed contract.
