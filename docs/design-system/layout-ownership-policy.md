# Core Layout ownership gate

The gate has no migration baseline and does not expand the existing token baseline. It screens production TS, TSX and CSS under app, components, features and lib using the same source exclusions as the token policy. Tests (including `.type-test.*`), stories, fixtures, generated and vendor files are outside this production gate.

Core Layout owns `components/core/Layout/**`. Its seven public components are LayoutStack, LayoutInline, LayoutInset, LayoutSpacer, LayoutContainer, LayoutGrid and LayoutGridItem. External consumers may use the closed public variant contract, semantic native attributes and events. The scanner rejects direct visual escape props (`style`, `styles`, `className`, `classNames`, `vars`, `unstyled`, Mantine visual props) and reserved `data-geul-*` attributes on these components. Numeric grid columns and spans are structural API values; this gate does not classify them as physical spacing.

The exact strict consumer list is exported by `scripts/design-system/layout-policy.mjs`:

- `features/document-layout/ui/ContentLayoutFieldView.tsx`
- `features/admin/MapThemeEditor/MapThemeListView.tsx`
- `features/program-event/ProgramEventSeriesPublicView.tsx`
- `features/participants/ParticipantRow.tsx`
- `features/label/LabelEditor/ui/LabelParticipantsDialogView.tsx`
- `features/post/PostEditor/ui/PostParticipantsDialogView.tsx`
- `features/artist/ArtistEditor/ArtistBioEditor.tsx`
- `features/label/LabelEditor/LabelDescriptionEditor.tsx`
- `features/release/ReleaseEditor/ReleaseDescriptionEditor.tsx`

These nine files receive the additional raw Mantine layout prohibition. This scope is explicit; other files do not become approved styling exceptions. The policy recognizes aliased named imports, namespace members, the Core root barrel and simple relative or `@/` re-export chains. It checks namespace property/index access and destructuring in strict consumers.

Outside the Layout owner, CSS selectors targeting `data-geul-layout` and `data-geul-layout-*`, private `--_layout-*` definitions/references and imports of owned Layout CSS are rejected. This includes owned CSS-module imports resolved from relative paths and literal dynamic imports. Other subsystems' native `data-geul-*` markers are preserved; they are only forbidden when supplied to a public Core Layout component.

Object-literal spreads, const aliases, nested spreads and zero-argument helpers with a single object return are inspected. Bindings resolve lexically so an unrelated function's same-name constant cannot certify a spread. Literal computed keys are inspected. Unresolved dynamic spreads produce explicit CLI warnings; they are not certified safe and do not become ESLint errors. The component's closed TypeScript props and runtime safe-attribute projection must enforce those cases. Type assertions do not bypass the scanner's object inspection.

Known limits: the scanner does not typecheck variant values, resolve arbitrary runtime component aliases or destructuring of Core component namespaces, infer arbitrary computed property names, evaluate helpers with parameters or multiple returns, follow arbitrary runtime wrappers such as CSS-in-JS styled functions, inspect React.createElement calls, or prove every descendant/global CSS selector harmless. Local import-then-export barrels without a direct re-export are not resolved. Public import resolution is syntax based, not a full TypeScript symbol graph. Source parse errors fail the gate; unresolved spread analysis remains visible. These limits require the type/runtime contract and targeted source review rather than a broader exception baseline.

Map camera `fitBounds` padding and movement duration are external runtime geometry, not CSS spacing. `features/map/hooks/useMapInteractions.ts:159–170` uses padding 80 for cluster visibility and respects `instantTransitions` for both camera durations. Authored scene palettes and map geometry remain specialist data, distinct from product toolbar and control styling.

Validation: `node scripts/design-system/check-layout.mjs`; editor rule `layout-ownership/no-escape`; negative regressions in `scripts/design-system/layout-policy.test.mjs`. Both CLI and editor call the same ownership policy. The Node tests verify import aliases, spreads/helpers/shadowing, reserved attributes, CSS ownership, exact strict scope, parse failures and valid authored geometry.
