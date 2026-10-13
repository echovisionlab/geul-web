# TextInput, PasswordInput, NumberInput and Select review

Reviewed: 2026-10-12, in that order. Scope: public types, states/relations/input events, jsdom regressions and Storybook examples. Browser visuals and screen-reader approval are separate.
Authority: [Input Core](../../components/core/Input/index.ts), [shared contract](../../components/core/Input/input-contract.ts),
[InputParts](../../components/core/Input/InputParts.tsx) and [Input CSS](../../components/core/Input/Input.module.css).
Installed versions: react-aria-components 1.22.1 / react-aria 3.53.1.

## Comparison criteria

[Carbon Text input accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/text-input/accessibility) informs native input and keyboard visibility-toggle review.
[Number input accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/number-input/accessibility) informs arrow increments, bounds, single-input Tab entry and description/error relations.
Explain range/step constraints in description before input. This review does not adopt Carbon dimensions, colors or borders.
[Carbon Select accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/select/accessibility) describes HTML select. Geul Select uses React Aria ComboBox, so input/button/listbox relations need separate verification. Carbon native-select behavior or results do not approve this ComboBox.

## Shared states and relations

| Condition         | Actual contract                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| label             | Uses an internal Label or parent Field relation. Placeholder is not a name. Standalone use requires label/ARIA naming                                              |
| description/error | Internal description and message errors join external aria-describedby IDs on the input. Boolean error expresses invalid state only                                |
| required          | Asterisk is decorative; required/aria-required belongs to the actual input. validationBehavior is aria                                                             |
| readOnly          | Value remains readable/focusable; editing is blocked. Password visibility remains available. Number increments and Select clear/open are blocked                   |
| disabled          | Disables the actual input and accessory commands; it is distinct from readOnly                                                                                     |
| pending           | None of these four Core components has loading/pending props. aria-busy alone does not block editing. The task owner chooses readOnly/disabled and status guidance |
| Events            | Shared onClick/onFocus/onBlur/onKeyDown/onKeyUp/IME composition handlers receive actual input events. Number onChange is a separate value callback                 |

Existing Field label/error/required relations were retained. This review did not add universal type/runtime rejection of nameless standalone inputs. Appropriate labels/ARIA names and existing target IDs remain consumer-review requirements.

## Public API and anatomy

| Core                                                           | API / defaults                                                                                                                                                                                                       | Structure / behavior                                                                                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TextInput](../../components/core/Input/TextInput.tsx)         | size sm, density comfortable; appearance underline/bare, textRole body/title/code/caption. type text/email/tel/url/search/password/date/time/datetime-local. value/defaultValue string/number; onChange native event | label → leftSection/input/rightSection → help/error. Projects string values and forwards min/max/step, length/pattern/autocomplete/IME attributes                                              |
| [PasswordInput](../../components/core/Input/PasswordInput.tsx) | Excludes TextInput type/rightSection. Hidden by default. visible is controlled, defaultVisible initializes it; onVisibilityChange and visibilityToggleLabel are supported                                            | Core owns the trailing visibility command. Type changes preserve value. Its localized Show/Hide or explicit visibilityToggleLabel name is separate from the input name                         |
| [NumberInput](../../components/core/Input/NumberInput.tsx)     | value/defaultValue number/string; callback number or empty string. min/max/step, decimalScale, allowNegative/allowDecimal, hideControls, prefix/suffix. Default maximum 20 fraction digits                           | prefix/input/suffix/decrement/increment. allowNegative=false clamps min to at least 0; allowDecimal=false caps fraction digits at 0. Bounds/readOnly/disabled determine increment availability |
| [Select](../../components/core/Input/Select.tsx)               | width fill/content; string/option/group data. Controlled/uncontrolled selection/search/open APIs, searchable/clearable/allowDeselect, renderOption                                                                   | input/optional clear/open → portalled listbox/group/option. Non-search input can be internally readonly while still selectable. Core readOnly blocks selection/clear/open                      |

Installed NumberInput vendor code removes explicit spinbutton role and aria-valuenow/min/max for VoiceOver compatibility. Actual DOM is a text input with aria-roledescription="Number field" in en-US; arrow increments remain.
Evidence: installed react-aria dist/private/numberfield/useNumberField.mjs, role-override comment and inputProps. This review did not add spinbutton. Actual assistive-technology number-field announcements are unverified.

## Geometry and gaps

Root label/help/error gaps use spacing-xxs, 4px. Input padding is block 4px / inline 8px; the flex wrapper declares no separate label–accessory gap. Measure padding and accessory targets independently.
Password/Number/Select accessories use the greater of control-height-xs and interaction-minimum. These were not changed to Button HeaderDensity or control-label roles.
Input CSS owns size-dependent height/type and compact density height. ToolbarDensity compact projects TextInput and Select to xs/compact; the same automatic projection was not added to NumberInput.
Coarse targets and actual long-label/value/locale overflow require browser review. Existing rejection of style/className/vendor skins and reserved data attributes remains.

## Reproduced problems and corrections

| Reproduction                                                                            | Correction                                                                                               |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| External aria-describedby removed internal TextInput/PasswordInput help/error relations | Compose relations once at TextField; do not repeat naming/description props on Input that overwrite them |
| Public NumberInput/Select onClick/onKeyUp/composition callbacks were not called         | Forward handlers to the actual Input; regressions check callback targets                                 |
| readOnly Select opened with dropdownOpened=true                                         | Open bridge projects false when disabled/readOnly; both states block clear and selection                 |
| PasswordInput public rightSection was ignored and replaced by visibility accessory      | Remove rightSection from public types and add rejected fixture. No actual consumer use was found         |

An external aria-invalid=false could also turn off TextInput/PasswordInput error semantics. Explicit error now keeps invalid=true on the actual Input; without error, external aria-invalid is preserved.

## Actual consumers and examples

- [VerificationFlowView](../../features/auth/ui/VerificationFlowView.tsx): email/required/autocomplete and external description/error IDs.
- [ProfileFormView](../../features/my/ui/ProfileForm/ProfileFormView.tsx): parent Field relations and public profile editing.
- [SharePasswordView](../../features/share/SharePasswordView.tsx): readOnly while pending, retained value and input-focus restoration after errors.
- [ParameterPanel](../../components/core/ParameterPanel/ParameterPanel.tsx), [MultiFilterValueInput](../../features/data-table/MultiFilterValueInput.tsx): Number bounds/step/disabled and domain value callbacks.
- [EntityTranslationsPanel](../../features/translation/EntityTranslationsPanel.tsx): grouped locale options and clear/read states.

Storybook added ReadOnly for all four Core components, TextInput RequiredWithHelp, PasswordInput Visible and NumberInput WithoutControls. Existing error/disabled/selected/bounded/long-content stories remain.
Adding stories does not complete actual 390/834/1440px, light/dark or locale visual review.

## Executed checks and remaining scope

[InputContracts.test.tsx](../../components/core/Input/InputContracts.test.tsx) checks explicit-ID label relations, internal/external descriptions/errors, required, readonly focus/disabled, controlled Password visibility, one Enter/Space toggle with value/focus retained, Number arrows/bounds/Tab exclusion, Select forced-open blocking/allowDeselect and native events.
Existing Field and SharePassword/ProfileForm/EntityTranslations consumer regressions were also run.
The four-Core contract suite had 18 regressions; together with InputWrappers/InputBehavior/NumberInput/Field and SharePasswordView/ProfileFormView/EntityTranslationsPanel, 8 files / 72 tests passed.
Closed Input API fixtures and scoped typing for tests/four stories passed. ESLint --max-warnings=0 passed for ten changed Input TS/TSX files. Scoped typing used existing Next declarations and skipLibCheck; it is not a full-app build result.

Unverified: browser IME results, autocomplete, type-specific native UI, text selection/clipboard; complete Select arrows/Enter/Escape navigation; Number locale/fractions/negative/direct-input commit/mobile keyboard; pending announcements; VoiceOver/Orca.
jsdom composition-callback forwarding does not approve real Korean IME. Browser composition/commit/cancel must be reviewed separately.
New API reviews for Textarea, NativeSelect, MultiSelect, Date/Time and Pin/Tags/SearchCombobox are outside this four-Core scope.
