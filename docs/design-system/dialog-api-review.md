# Dialog API, state and accessibility review

Status: API and behavior review draft. Visual/product integration approval is separate. Reviewed: 2026-10-12.
Scope: OverlayDialog, BlockingAlertDialog, ConfirmModal, ConfirmDialogHost and Feature ConfirmationDialog.
ContentModal/FormModal/Drawer consumer behavior was read and regressions executed; their implementation/CSS was not changed.

## Review criteria

[Carbon Modal accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/modal/accessibility) informs focus entry, Tab cycling, dismissal, initial Cancel focus for destructive confirmations and first-input focus for input dialogs.
[WAI Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) covers names, modality and focus restoration, distinguishing simple descriptions from structured bodies. Do not flatten lists/multiple paragraphs into one aria-describedby.
[WAI Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) requires a message relationship for alertdialog.
Carbon modal enums/padding/primary defaults and test approvals are not copied to Geul.

Authority: [OverlayDialog](../../components/core/Modal/OverlayDialog.tsx),
[BlockingAlertDialog](../../components/core/Modal/BlockingAlertDialog.tsx), [ConfirmModal](../../components/core/Modal/ConfirmModal.tsx),
[confirm-dialogs](../../components/core/Modal/confirm-dialogs.tsx), [ConfirmationDialog](../../features/confirmation/ui/ConfirmationDialog.tsx),
[confirmation-intent](../../features/confirmation/ui/confirmation-intent.ts) and the [Geul guide](../design-system.md).

## API and ownership

| Component           | Actual contract                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OverlayDialog       | opened/onClose/title/children. size compact/standard/large/wide/workspace/auto; density standard/compact; bodyLayout scroll/fit; placement left/right/bottom. Defaults standard/scroll/dismissible, role=dialog  |
| Overlay dismissal   | canDismiss=dismissible && !busy. busy is an owned operation pending state, locking close button/Escape/outside press. Modal/card/header close-policy display uses the same calculation                           |
| Overlay semantics   | Active title rejects blank/null. role=alertdialog requires descriptionId. Visible Heading slot=title supplies naming; actual Dialog section preserves modal/busy semantics                                       |
| BlockingAlertDialog | opened/onAction/title/message/actionLabel required. info/warning/danger; size compact/standard; loading. Defaults to permanent dismissal lock, role=alertdialog, message describedby and action autoFocus        |
| ConfirmModal        | Controlled opened/onClose/onConfirm/labels/message. confirmTone defaults neutral; confirmEmphasis defaults strong. loading blocks confirm/cancel/dismissal; confirmDisabled blocks only confirm                  |
| ConfirmDialogHost   | open(options) → id. onConfirm returns void or Promise<void>. Host owns pending store. close(id) removes only idle entries. onError reports failures                                                              |
| ConfirmationDialog  | Domain intent required. delete/discard/revoke=danger, archive/regenerate=warning, restore=positive, confirm=neutral. All are designated strong Dialog primary actions. Feature cannot override raw tone/emphasis |

Wrappers own body/footer content. Ordinary commands outside modals remain neutral/medium; supporting commands remain low.
Blocking danger expresses alert severity, not an automatic delete command. Complex confirmation content does not make every ConfirmModal an alertdialog.

## States and focus

| State / transition     | Contract and reviewed behavior                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idle → confirm         | Imperative Host synchronously checks current store topmost ID/existence/pending, rejecting the next click even before React renders pending                             |
| pending                | Locks every dismissal path, removes header close control, disables cancel/confirm and retains aria-busy/Button pending progress                                         |
| success                | Removes that ID; React Aria focus scope asynchronously restores the connected opener after normal completion                                                            |
| Rejection / sync throw | Restores entry pending=false, calls onError(error), leaves dialog open and permits retry                                                                                |
| Idle cancel            | Removes entry without calling onConfirm. open returns an ID, not a completion Promise; caller owns cancellation's business result                                       |
| Pending close(id)      | Keeps entry; no API permitting pending cancellation was introduced                                                                                                      |
| Initial focus          | Cancel for danger or confirmDisabled; otherwise enabled confirm. Blocking uses its sole action; ordinary Content uses the first target determined by Dialog/body        |
| Description            | Confirm string message is a real p ID with describedby. ReactNode lists/paragraphs retain structure without blanket describedby. Blocking has explicit message relation |

Busy consumers: [ContentModal](../../components/core/Modal/ContentModal.tsx), [FormModal](../../components/core/Modal/FormModal.tsx), ConfirmModal, BlockingAlertDialog and [Drawer](../../components/core/Drawer/Drawer.tsx).
Their busy means actual loading; existing closePolicy/loading calculations also require locking. No separate cancelable-query busy contract was found in these consumers.
Controlled ConfirmationDialog onConfirm is void; the caller owns async work, failure guidance and loading updates. Use imperative confirmationDialogs/Host for automatic Promise lifecycle.
Feature owns user-facing errors produced by onError. Host does not add visible copy or treat failures as success.

## Corrections and evidence

- Two native clicks arriving before pending render previously invoked Host onConfirm twice. A new regression reproduced this; a current-store guard now starts once.
- Overlay busy alone previously left default dismissible active. canDismiss closes this owner gap.
- Confirm simple-message description and initial focus were added at the owning layer without changing content/labels/layout.
- Types/runtime enforce Blocking active title/actionLabel and alertdialog descriptionId.
- [FailureAndRetry Story](../../features/confirmation/ConfirmationDialog.stories.tsx) reproduces first-attempt failure → retry → completion without extra input. The preview caller owns pending/error copy and duplicate blocking.

Imperative consumers: [openTranslationDeleteConfirm](../../features/translation/openTranslationDeleteConfirm.tsx),
[useTranslationLocaleCommands](../../features/translation/useTranslationLocaleCommands.tsx), and [EntityTranslationsPanel](../../features/translation/EntityTranslationsPanel.tsx).
Structured translation-deletion content remains structured. Button/API changes reach these shared owners; consumer deletion/notification business code was unchanged.

## Check results and remaining scope

- Baseline: ConfirmModal/confirm-dialogs/ContentModal/FormModal/ConfirmationDialog passed 5 files / 17 tests.
- Final runtime: those files plus OverlayDialog/Drawer/useBulkDeletion passed 8 files / 37 tests. Coverage includes async success/failure, sync throw, retry, idle cancel, pending close, duplicate confirm, modal names/descriptions, close/Escape/outside-press lock/restoration, Tab-boundary cycling, opener restoration and destructive/blocked initial focus.
- Outside press uses pointerdown+click to match installed React Aria's PointerEvent branch. Focus restoration is checked after an asynchronous frame.
- Types: node node_modules/typescript/bin/tsc --noEmit --project components/core/tsconfig.type-test.json passed. [Modal fixture](../../components/core/Modal/Modal.type-test.tsx) covers allowed size/body/alert relations and rejected roles/styles/missing relations/labels/Feature intents.

Existing FormModal native-submit disabled/loading regressions were executed. Actual browser implicit Enter submission, constraint validation/reset and first-input focus were not executed.
No incorrect form-handling code was found, so FormModal implementation remained unchanged.
Light/dark, long localized titles/bodies/labels, mobile/tablet/desktop reflow, touch/scroll lock/nested overlays, business focus when deletion removes the opener, and VoiceOver/Orca need separate product review.
Passing API/tests does not approve all Storybook state combinations or design.

After the final lint adjustment, OverlayDialog passed eight tests separately. A parallel run had exceeded the default five-second limit on its first test, followed by act regression failures.
The rerun used --testTimeout=20000 and passed eight tests in 2.41 seconds; neither code nor common timeout configuration was changed.
ESLint --max-warnings=0 passed for 21 changed Button/Dialog TS/TSX files.
The default tsc --noEmit --incremental false failed on duplicate .next/types/.next/dev/types declarations and Storybook vendor declarations. That run reported no Button/Dialog owned source/test errors. A Core fixture pass is not a full-project build pass.

## Review baseline

Twenty-four dirty files were copied to /tmp/geul-dialog-review-before/ and complete SHA-256 values recorded in /tmp/geul-dialog-review-before.json.
The scoped patch is /tmp/geul-dialog-review.patch. CSS, ContentModal and FormModal source remained unchanged.

| Main changed file                                      | Starting SHA-256                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `components/core/Modal/BlockingAlertDialog.tsx`        | `a98726be5dc2866bdef4114d133627688520466085903b05db6611f407a8324f` |
| `components/core/Modal/ConfirmModal.tsx`               | `e194454b2bd67926614d324d6c17eddeefcb4e5bef5d590411fd1a2ed7f96cd6` |
| `components/core/Modal/OverlayDialog.tsx`              | `e98fc8aae5f203f554a6f85d6e639cf9cbe4e80d4ca9652648e32e5ddb718ac2` |
| `components/core/Modal/confirm-dialogs.tsx`            | `68e701c3fa8aabc663e8361bf00889ebace78ec8fbb32d7cd8147c5d8b7cac36` |
| `features/confirmation/ConfirmationDialog.stories.tsx` | `6e913c49cd5834df01764f536d2649240a4b218c2a8d620cda7ed78395519dbb` |
