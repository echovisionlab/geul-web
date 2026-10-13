# Toolbar API review

Reviewed: 2026-10-12, following Field. Scope: Core and actual editor/translation consumer code.
Source/type/jsdom findings are separate from product browser review. Visual approval at 390/834/1440px and Light/Dark/locales, actual touch and screen-reader checks are separate.

## Owned contracts

| Owner          | API / layout / behavior                                                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ToolbarLayout  | arrangement=flow/actions-end/actions-inline; density=compact/comfortable (default compact); justify=between/start/end/center; inset=none/content; divider=none/surface. Places search/filters/actions/optional leading. Preserves ordinary Tab flow and native input keys; does not automatically add role=toolbar or roving tabindex |
| ToolbarSurface | Requires label. wrap=wrap/nowrap (default wrap), width=content/full, appearance=floating/embedded/inline, density=comfortable/compact (default comfortable). Core owns surface/boundary/shadow/wrap/overflow and command ArrowLeft/Right/Home/End                                                                                     |
| ToolbarCommand | Requires label; presentation=label/icon/responsive (default label), icon required for icon/responsive. Consumes tone/emphasis/loading/disabled and native command semantics. Rejects size/children/leftSection/rightSection and visual overrides. Reuses Button/IconButton and Tooltip                                                |

ToolbarLayout flow uses children; slot arrangements use leading/search/filters/actions.
actions-inline DOM order is leading → search → filters → actions, while CSS places actions in the first visual row. The visual/Tab-order difference needs product browser review.
API types and ToolbarLayout runtime variant checks remain. Expanding unsupported-string runtime checks for ToolbarSurface was outside this correction.

## Actual keyboard and state implementation

### Contextual editor presentation

Text, map, external-video, code, table and executable selection menus consume the same Core
ToolbarSurface `density="compact"` and `wrap="nowrap"`. Core owns icon target size, glyph frame,
focus and overflow; Features supply domain commands. Width readouts are named passive status
outputs with resize instructions, centered alongside commands rather than placed in a private
fixed-height wrapper or adapted into focusable tooltip triggers.

Executable runtime/source commands remain on the executable's own surface. Its floating
selection menu contains only block alignment and deletion, avoiding a second run/stop/source
control set. Nested title inputs and Monaco temporarily suppress selection bubbles while
retaining document selection; returning focus to the document restores the eligible menu.
Escape dismissal, toolbar arrow navigation and Tab exit retain their separate behavior.

Review `Feature / Editor / Menus` (Formatting Bubble, Map Controls, External Video Controls,
Table Selection) and `Feature / Editor / Executables` (P 5, Three, Shader). These are production
adapters, including the actual editor-backed stories; they are not a Storybook-only UI.

ToolbarSurface currently uses div role=toolbar with its own keyboard handler; child Button/IconButton uses React Aria.
Installed React Aria Components 1.22.1 includes Toolbar/useToolbar, but Surface does not use that primitive.
Its installed capture handler changes nested Toolbar to group and owns Tab movement. Replacing Surface would also change native-input and editor-consumer capture-level roving contracts.

| Check                    | Result / limitation                                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrow / Home / End / RTL | Moves among the current toolbar's enabled visible commands; end arrows wrap. Computed CSS direction reverses RTL arrows. Home/End follow DOM first/last commands                                                                                                      |
| disabled / pending       | Excludes native disabled and aria-disabled commands. Pending activation blocking and aria-busy names/state were checked with the upstream shared Button correction                                                                                                    |
| Nested groups            | Candidates must have the same closest role=toolbar. Inner navigation does not join outer candidates. Inner density overrides parent density                                                                                                                           |
| Input / consumer keys    | Does not intercept input/textarea/select arrows or reprocess preventDefault keys. Does not duplicate editor onKeyDownCapture roving ownership                                                                                                                         |
| Tab                      | ToolbarLayout keeps ordinary native Tab order. Default Surface does not globally rewrite child tabIndex. Editor SelectionBubbleMenu uses separate useSelectionToolbarNavigation for single entry/Tab exit/restoration. Not every Surface provides single-entry roving |
| Responsive touch         | Below sm, responsive uses icons for fine pointers; any-pointer:coarse retains visible labels. Explicit icon stays icon on touch. Names/click behavior remain                                                                                                          |
| Long labels / themes     | Label presentation uses Button labelWrap=wrap and named xs targets. Shared Control and token/theme owners define touch targets/type/state colors/contrast. jsdom does not verify final wrapping/contrast                                                              |

## Reproduced correction

CSS display:none commands remained candidates, blocking arrows or moving focus incorrectly. The filter now excludes computed visibility and display:none from control through toolbar ancestors.
Native :disabled also excludes commands disabled by a parent fieldset. Existing hidden/inert/aria-hidden, aria-disabled, nested-owner filters and consumer key handlers remain.

Toolbar CSS has a separate owner. spacing-role-toolbar-item and spacing-role-action-group alias existing values; compact Surface gap/padding=0 is an explicit existing exception.
This keyboard correction did not change CSS/token values or product copy.

## Actual consumers and browser fixtures

| Consumer path                                                                   | Story / task to inspect                                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EntityTranslationsPanel → TranslationLocaleRow ToolbarSurface + ToolbarCommand  | feature-translation-localerows--expanded / --read-only / --phone / --tablet / --desktop: translation add/review/errors, long locales and responsive actions                                                 |
| SelectionBubbleMenu / selection navigation hook                                 | feature-editor-menus--formatting-bubble / --selection-bubble / --map-controls / --external-video-controls: capture-level roving, Tab exit, editor-focus return and retained selection                       |
| TiptapTableMenu / CodeBlockSurface                                              | feature-editor-menus--table-selection / --code-selection; feature-editor-source-editor--standard / --compact / --read-only: nested commands and native editor keys                                          |
| DataTableToolbar / DataTableSelectionToolbar / SelectionToolbar → ToolbarLayout | pages-admin-content-lists--posts, pages-admin-file-manager--browser: ordinary search/filter/selection/action Tab order and container layout                                                                 |
| New Core fixtures                                                               | core-layout-toolbarsurface--navigation-states: input/pending/disabled/hidden/nested density; core-actions-toolbarcommand--long-label: long translated commands, responsive, Light/Dark and pointer branches |

Sources: [ToolbarSurface](../../components/core/Section/ToolbarSurface.tsx), [ToolbarLayout](../../components/core/Section/ToolbarLayout.tsx),
[ToolbarCommand](../../components/core/Section/ToolbarCommand.tsx), [editor navigation](../../features/editor/tiptap/menus/useSelectionToolbarNavigation.ts) and [shared control context](../../components/core/control-context.tsx).

Checks passed: six test files / 45 tests covering ToolbarSurface/ToolbarLayout/ToolbarCommand, useSelectionToolbarNavigation, SelectionBubbleMenu and EntityTranslationsPanel.
Pending integration includes the upstream Button aria-busy correction. Core type-test and added-story scoped typing passed with skipLibCheck. Changed TSX lint/format were run separately.
jsdom logged unimplemented canvas getContext during execution, without test failures.
These Toolbar results do not establish completed Table or AppDialog changes/checks.
