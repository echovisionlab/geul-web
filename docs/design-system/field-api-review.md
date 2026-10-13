# Field and Input API review

Reviewed: 2026-10-12. Source, typing and jsdom review. Actual rendering at 390/834/1440px, Light/Dark, locales, browser keyboard behavior and screen readers require separate browser review.

## Contract and findings

| Concern             | Current contract / finding                                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public API          | Field requires label/children and accepts layout=stack\|inline (default stack), description/actions/error/required/htmlFor. Types reject arbitrary style/class/size/color; runtime does not forward them. Unsupported layout throws RangeError                                |
| Anatomy             | stack: header(copy(label, description), actions) → control → error. inline: header/control columns, with description/error spanning both                                                                                                                                      |
| Layout              | stack gap=spacing-role-field-label (xxs 4px since 2026-10-13; previously xs 8px). inline: two minmax(0,1fr) columns, column-gap=spacing-role-field-column (existing sm 10px), row-gap=spacing-xxs. Control uses end/fit-content/max-width:100%. No automatic mobile stack API |
| ID / description    | Uses the single child's existing ID or htmlFor, otherwise useId. Merges and deduplicates existing aria-describedby IDs with Field description/error IDs                                                                                                                       |
| Error               | Field error sets child aria-invalid=true and custom child error=true. Without Field error, the child's existing validation state is retained                                                                                                                                  |
| required            | Wrapper required reaches the child; visible asterisk is aria-hidden. Wrapper does not clear child required=true                                                                                                                                                               |
| disabled / readOnly | Input Core owns these states; they are not Field variants. Readonly Textarea retains focus and required/error relations but blocks editing. NativeSelect projects the existing readOnly API to disabled because native select has no readonly behavior                        |
| Label activation    | Native input/select retains htmlFor. Label clicks explicitly focus contenteditable=true targets, excluding aria-disabled/disabled targets. No extra tab stop. Native label focus still needs browser verification                                                             |
| Custom child        | An adapter forwards ID/ARIA relations/required/error to the actual editable control. Field does not discover arbitrary internal controls inside multiple children/Fragments. The adapter supplies contenteditable naming                                                      |
| actions             | Do not nest actions inside the label. Independent action clicks were tested; long label/action wrapping and overflow need browser review                                                                                                                                      |

Sources: [Field.tsx](../../components/core/Field/Field.tsx), [Field CSS](../../components/core/Field/Field.module.css),
[Input contract](../../components/core/Input/input-contract.ts) and [InputParts](../../components/core/Input/InputParts.tsx).

## Reproduced problems and corrections

1. NativeSelect replaced child aria-invalid with undefined when no error existed, losing validation state inside Field. Explicit child state is now preserved when wrapper error is absent.
2. PasswordInput copied the input aria-label to its visibility command, failing to describe Show/Hide. Input naming stays intact; the toggle uses visibilityToggleLabel or the localized Show/Hide name.

These semantic corrections did not change visual geometry or Field API. The parallel spacing-role cleanup makes field-label/field-column aliases of existing xs/sm values.

## Checks and actual consumers

Five Core test files passed 35 tests; ProfileFormView/EntityTranslationsPanel passed 21 tests in two consumer files. Closed Input API typing and changed-file lint passed.
jsdom does not certify browser visuals, native label activation or screen readers.
Scoped Field type-test/story typing passed with skipLibCheck. The same check including library declarations failed on existing Storybook generic declarations; it is not a complete Storybook type pass.

| Consumer path                                        | Reproducible story / task to inspect                                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /my/profile → MyProfilePageView → ProfileFormView    | feature-my-profileform--populated / --long-values / --validation-error / --disabled. Bio Field+Textarea+character-count actions; Website TextInput                                                                                            |
| EntityTranslationsPanel → inline source-locale Field | feature-translation-localerows--expanded / --read-only / --phone / --tablet / --desktop. Long locales, source changes and NativeSelect description relations                                                                                  |
| PageEditor → ColumnsEditor                           | feature-page-editor-columns--reorder-between-columns / --readonly. Field+NumberInput currently passes the same label to wrapper and child. Browser review must check duplicate visible labels/names; the consumer must choose one label owner |
| ImmersiveSceneDescriptionEditor                      | Field → custom adapter → ControlledTiptapEditor forwards IDs/descriptions and accessibleLabel to editable content. Actual label focus/error delivery needs the product editor fixture                                                         |
| Core fixture                                         | core-layout-field--basic / --required-with-action / --error-state / --inline plus --read-only / --long-content / --editable-label. The fixed 420px wrapper became max 420px/available width to permit mobile review                           |

## Priorities for the next sequential reviews

No code was changed for this plan. These are inspection tasks, not confirmed defects.

| Stage     | Priority                                                                                                                                                                                                                               | Actual fixture                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar   | ToolbarLayout uses ordinary Tab order; ToolbarSurface uses arrows/Home/End. Inspect CSS-hidden controls, RTL, nested toolbars, input-arrow interference, wrapped reading order and actions-inline visual Grid versus DOM order         | core-layout-toolbarsurface--formatting / --compact / --header-commands; core-layout-toolbarlayout--table-controls; pages-admin-content-lists--posts; pages-admin-file-manager--browser |
| Table     | Inspect compact/cards/content defaults, desktop 640px and mobile container boundaries, aria-sort, select-all/row selection, independent actions without duplicate activation, loading/empty/result announcements and focus restoration | core-data-display-datatableview--selectable-and-sortable / --compact-list / --inline-list / --truncated-names / --footer-boundary; admin content/file-manager fixtures                 |
| AppDialog | Actual owners are OverlayDialog and ContentModal/FormModal/ConfirmModal. Inspect title/description, initial focus/trap/restore, dismissible/busy/alertdialog, mobile body overflow and scoped strong primary actions                   | feature-confirmation-dialog--interactive / --loading / --blocked; core-overlays-blockingalertdialog--loading; product deletion/save/discard dialogs                                    |

Review Field's columns through actual Core responsive CSS and HTML label/required behavior. A fixed-width example does not prove max-width:100%, long content or narrow-parent behavior.
The later Toolbar source corrections and 45 editor/translation consumer tests are recorded, with remaining scope, in the [Toolbar API review](./toolbar-api-review.md).
