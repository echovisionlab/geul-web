# Button family API, behavior and accessibility review

Status: API and behavior review draft. Visual and product integration approval is separate.
Reviewed: 2026-10-12. Scope: local contracts, Storybook examples, typing and jsdom regressions for Button, IconButton and TextButton.
Tokens, colors and hover/focus CSS have separate owners. This record does not approve every supported visual combination, browser behavior or screen reader.

## Criteria and authority

[Carbon Button accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/button/accessibility) informs Tab/Enter/Space activation, names and hover/focus guidance for icon commands, and the distinction between commands and toggles. Carbon geometry and primary defaults are not Geul enums or defaults.
[WAI Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) distinguishes names, descriptions, pressed and expanded states;
[WAI Link](https://www.w3.org/WAI/ARIA/apg/patterns/link/) requires real href navigation semantics.
[React Aria Button](https://react-aria.adobe.com/Button) retains focus and blocks repeated activation while pending.
[React Aria Link](https://react-aria.adobe.com/Link) provides the supported render API used to preserve the actual element, DOM props and ref.

Authority: [Button](../../components/core/Button/Button.tsx), [IconButton](../../components/core/IconButton/IconButton.tsx),
[TextButton](../../components/core/TextButton/TextButton.tsx), [shared props](../../components/core/control-props.ts),
[Core specifications](core-specifications.md) and the [Geul guide](../design-system.md).
Installed versions: react-aria-components 1.22.1 / react-aria 3.53.1.

## API and actual states

| Concern              | Button                                                                    | IconButton                                                                                  | TextButton                                                                                  |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Command / navigation | Without href: button. With href: link                                     | Same; drag-handle is a native button                                                        | Same                                                                                        |
| Defaults             | neutral / medium / sm / type=button                                       | neutral / low / xs / square / action                                                        | default / sm / regular / inline-flex / type=button                                          |
| Sizes                | compact, xs, sm, md, lg, xl                                               | compact, chrome, xs–xl (controlSize removed)                                                | size/controlSize=xs, sm, md                                                                 |
| Disabled             | Native disabled; blocks activation                                        | Same; blocks drag start                                                                     | disabled only on actions                                                                    |
| Pending              | loading; busy + pending + aria-disabled; retains focus                    | Same; drag-handle uses native disabled                                                      | No loading API                                                                              |
| Form                 | type, form, name and value only on actions                                | type on actions; drag-handle only type=button                                               | type/form only on actions                                                                   |
| Navigation           | href/target/rel/download/replace/scroll/prefetch/onNavigate only on links | Same                                                                                        | Same; links allow onNavigate, not onClick/disabled                                          |
| Name                 | Visible children or an ARIA name                                          | Exactly one of label / aria-label / aria-labelledby; rejects blank or missing runtime names | Visible children or an ARIA name                                                            |
| Semantic state       | aria-pressed for toggles; owning triggers supply aria-expanded/haspopup   | Same                                                                                        | selected expresses visual ancestry; callers separately supply aria-current/expanded/pressed |
| Slots                | leftSection → label → rightSection → indicator                            | Glyph, decorative count, pending progress                                                   | Label, trailing indicator                                                                   |
| Visual escapes       | Rejects style/className/framework props and reserved state                | Same                                                                                        | Same                                                                                        |

The Button/IconButton action name stays stable through default → pending → default. The pending ProgressBar has its own name.
External aria-labelledby takes precedence; an explicit aria-label is preserved; ordinary Button refers to its visible label.
The supported render API preserves the actual button relationship so vendor pending progress does not append its name to the action.

While pending, Button changes its native type to button to block default submit/reset behavior, then restores the requested type. IconButton follows the same rule.
Unavailable Button/IconButton links render React Aria's span role=link, with aria-disabled and without a native anchor, navigation callback or tab stop. Pending links also retain aria-busy.
The vendor ref for this placeholder is not an anchor; do not use an unavailable link for imperative anchor operations.

Parent ActionRow/Toolbar/Header density can determine geometry. Shared tokens own the coarse-pointer minimum target.
Button's internal gap remains 8px with `size="compact"` or `ToolbarDensity="compact"` alone.
Only `HeaderDensityProvider density="compact"` uses the 4px `control-label-compact` role.
Storybook separately reproduces the compact-size 8px gap and HeaderDensity compact 4px gap.
Button wrap/fullWidth and TextButton nowrap/display/fullWidth combinations need actual locale and viewport review.
IconButton count is decorative; callers provide its business meaning through a name or description.
External aria-labelledby requires a nonempty ID string; callers ensure those IDs exist and provide appropriate context.

## Reproduced problems and corrections

| Problem                                         | Evidence before correction                                                                                                                 | Correction                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Loading reset cleared the form                  | New native click/onReset regression failed                                                                                                 | Button/IconButton pending type=button                                                                      |
| Disabled drag handle retained draggable=true    | New native draggable regression failed                                                                                                     | disabled/loading sets draggable=false, prevents dragstart and blocks callbacks                             |
| Nameless IconButton was accepted                | JS/dynamic spreads could render blank names despite required types                                                                         | TypeError for missing/blank/multiple name channels; regressions for valid external labels and badge naming |
| Commands without href accepted navigation props | New rejected type fixture produced TS2578                                                                                                  | Navigation props are never in the action branch; link branch rejects form/submit data                      |
| Drag handle accepted type=submit                | Rejected fixture produced TS2578                                                                                                           | Sensor type is restricted to button                                                                        |
| tabIndex=-1 was filtered                        | Installed useFocusable replaced it with default 0                                                                                          | Supported excludeFromTabOrder on actions; supported link render preserves native tabIndex                  |
| aria-busy was filtered                          | Existing ToolbarCommand pending regression failed                                                                                          | Supported render preserves actual DOM busy state                                                           |
| Pending action name was duplicated              | Browser reviewer observed button `Saving Saving` and progress `Saving` in Button Loading / Dark EN; four new exact-name regressions failed | Preserve the pending button name relationship; retain progress naming and its accessibility tree           |
| Every command example behaved as a toggle       | Three wrappers added aria-pressed and toggle callbacks to all commands                                                                     | Ordinary examples remain commands; only Toggle owns pressed state; Indicator uses a real DropdownMenu      |

Default, matrix and pressed/focus stories no longer turn Save/Delete/drag commands into persistent toggles.
Toggle keeps its label unchanged across states. CurrentLink demonstrates selected together with aria-current.

## Actual consumers

- [FormModal](../../components/core/Modal/FormModal.tsx), [ConfirmModal](../../components/core/Modal/ConfirmModal.tsx): loading submit/confirm and explicitly designated strong Dialog primary actions.
- [ToolbarCommand](../../components/core/Section/ToolbarCommand.tsx): pending names, duplicate-activation blocking, icon-only tooltip and wrapping labels.
- [ShellView](../../features/shell/ui/Shell/ShellView.tsx): selected ancestry and aria-current page links, separately from aria-expanded menu triggers.
- [FormattingButtons](../../features/editor/toolbars/FormattingButtons.tsx) and the shared [EditorToolbarAction](../../features/editor/toolbars/EditorToolbarAction.tsx): IconButton `pressed` toggles. [FileBrowserViewToggle](../../features/file-manager/ui/FileBrowserViewToggle.tsx) now uses SegmentedControl icon options.
- [TiptapBlockMenu](../../features/editor/tiptap/TiptapBlockMenu.tsx): native drag activator, tabIndex=-1 and keyboard/menu callbacks.
- [MediaTransport](../../components/core/MediaControls/MediaTransport.tsx): the current play/pause command name; icons are not universally toggles.

The common Core behavior reaches these consumers. This review did not change consumer copy, layout or emphasis.

## Executed checks and remaining scope

- Baseline: 33 tests passed in the three target files. New reset and disabled-drag regressions failed on native reset execution and draggable=true respectively.
- After correction: 65 tests passed in the three files. Coverage includes one activation per Enter/Space, pending keyboard/click blocking, focus retention/restoration, external form association, type restoration, names, count, slot order, current/pressed/expanded and action/link tabIndex.
- Types: `node node_modules/typescript/bin/tsc --noEmit --project components/core/tsconfig.type-test.json` passed. Fixtures compile allowed icon names/links/form/toggles and reject navigation-branch violations, drag type, style and invalid indicators.
- Consumer runtime run: the three target files plus ToolbarCommand/PageHeader/SortableSurface/SortableGroups/NavigationLink passed, 8 files / 81 tests. Eight new exact-name cases cover visible label / explicit aria-label / external aria-labelledby before and during pending, with a separate progress name. The initial expanded run's ToolbarCommand aria-busy failure was corrected by preserving DOM busy. The command was `node node_modules/vitest/vitest.mjs run` followed by those eight test paths. jsdom's unimplemented external-navigation logs do not approve browser navigation.

After the final native-render explicit-type lint adjustment, Button/IconButton passed separately: 2 files / 54 tests.
ESLint `--max-warnings=0` passed for 21 changed Button/Dialog TS/TSX files.
The default `tsc --noEmit --incremental false` failed on duplicate `.next/types` / `.next/dev/types` declarations and Storybook vendor declarations. That run reported no Button/Dialog owned source/test errors. Passing Core fixtures is not a full-project build pass.

A browser reviewer observed the duplicated name at `localhost:6012`, Button Loading / Dark EN.
The saved post-correction Dark EN observation (2026-10-11 17:12:49.698 UTC) records one action name `Saving`, a separate ProgressBar name `Saving`, and action aria-busy=true.
Check the current Button stories and exact accessible-name regressions in `Button.test.tsx`.
No complete AX tree is attached. The observation lacks a source SHA, so its identity with current source is unverified.
The 1425×891px image differs from the recorded 1440×900px DOM viewport and is not a complete viewport visual pass.
The reviewing agent organized saved evidence and did not operate a browser.
These DOM name regressions do not approve pending live-announcer order or messages. Exact-name checks cover action buttons; pending-link span names still need browser review. Existing unavailable-link regressions verify navigation/callback/tab-stop blocking.

The reviewing agent did not execute browser checks for light/dark, locales, mobile/tablet/desktop, long-label reflow/ellipsis, hover/focus/pressed/disabled/pending combinations, touch targets or reduced motion. VoiceOver/Orca were not run. Carbon's passing results are not Geul passing results.
IconButton does not automatically create a tooltip; compositions such as ToolbarCommand must explicitly provide visual guidance. Standalone icon-only consumers still need hover/focus tooltip review. Whether aria-label preserves visible labels requires consumer review with translation and business context.

## Review baseline SHA-256

Dirty files were copied and hashed at the start. A git diff containing earlier edits does not isolate this review.
The scoped diff is `/tmp/geul-button-review.patch`; original copies are `/tmp/geul-button-review-before/`.
CSS/index files were not changed in that review.

| File                                                  | Starting hash                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `components/core/Button/Button.stories.tsx`           | `1d04309aa0ddebe27edd167ab8b4bb959774ff31af85519141d5f87479dbf043` |
| `components/core/Button/Button.test.tsx`              | `030ef8ed13f2c7ebee6a19feed58e2eecb2d19765280cd238c8abd457ebbab14` |
| `components/core/Button/Button.tsx`                   | `b74c6433ae51d8dbc6bb9717037fa89bab5d13a46276e9c57c145d0f63d2055d` |
| `components/core/Button/Button.type-test.tsx`         | `f1b949e0b0c14f704a669c1b971904bd30b74725c7107baab8efd9fa80208845` |
| `components/core/Button/index.ts`                     | `ea45f80a683abc4a3a7c8e5fa32283ec729982254705b12da258b209555cc941` |
| `components/core/Button/tsconfig.type-test.json`      | `a64796becb6724c5bcd1668ce9d6cc9a24e76f4aa3a1b715632d2bd7be9b6916` |
| `components/core/IconButton/IconButton.module.css`    | `2f104ea91d2c26f14e975ddacce5f81065ef2c289bc2ea91f1d83f111e601ba8` |
| `components/core/IconButton/IconButton.stories.tsx`   | `af70d673c0223364e5cc302dcef2e24ce36ea2e2ee6ac6daea623d7fd8b5b780` |
| `components/core/IconButton/IconButton.test.tsx`      | `e3b42119d43c0c2ad8970ede3772b5af8f7d498cfe9b1609cd0d8256e69a5800` |
| `components/core/IconButton/IconButton.tsx`           | `a1b427b5e20b95c046085dbd7cac2cd11c12bd4b5bdf1a212865ce4ad837cd18` |
| `components/core/IconButton/IconButton.type-test.tsx` | `32dcbd83f1a97e17435b31b2b37287bf4cf2d9b509f1e4d2c9bf8d40ce78d0f7` |
| `components/core/IconButton/index.ts`                 | `0953825dd589ec370a520396552b16aa360216cf94577be725a9d3fc3acd5bdb` |
| `components/core/TextButton/TextButton.module.css`    | `41254081fc21eda490ddb5a1822c850aee3ff07e9dbfecb3e15807afa8f971a9` |
| `components/core/TextButton/TextButton.stories.tsx`   | `3b307c410169be85ec3a609390e9fa830b00033ecde389762da44b71a55a82fe` |
| `components/core/TextButton/TextButton.test.tsx`      | `dfe75b21be46c3dbe1a79ff60c11b5df2a7f0c63b4a965af8f7204a93dc39367` |
| `components/core/TextButton/TextButton.tsx`           | `5c87a153ca4a1ec59af305066146bc79c8910fc0e0085172fa85192d487ddbb4` |
| `components/core/TextButton/TextButton.type-test.tsx` | `826e34ebae19e113c338d4371e1bd460ee38bc76f40fca10d05aa8506359105d` |
| `components/core/TextButton/index.ts`                 | `45144155724038bdeddec1249a5f6e8c0e0b71e79cc8eab3d853a9c2ec67cd60` |
