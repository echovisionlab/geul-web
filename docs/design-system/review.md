# Geul design system review order

Status: **Sequential review using Storybook documentation and running examples**.
This document defines review order and completion criteria, not completion of every Core, page or accessibility check.

Follow the [Carbon writing criteria](carbon-reference.md), [Core specifications](core-specifications.md) and
[ownership contract](ownership-contract.md). Find targets, source, stories and consumers in the
[generated inventory](generated-inventory.md). Separate supported contracts, examples and verification results;
apply changes in the relevant token/Core/consumer owner.

## 1. Buttons and commands

Owners: [Button](../../components/core/Button/Button.tsx),
[IconButton](../../components/core/IconButton/IconButton.tsx),
[TextButton](../../components/core/TextButton/TextButton.tsx),
[shared state CSS](../../components/core/Control.module.css),
[density context](../../components/core/control-context.tsx).

Compare the API, defaults, action/link, pending and naming contracts in the [Button review](button-api-review.md)
and [IconButton/TextButton review](icon-text-button-api-review.md) with documentation and actual stories.
Use the [command contract](confirmation-contract.md) for ordinary neutral/medium, supporting low and the
designated Dialog primary/confirmation strong scope.

Use relevant SemanticMatrix, MultilineLabel, Indicator, Loading, PendingTransition and LongMenuLabel/NoWrap examples
for Light/Dark, long Korean/English labels, icon/indicator, wrap and density.
Measure fine/coarse targets, SVG frame/path span, CSS padding and parent gap separately.
Verify keyboard focus, activation, duplicate blocking, pending restoration and tooltips in actual consumers.

## 2. Fields and inputs

Owners: [Field](../../components/core/Field/Field.tsx), [Field CSS](../../components/core/Field/Field.module.css),
[Input](../../components/core/Input), [Input CSS](../../components/core/Input/Input.module.css).

Compare anatomy, API, names, descriptions, errors, required, disabled/readOnly and controlled/uncontrolled behavior
in the [Field](field-api-review.md), [input](input-api-review.md) and [choice input](choice-api-review.md) contracts.
Distinguish single inputs, groups and contenteditable adapters; Field's HTML label alone does not prove a group name.
Verify inline equal columns, full-row description/error and content width in actual CSS.

Reproduce long labels/values, actions, description+error and invalid+focus.
Inspect narrow-parent wrapping/clipping, coarse 16px input text, accessory targets, label focus and ID/ARIA relationships in the browser.
Verify IME, password visibility, numeric boundaries, selection popovers and choice states through their actual input behavior.

## 3. Toolbars

Owners: [ToolbarLayout](../../components/core/Section/ToolbarLayout.tsx),
[ToolbarSurface](../../components/core/Section/ToolbarSurface.tsx),
[ToolbarCommand](../../components/core/Section/ToolbarCommand.tsx).
Follow the [Toolbar API review](toolbar-api-review.md).

Review Layout flow/actions-end/actions-inline, leading/search/filters/actions, inset/divider and container transitions.
Surface appearance/width/wrap, density and overflow has a separate contract.
For Layout check ordinary Tab order and native input keys; for Surface check Arrow/Home/End, RTL,
disabled/hidden exclusion, nested toolbars and input arrows.
Compare DOM and visual order in actual table/editor consumers.

## 4. Tables and collections

Owners: [Table](../../components/core/Display/Display.tsx),
[DataTableView](../../components/core/DataTable/DataTableView.tsx),
[DataTable CSS](../../components/core/DataTable/DataTableView.module.css).
References: [Table API review](table-api-review.md), [tables and toolbars](tables-and-toolbars.md).

Compare density, mobileLayout, columnSizing, sort, selection, rowAction, reservedRowCount and footer contracts.
Distinguish Core inline/compact/cards examples from actual Posts/FileManager/Picker choices.
Check long titles, numeric alignment, unselectable rows, empty/loading/error states, hidden columns,
modifier selection, row menus and overflow.
Review sort naming/state, select-all, independent row actions, reading order and focus recovery through interaction.

## 5. Dialogs and confirmation

Owners: [OverlayDialog](../../components/core/Modal/OverlayDialog.tsx),
[ConfirmModal](../../components/core/Modal/ConfirmModal.tsx),
[FormModal](../../components/core/Modal/FormModal.tsx),
[ConfirmationDialog](../../features/confirmation/ui/ConfirmationDialog.tsx).
Follow the [Dialog API review](dialog-api-review.md) and [confirmation contract](confirmation-contract.md).

Compare size/density, placement/workspace, bodyLayout, title/description, role and dismissible/busy.
Reproduce actual domain intent, pending, blocked, errors and cancellation.
Verify Promise waiting, duplicate submission blocking, dismissal locks, initial focus, Tab containment,
Escape and focus restoration after closing.
Review primary command access at the three viewports, low height, long content/actions, text zoom and keyboard/safe-area conditions.

## 6. Navigation, selection and actual pages

Review [navigation, overlay and pagination](navigation-overlay-pagination-api-review.md), then ApplicationFrame,
PageHeader, EditorHeader and actual Pages.
Specify which route View/states a preview reproduces in [page coverage](page-preview-coverage.md) and
[page documentation](page-documentation.md).
Review actual tasks across ready, empty, error, loading, permission, editing, saving and recovery states.

## Evidence and decisions

Each result records `Core export / source·build / story ID·args / viewport·surface width / pointer /
theme·locale / state·query / expected·observed / evidence / defect owner / unresolved scope`.
Use the current rendered examples and executable interaction checks.

| Stage                            | Required evidence                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Contract documentation           | Correspondence between current source/tokens/API/consumers and documentation           |
| Running examples                 | Production Core/View, fixture boundaries, supported states and accepted/rejected usage |
| Automatic checks                 | Actually executed types, regressions, story play, axe and token checks with scope      |
| Browser review                   | Computed geometry, reflow, overflow, keyboard, focus and visual states                 |
| Product adoption                 | Owner change, consumer application, related regressions and page tasks                 |
| Assistive technology integration | Actual VoiceOver/Orca, OS/browser, user scenario and results                           |

Documentation, example presence and automatic passes are separate evidence. Unexecuted checks remain pending.
Do not replace actual route authentication/server/external-service verification with fixture results.
Do not mark the manual [release readiness](release-readiness.md) items automatically passed.
