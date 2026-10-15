# Choice input contract review

Reviewed: 2026-10-12. Code/jsdom scope: Checkbox, Radio, Switch and SegmentedControl. Browser visual review and actual assistive-technology approval are excluded. Installed React Aria Components: 1.22.1.

## Specification and current support

| Core             | Purpose / value                                              | Naming / errors / required                                                                                     | readOnly / disabled                                                                       |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Checkbox         | Independent boolean and indeterminate; Group uses string[]   | Individual label/ARIA name; individual/group description/error relations; separate Group name                  | Individual and inherited Group state. readOnly retains focus; disabled is native disabled |
| Radio            | Single string selection in Group; initially unselected       | Individual label/ARIA name; Group name/description/error. radiogroup carries invalid/required                  | readOnly belongs to Group; individual Radio readOnly is not forwarded                     |
| Switch           | One on/off value, checked or defaultChecked                  | Stable label/ARIA name; input description/error and invalid/required relations                                 | readOnly blocks changes; disabled is native disabled                                      |
| SegmentedControl | RadioGroup-based single string; defaults to first data value | Group name via string label/aria-label; icon options use accessibleLabel. required/error/description relations | Group readOnly/disabled and option disabled                                               |

Distinguish Checkbox multiple choices, Radio mutually exclusive choices and Switch settings that apply immediately.
Carbon purpose/group-state/documentation conventions informed the review; Carbon dimensions were not copied.
[Checkbox guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/checkbox/guidelines),
[Radio guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/radio-button/guidelines),
[Toggle guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/toggle/guidelines).

Checkbox uses Tab to reach each choice and Space to change it. Radio/SegmentedControl arrows change selection, skip disabled options and wrap. jsdom covered horizontal RTL and vertical Down.
Radio readOnly blocks arrow/click value changes while preserving selected-input focus.
Actual Checkbox/Switch Space defaults, Tab/Shift+Tab order and radios inside toolbars still need browser review.
[Checkbox APG](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/),
[Radio APG](https://www.w3.org/WAI/ARIA/apg/patterns/radio/),
[Switch APG](https://www.w3.org/WAI/ARIA/apg/patterns/switch/).

## Correction and checks

Switch onLabel/offLabel read only props.checked, displaying Off with defaultChecked=true. The reproduction was corrected to use RAC children render-state isSelected.
Tests covered uncontrolled initialization/click transitions and controlled owner updates. Track copy is aria-hidden; the accessible name stays stable. External product copy, CSS and tokens were unchanged.

Six regression files passed 38 tests:
[ChoiceContracts.test.tsx](../../components/core/Input/ChoiceContracts.test.tsx),
[Switch.test.tsx](../../components/core/Input/Switch.test.tsx),
[SegmentedControl.test.tsx](../../components/core/Input/SegmentedControl.test.tsx),
[InputBehavior.test.tsx](../../components/core/Input/InputBehavior.test.tsx),
[InputWrappers.test.tsx](../../components/core/Input/InputWrappers.test.tsx),
[IconViewModeControl.test.tsx](../../features/admin/IconViewModeControl.test.tsx).
[Choice.type-test.tsx](../../components/core/Input/Choice.type-test.tsx) verifies allowed API and rejected visual escapes.
Storybook added Switch StateLabels, Radio ReadOnly and SegmentedControl ReadOnly.

## Consumers and remaining scope

[Form SelectField](../../features/form/FormField/fields/SelectField.tsx) consumes Radio.Group required/error/description/focus.
[SwitchField](../../features/form/FormField/fields/SwitchField.tsx) consumes Field naming and external error IDs.
[FieldEditor](../../features/form/FormBuilder/FieldEditor.tsx) uses Checkbox.Group for default-choice editing.
SegmentedControl supplies icon accessibleLabel in [IconViewModeControl](../../features/admin/IconViewModeControl.tsx) and layout values in [ContentLayoutFieldView](../../features/document-layout/ui/ContentLayoutFieldView.tsx).

SegmentedControl required/error/description support was corrected afterward. inputState manages required/invalid. When actual description/string error exists, the existing root separates the selection area and InputHelp. Border/orientation/fullWidth remain on the internal segments.
Without messages, or with a boolean error from Field, the original selection-area structure remains.
Field's external description/error IDs reach both group and actual radios; parent Field copy is not repeated.
Field's HTML label for alone cannot name or focus a radiogroup; this composition requires child aria-label or aria-labelledby. Changing Field label activation was outside scope.

ContentLayoutFieldView's three groups use existing visible labels.contentHeight/pageChrome/footer.
IconViewModeControl uses the existing common.actions.view label, View in English and its Korean translation. No visible copy was added.
[Naming tests](../../features/document-layout/ContentLayoutFieldView.naming.test.tsx) and IconViewModeControl tests check actual en/ko translations, existing selection callbacks and unchanged visible copy.
[SegmentedControlField.test.tsx](../../components/core/Input/SegmentedControlField.test.tsx) covers standalone help/errors, external IDs, Field required/error, no duplicate copy, state clearing, boolean errors and help with disabled/readOnly.
CSS, tokens and the preceding four Input components were unchanged.
The final run passed 7 files / 40 tests, including six new Core regressions and four en/ko consumer-name regressions. It combined SegmentedControlField/SegmentedControl/ChoiceContracts/Field with IconViewModeControl/ContentLayoutFieldView.naming/ContentLayoutField.
Scoped TypeScript, ESLint(max-warnings=0) and Prettier passed. Actual viewport/theme/AT review of help-bearing layouts remains.

The following props are open in types but not forwarded or displayed. A follow-up must choose implementation support or a narrower public contract.

| Core             | Unconsumed API                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checkbox         | leftSection/rightSection; Group onClick/onKeyDown/onKeyUp (onLabel/offLabel removed)                                                                   |
| Radio            | Individual readOnly/required/error/description and onClick/onFocus/onBlur/onKeyDown/onKeyUp; Group onClick/onKeyDown/onKeyUp; leftSection/rightSection |
| Switch           | onClick, leftSection/rightSection (indeterminate removed)                                                                                              |
| SegmentedControl | onClick/onFocus/onBlur/onKeyDown/onKeyUp, leftSection/rightSection                                                                                     |

None of these four Core components has a pending API. Consumers own async saves; no arbitrary pending variant was added.
390/834/1440px, light/dark, long labels/help/errors, coarse pointers, actual Space/Tab and VoiceOver/Orca remain separate review items.
