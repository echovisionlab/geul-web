# Core input contract

The production Input and Field owners now use React Aria Components or an intentionally native
select. Mantine input inheritance, slot skins, `variant`, `styles`, `classNames`, `vars`, `unstyled`,
arbitrary width and margin props are absent from the public contracts. The runtime projection also drops
unknown style props and reserved `data-geul-*` attributes passed through JavaScript spreads.

Every input uses the existing size scale (`xs`, `sm`, `md`, `lg`, `xl`) and density
(`comfortable`, `compact`). Behavioral `disabled`, `readOnly`, `required`, validation and
controlled/default value props remain explicit. `grow` is a shared field-layout capability.
TextInput's `appearance="bare"` and `textRole="title|code|caption|body"`, and Textarea's
`textRole="code|body"`, belong to Core and replace former editor skin overrides. Named Layout
primitives own spacing. Authored media, table-column and field-container geometry can remain on
outer native content frames; they cannot restyle the inner input.

Default, hover, focus, invalid, disabled and read-only styling is shared in Input.module.css.
Focus is always visible, including `animate={false}` and reduced motion. Invalid focused fields
retain their danger underline and expose a separate focus outline. Error/description associations
are owned by RAC or explicit `aria-describedby`; Field injects label/required/description/error
into its actual child and supports checkbox association.

Core Switch slides its thumb using `transform` and transitions thumb/track colors with
the existing `motion.slow` (300ms) and `motion.easing` (ease-out) tokens. Geometry and
monochrome roles remain shared; RTL reverses the travel direction. `animate={false}` and
`prefers-reduced-motion: reduce` remove transitions without removing focus or selected state.
CookieConsentBannerView and CookieConsentSettings consume this same Switch contract.

Checkbox, Radio and Switch share one choice grid: a 16px indicator (`chrome-icon-size`), an 8px
indicator-to-label gap (`spacing-xs`) and a 28px row (`control-height-compact`, 44px for coarse pointers).
The Switch track is 28×16px (`control-height-compact` × the indicator size) with a 12px circular thumb and
equal 2px end insets in every density, so it carries the same visual weight as a checkbox beside 14px text.
All three share one state language: off is an empty 1px `border-strong` outline; on is one `text-primary` mass with a
`text-on-action` mark (check or minus, a 6px point, or the thumb). Input accessories use 16px Core glyphs with a 1.5
stroke (`InputGlyphs.tsx`); text characters are not used as icons.
Optional onLabel/offLabel text sits outside the moving track so it cannot collide with the thumb;
it is decorative state copy, while the stable control name and native checked state remain accessible.
Its label remains the full click target; compact appearance does not shrink coarse-pointer targets.
Choice labels honor the shared size/density minimum height; disabled Switch tracks use the existing
disabled opacity while preserving thumb position. A compact track is not the whole interaction target.
Use Switch for one on/off setting, not for two named layout modes.

Visual references inspected on 2026-10-12: [Atlassian Toggle examples](https://atlassian.design/components/toggle/examples)
(rounded track, circular thumb, position and check/cross state cues) and
[Geist Toggle](https://vercel.com/geist/toggle) (compact track, minimal circular thumb, quiet off state).
Geul adopts their clear silhouette and position change with its existing monochrome semantic roles,
not their green/blue palette, icons, shadows or component APIs. Focus, disabled and reduced-motion
behavior stay with Core. Appearance does not determine whether an application saves immediately.

Core Radio uses the same 300ms ease-out tokens for background, ink and boundary color
transitions. Its circular geometry and selected colors stay unchanged; focus appears
immediately. `animate={false}` on a Radio or Radio.Group and reduced motion remove these
transitions. Public form SelectField consumes the shared Radio definition.

Select and MultiSelect use RAC collections and keyboard selection. MultiSelect additionally
supports the existing selected-value collapse, expansion, removal and order callbacks. Search
combobox controllers use `useInputCombobox`, not a vendor store. FileInput and FileDropzone share
Core file-selection accept/size rules. Visible auxiliary copy comes from caller labels or the
Core dictionary for the application's twenty locales; unknown locales fall back to English.

MultiSelectComboboxView retains its full option data while MultiSelect filters the menu, so
selected labels remain readable during search. Backspace removal uses the current controlled
search value. Its Editable story updates selection and options through Storybook args for
existing-option selection, removal and local creation; ReadOnly retains its disabled behavior.

## Date and time values

- DateInput: `yyyy-mm-dd | null`.
- MonthPickerInput: `yyyy-mm-01 | null` (only month/year segments are visible).
- DateTimePicker: `yyyy-mm-dd HH:mm[:ss] | null`; granularity is controlled by Core.
- DateRangeInput: `[yyyy-mm-dd | null, yyyy-mm-dd | null]`.
- TimePicker: `HH:mm[:ss]`; 24-hour segments preserve the local wall clock.
- DateTimeInput retains the existing `{ date, time }` domain value and explicit translated labels.

RAC's locale controls segment ordering, labels and calendar presentation. Calendar values use
`@internationalized/date` rather than UTC conversion. Existing callers that supply `Date` are
normalized by local calendar fields; callbacks return the string contract. Public scheduling,
release/work editors, sharing, form conditions/settings and table filters use these Core owners.

## Proof and previews

`components/core/Input/Input.type-test.tsx` proves positive value contracts and rejects skin,
numeric size, foreign density, portal and reserved attribute overrides. The input-specific
`tsconfig.type-test.json` runs without relying on the application's excluded preview sources.
Runtime tests mount actual RAC inputs, date segments, dropdowns, file triggers and selection
callbacks. They cover style-spread projection, mandatory focus, error association, read-only
behavior, timezone-free values, file rejection and selected-value ordering.

`Core / Input / Contract / Interactive` provides size, density, animation, invalid, disabled
and read-only controls for real mounted parts. Light/Dark and Locale belong to the single global
DesignSystemProvider. The primitive fixture pages use the same production owners.

## Compact and content sizing

SegmentedControl uses the existing control height and compact density with 4px block padding.
`fullWidth` distributes the available width across options; omit it for a content-width choice.
Document layout settings in both PageEditor and PostEditor use compact, content-width selection
groups in a wrapping LayoutInline. Each heading stays with its two choices. They do not reserve
an entire row until the actual available width requires wrapping. This composition uses no new
tokens and keeps the three values independent, with radio-group naming and arrow-key selection.

Compact fields consume the shared 28px compact control role. Any coarse pointer raises interactive controls and accessories to 44px, and text entry to at least 16px. Visual glyphs stay compact. Select `width="content"` is a closed Core contract: its label measurement, clear/toggle tracks and narrow-screen fill are owned by Select. Callers supply options and behavior, not sizing CSS. Raw width strings and visual props remain rejected.

## Region size

`InputSizeProvider size="…"` declares one input size for a region. Every Core input inside it (text, select, number, date, file, tags, choice and segmented controls) takes that size unless the input sets `size` itself; a compact toolbar still forces `xs`. All inputs resolve size through one path (`useToolbarInputPresentation`), so labels, text and control scale cannot diverge within a panel. Page block settings (`PageBlockSettingsSurface`, the immersive scene inspector and the section settings popover) declare `xs`; block settings editors do not pass per-field `size`.
