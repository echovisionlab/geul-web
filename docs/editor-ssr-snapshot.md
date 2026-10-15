# Editor SSR snapshots

Post edit (`/posts/:id?edit=true`) and Page edit (`/:id?edit=true`) fetch the authorized editor-document RPC for `lang`, or the entity's source locale. Entity lookup supplies the canonical ID and source locale; the snapshot runs alongside the existing selector/site queries. It is not a public-content fallback. An authorization failure fails the request.

The response is display-only. Generated materialization and the live Block Room → Tiptap codec produce snapshot JSON; Tiptap's wire DOM schema, shared table presentation, editor CSS, and existing lazy media views paint the body read-only on the server. Page snapshots preserve section/column structure and use the source or localized editor presentation. No snapshot data initializes or merges into Yjs.

The room hook only publishes a Y.Doc after protocol readiness. The handoff retains the snapshot while the actual live rich-text surfaces mount, then accepts the room's content regardless of snapshot revision. It restores ancestor scroll offsets and forwards a click made while waiting to the editable view. Snapshot `editable=false` caps content/metadata mutation permission, together with existing lifecycle, locale, and revocation checks. A locale change does not reuse another locale's snapshot.

Rich-text and columns section bodies now start expanded in the source Page editor so their SSR content remains visible through handoff. Existing section controls and shared view components own the presentation; no Core tokens are changed.

## Unreleased contract wiring

`GetPostEditorDocument` / `GetPageEditorDocument` exist only in the uncommitted
`../geul-event-contracts` checkout until contracts are released. Develop and verify with
the repository's local-contract mode, which aliases the sibling sources:

```sh
LOCAL_CONTRACTS=1 pnpm storybook:local-contracts
pnpm typecheck:local-contracts
pnpm test:local-contracts
```

The published `@echovisionlab/geul-proto@0.5.0` dependency and its registered patch stay
unchanged; the plain `pnpm typecheck` fails on the two new RPC clients until the released
package is installed. Follow `../geul-api/docs/collaboration-durable-launch.md`: release
contracts, bump `@echovisionlab/geul-proto` / `@echovisionlab/geul-event` to the released
versions, drop the obsolete collection patch, run `pnpm install`, and re-run the checks
without `LOCAL_CONTRACTS`. The authorized RPCs must be deployed before these callers.

## Verification

Run `pnpm typecheck:local-contracts`, eslint on the touched files, and targeted Vitest for `EditorSnapshotHandoff`, `TiptapSnapshot`, the Post edit route, the catch-all Page route, localized Page body, table extensions, and Block Room protocol. No messages changed. After a successful build, run `pnpm perf:bundle` without updating budgets to conceal growth.

Verified with local contracts (2026-10-14): `pnpm typecheck:local-contracts` (only the
known Storybook declaration errors), full Vitest (1,077 files, 7,452 tests), ESLint,
Stylelint, `i18n:check`, `design-system:check`, Prettier, and the Storybook test-runner for
every affected story (`pnpm storybook:test:changed`, 111 stories). The snapshot handoff
story and the Post editor at 1440/390 were inspected visually. `perf:bundle` still needs a
fresh build with the released contracts.

Coordinator visual checks:

- `/posts/:id?edit=true` and `/:page-id?edit=true`, source locale and `&lang=en`: delay room bootstrap; verify readable server HTML, then handoff without blank/loader or lost scroll. Click text before ready and type after ready.
- Same routes with stale SSR revision, missing target locale, empty body, `editable=false`, archived Post permissions, reconnect/reload, and rapid locale switches. Confirm no mutation on denied permission, and `reloadReason` appears in structured room reload logs.
- Source and localized Pages with mixed sections and nested columns; long Post with headings, lists, callouts, merged tables, media, math, code, and executable blocks. Compare geometry at mobile/desktop widths, light/dark themes. Static checks do not establish visual parity for these runtimes.
- Storybook `Design System/Patterns/Editor Snapshot Handoff` → `WaitingThenReady`, `ReadOnly` (simulated readiness); the existing Post and Page editor page stories, plus `SectionItemView` and `ColumnsEditor`, for actual editor/section rendering and interactions. The new isolated story does not simulate a real Y.Doc or establish editor geometry parity.
