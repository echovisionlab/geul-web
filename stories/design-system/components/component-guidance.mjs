// Editorial guidance complements the generated public contracts. It does not define new Core behavior.
const entry = (title, summary, anatomy, usage, accessibility, constraints, relatedDocs, components) => [
  `Core/${title}`,
  {
    summary,
    anatomy,
    usage: Array.isArray(usage) ? usage : [usage],
    accessibility: Array.isArray(accessibility) ? accessibility : [accessibility],
    constraints: Array.isArray(constraints) ? constraints : [constraints],
    relatedDocs: (Array.isArray(relatedDocs) ? relatedDocs : [relatedDocs]).map((file) => `docs/design-system/${file}`),
    ...(components ? { components } : {}),
  },
];
const input = (name, purpose, detail, components) =>
  entry(
    `Input/${name}`,
    purpose,
    'Name/label → value control → description/error. Each input owns its sections and option list.',
    [
      'Consumers manage values, selections, files and events through the public API below. Check whether the component exposes defaultValue before supplying an initial value.',
      detail,
    ],
    [
      'Name the input with label or aria-label/aria-labelledby. A placeholder does not replace a label.',
      'Check description/error associations and the actual required, invalid, disabled and readOnly DOM states. Preserve the value and a correction path after errors.',
    ],
    [
      'Core owns size, density and internal padding/gap. Do not bypass them through Feature CSS or framework props.',
      'disabled and readOnly have different meanings. Do not add submit or selection behavior during IME composition.',
    ],
    ['input-contract.md', 'input-api-review.md'],
    components,
  );
const choice = (name, purpose, anatomy, detail, components) =>
  entry(
    `Input/${name}`,
    purpose,
    anatomy,
    detail,
    [
      'Name the selection group and each item. Connect values and selected states to the actual input semantics.',
      'Check keyboard navigation and selection, including disabled/readOnly differences. Consumers connect required, error and description relationships.',
    ],
    [
      "Use the component's value model: boolean, single value or multiple values.",
      "Do not simulate selection through CSS or change individual children's internal colors or sizes.",
    ],
    ['choice-api-review.md', 'input-contract.md'],
    components,
  );
const layout = (name, purpose, anatomy, detail, components) =>
  entry(
    `Layout/${name}`,
    purpose,
    anatomy,
    detail,
    [
      'Keep visual reading order aligned with DOM order. The consuming screen supplies meaningful sections, headings and control names.',
      'Check that narrow widths, long translations and zoom do not clip content or focus indicators.',
    ],
    [
      "Use the component's contract for internal spacing and Layout/pattern spacing roles for external placement.",
      'A decorative container does not become a control or heading.',
    ],
    ['layout-ownership-policy.md', 'size-density-contract.md'],
    components,
  );
const overlay = (name, purpose, anatomy, detail, components) =>
  entry(
    `Overlays/${name}`,
    purpose,
    anatomy,
    detail,
    [
      'Give the open region a name and role appropriate to its purpose. Check its relationships with the visible title and description.',
      'Check keyboard entry, exit, dismissal and focus return to the trigger while open. Automated accessibility checks do not verify focus management.',
    ],
    [
      "Consumers manage open state, cancellation and execution. Reuse Core's overlay structure and focus handling.",
      'Review one modal state story at a time. Run its interactions without opening multiple modal fixtures together.',
    ],
    ['dialog-api-review.md', 'navigation-overlay-pagination-api-review.md'],
    components,
  );
const display = (name, purpose, anatomy, detail, components) =>
  entry(
    `Data Display/${name}`,
    purpose,
    anatomy,
    detail,
    [
      'Check content meaning and reading order in the consuming screen. Do not communicate essential meaning through color or icons alone.',
      'Preserve essential information with long text, empty values, supported locales and light/dark themes.',
    ],
    [
      'Features own domain data and formatting decisions; Core owns shared presentation rules.',
      'Use shared action/link components for interactions. Do not turn a display component into a clickable div.',
    ],
    'core-specifications.md',
    components,
  );
const navigation = (name, purpose, anatomy, detail, a11y, components) =>
  entry(
    `Navigation/${name}`,
    purpose,
    anatomy,
    detail,
    a11y,
    [
      'Use href/navigation contracts for destinations and action contracts for commands. Preserve native link behavior, including Ctrl/Cmd and middle click.',
      'Current page, selection and expanded state have different meanings. Supply the state that matches the task.',
    ],
    'navigation-overlay-pagination-api-review.md',
    components,
  );
const interaction = (name, purpose, anatomy, detail, a11y, components) =>
  entry(
    `Interaction/${name}`,
    purpose,
    anatomy,
    detail,
    a11y,
    [
      'Connect state values and callbacks to the actual consumer. Do not present decorative controls as working examples.',
      'Check keyboard and non-drag alternatives, cancellation and recovery. Pointer interaction alone is insufficient.',
    ],
    ['core-specifications.md', 'hierarchy-contract.md'],
    components,
  );
const feedback = (name, purpose, anatomy, detail, components) =>
  entry(
    `Feedback/${name}`,
    purpose,
    anatomy,
    detail,
    [
      'Connect names and text so users can identify the pending task and current state.',
      'Check asynchronous DOM semantics, actual screen reader announcements and focus separately. Automated checks do not verify spoken output.',
    ],
    [
      'Connect loading, error and success to data state. Do not present decorative animation as measured progress.',
      'Check failure, retry and reduced motion in the actual task.',
    ],
    'core-specifications.md',
    components,
  );
const media = (name, purpose, anatomy, detail, a11y, components) =>
  entry(
    `Media/${name}`,
    purpose,
    anatomy,
    detail,
    a11y,
    [
      'Features own content aspect ratios, crop and data. Core owns shared controls, spacing and state presentation.',
      'Check external media/image loading and failure separately from control usability at narrow widths.',
    ],
    ['core-specifications.md', 'input-contract.md'],
    components,
  );

const guidance = Object.fromEntries([
  entry(
    'Actions/Button',
    'Represents labeled commands and page navigation.',
    'Root (button/link) → leftSection → label → rightSection → indicator. Loading progress is handled alongside the existing content.',
    [
      'Use neutral/medium for ordinary commands and low for secondary commands. Designated primary Dialog actions use strong; final destructive confirmation uses danger/strong.',
      'href selects the link branch. Do not combine type/form/indicator with a link. Place menu/disclosure indicators to the right of the label.',
      'loading prevents repeated execution. Consumers connect it to request start, completion and failure, and provide a retry path.',
    ],
    [
      'Preserve the visible label in the accessible name. Connect additional context through aria-describedby/aria-description.',
      'Use aria-pressed for toggles, aria-expanded/aria-controls for disclosure and aria-current for current links. Ordinary commands do not need aria-pressed.',
      'Check keyboard activation, execution blocking while pending, focus retention/recovery and the progress name.',
    ],
    [
      'Implementation defaults are tone=neutral, emphasis=medium and labelWrap=nowrap. size accepts compact/xs/sm/md/lg/xl, with standalone fallback sm. Parent action-row/toolbar context also affects size.',
      'nowrap truncates to one line; wrap allows multiple lines. Set fullWidth explicitly where needed.',
      'Union properties marked required=false may still be required in a specific branch. Read the complete action/link contract for valid combinations.',
    ],
    ['button-api-review.md', 'spacing-icon-contract.md', 'size-density-contract.md', 'confirmation-contract.md'],
  ),
  entry(
    'Actions/IconButton',
    'Represents a named icon command, link or working drag handle.',
    'Root (button/link) → glyph or pending progress → optional count. Pending state omits the glyph and count.',
    [
      'Choose Button when the command needs visible text. label supplies an accessible name and is not copied into visible text.',
      'Supply exactly one of label, aria-label or aria-labelledby. Place a drag-handle first on the left and connect actual sensor/activator bindings.',
      'Compose Tooltip or ToolbarCommand explicitly when an icon-only command needs a tooltip. The primitive does not create one automatically.',
    ],
    [
      'Check name, role and focus. Consumers provide additional description when count carries essential meaning.',
      'Pending state preserves name and focus while blocking execution. Distinguish ordinary button activation from a drag-handle keyboard sensor.',
    ],
    [
      'The 16px glyph and hit target are separate rules. Padding is 0; coarse pointers use a minimum 44px target.',
      'Defaults are neutral/low/square. size accepts compact/chrome/xs/sm/md/lg/xl; the former duplicate controlSize prop was removed. Standalone action size falls back to xs. A drag-handle owns compact geometry and rejects size/type=submit.',
      'A toggle passes pressed; Core sets aria-pressed and owns the neutral resting ink and muted selected surface. Toggles reject tone/emphasis and raw aria-pressed; links and drag-handles are not toggles.',
      'Optional name properties in the table still require one name-union branch. count must be a nonnegative safe integer; values of 100 or more display as 99+.',
    ],
    ['icon-text-button-api-review.md', 'button-api-review.md', 'spacing-icon-contract.md'],
  ),
  entry(
    'Actions/TextButton',
    'Represents text commands or links within sentences, lists and menus.',
    'Root (button/link) → text, or label with an indicator → trailing indicator. Additional context uses description relationships.',
    [
      'Use for lightweight commands/navigation in reading flow. Compare IconButton for icon-only controls and Button for ordinary labeled commands.',
      'indicator belongs to the action branch. The link branch uses href and navigation options; it does not accept onClick/type/form/disabled.',
      'nowrap=false wraps the actual label even with an indicator. nowrap=true truncates to one line while retaining the full name.',
    ],
    [
      'Include the visible text in the accessible name. Supply additional context through a description relationship.',
      'Check menu trigger expanded/controls, keyboard navigation, Escape dismissal and focus return as a composition. selected alone does not identify the current page.',
    ],
    [
      'Explicit defaults are appearance=default, size=sm, display=inline-flex, nowrap=false, density=inline and gap=xxs. size/controlSize accept xs/sm/md.',
      'Parent action-row/toolbar density affects controlSize and typography. Review content width and wrapping with long labels.',
      "TextButton does not expose Button's loading prop. Do not assume the two APIs share that state.",
    ],
    ['icon-text-button-api-review.md', 'spacing-icon-contract.md'],
  ),
  entry(
    'Actions/ToolbarCommand',
    'Composes toolbar text and icon commands using shared rules.',
    'ToolbarCommand → Button or IconButton, with a tooltip for icon-only commands.',
    [
      'Connect command kind, selection, availability and callbacks. Consume the parent ToolbarSurface/Layout density.',
      'Distinguish naming and tooltip needs for text and icon-only commands. Do not make every command a toggle.',
      'A toggle command passes pressed; Core sets aria-pressed and the selected appearance in both label and icon presentations and rejects tone/emphasis for it.',
    ],
    [
      'Check icon-only names/tooltips, pending action/progress names and busy state.',
      'Check reading order, keyboard focus order and current selection in the actual toolbar composition.',
    ],
    ['Consume shared action-row and control rules. Do not rewrite size, color or gap in consumer CSS.'],
    ['toolbar-api-review.md', 'tables-and-toolbars.md', 'spacing-icon-contract.md'],
  ),

  input(
    'TextInput',
    'Edits a single-line text value.',
    'Choose email, telephone, URL and other input types for the actual value and validation. Use bare/underline and textRole only within the public contract.',
  ),
  input(
    'Textarea',
    'Edits multiline text.',
    'Check long content, line breaks, minimum rows and height at narrow widths. Use TextInput for single-line values.',
  ),
  input(
    'InputFrame',
    'Hosts an editable surface that is not a native input, such as a small rich-text editor, in the shared text-entry chrome.',
    'Use only when TextInput/Textarea cannot hold the value. The hosted editor supplies its own name, description and content geometry; InputFrame owns the underline, focus, invalid and disabled treatment.',
  ),
  input(
    'NumberInput',
    'Edits a numeric value with increment/decrement controls.',
    'Connect value, range, step and empty-value meaning to the consumer data model. Distinguish keyboard/click/IME callbacks from numeric value changes.',
  ),
  input(
    'PasswordInput',
    'Edits a password with the supported visibility control.',
    'The visibility control owns the right section; the API does not allow an arbitrary rightSection replacement. Connect values, errors and autocomplete to the actual authentication task.',
  ),
  input(
    'Select',
    'Selects one value from a list.',
    'Distinguish selected value, visible label, search and open state. disabled/readOnly prevent opening even with dropdownOpened forced.',
  ),
  input(
    'NativeSelect',
    'Selects one value through a native select.',
    'Uses the OS/browser popup. Its geometry and keyboard behavior differ from custom Select. The implementation projects readOnly into native disabled, excluding it from Tab order. This differs from text-input readOnly behavior.',
  ),
  input(
    'MultiSelect',
    'Selects multiple values displayed as a list or tags.',
    'Review selection, removal, search and empty results separately. Name every tag-removal control.',
  ),
  input(
    'TagsInput',
    'Edits multiple text tags.',
    'Connect commitment, duplicate, empty-tag and removal rules to the actual data policy. Compare MultiSelect for fixed options.',
  ),
  input(
    'SearchComboboxView',
    'Connects a search input and external results as a combobox.',
    'Connect the combobox controller, search/onSearchChange, debouncedSearch, items and onSelect to actual search. getItemId/getItemText supply stable IDs and names. Without label, the implementation uses placeholder as its accessible name; check that the supplied name identifies the task.',
    ['SearchComboboxView'],
  ),
  input(
    'MultiSelectComboboxView',
    'Connects searchable multiple selection to external results.',
    'Manage query, selected items, results and active option separately. Check focus and search retention after removing selections.',
    ['MultiSelectComboboxView'],
  ),
  input(
    'DateTimeInput',
    'Edits a date and time.',
    'Distinguish display locale, stored value, time zone and empty-value meaning. Do not treat the display string as a server value without conversion.',
  ),
  input(
    'PhoneInputView',
    'Composes country selection and telephone input.',
    "Connect countries, countryCode/onCountryChange, value/onValueChange and labels. Do not substitute TextInput's defaultValue/onChange API. Check how country changes affect the existing number.",
  ),
  input(
    'PinInput',
    'Edits a verification code across separate fields.',
    'Check paste, automatic focus movement, deletion, empty codes and re-entry after errors in the actual verification task.',
  ),
  input(
    'ColorInput',
    'Edits or selects a color value.',
    'Check the relationship between swatches and the string value. Color alone must not identify the selected value.',
  ),
  input(
    'FileInput',
    'Selects files and displays their names.',
    'Connect accept, multiple, filenames, cancellation, clearing and validation to consumer policy. File selection does not mean upload completion.',
  ),
  input(
    'FileDropzone',
    'Provides file selection and drop within one task.',
    'Connect type, size and count rejection and the file chooser to actual callbacks. Provide an alternative to dropping files.',
  ),
  input(
    'ValidatingTextInput',
    'Connects input values to asynchronous validation.',
    'Distinguish validating, valid, invalid and stale request results. A previous result must not be applied to a changed value.',
  ),
  input(
    'Slider',
    'Adjusts a numeric value within a range.',
    'Connect min/max/step, value, units and keyboard interaction. Consider numeric input for precise entry. The implementation projects readOnly into React Aria isDisabled, including disabled semantics and exclusion from Tab order.',
  ),
  input(
    'NativeRange',
    'Selects a value through a native range input.',
    'Preserve native keyboard and value semantics. Connect label, value and units; identify tasks that need precise numeric entry.',
  ),
  choice(
    'Checkbox',
    'Represents an independent boolean or multiple-item selection.',
    'root → checkbox indicator → label → description/error.',
    'Connect checked/defaultChecked and onChange. indeterminate represents partial selection of a group, not a separate value.',
  ),
  choice(
    'Switch',
    'Represents an immediately applied on/off value.',
    'Root → rounded track/circular thumb → optional state text → external label → description/error.',
    'Both checked and defaultChecked display state text from actual isSelected state. Compact density reduces track geometry while preserving touch targets. Compare Checkbox for selections applied on submission.',
  ),
  choice(
    'Radio',
    'Selects one mutually exclusive item.',
    'Radio.Group → group label/description → each Radio and label.',
    'Match group and item values and name the group. Distinguish readOnly and disabled at item and group levels.',
    ['Radio'],
  ),
  choice(
    'SegmentedControl',
    'Selects one value from a short set of options.',
    'Radiogroup → each radio segment → label/description/error.',
    "Supply aria-label or aria-labelledby on the group. Field's HTML label alone does not name a radiogroup. fullWidth shares width across options; omit it for compact content-width choices. required/error/description follow the Input contract. Icon-only options pass icon with a required accessibleLabel; Core names the radio, hides and sizes the glyph, squares the segment and shows the label as a hover hint without an extra tab stop.",
  ),
  entry(
    'Input/Input States',
    'Compares input size, density, focus and invalid states.',
    'A review fixture composing the same input semantics through actual Core components and states.',
    "This fixture does not define a new input API. Use the chosen component's documentation for values, callbacks and slots.",
    'Check that names, descriptions and errors remain connected across sizes. Review combined states such as focus+invalid through actual interaction.',
    'The sample count does not indicate complete API-combination or accessibility coverage.',
    ['input-contract.md', 'size-density-contract.md'],
    [],
  ),
  input(
    'EmojiPicker',
    'Provides emoji search and selection.',
    'Connect query, groups, selection callbacks and empty results. Supply item names rather than relying on emoji glyphs alone.',
    ['EmojiPickerPanel'],
  ),
  input(
    'ParameterPanel',
    'Groups related compact value controls in a panel.',
    "Connect each parameter's label, value and callback to the actual input in its row. Do not create custom slider/input styling inside the panel.",
  ),

  entry(
    'Layout/Field',
    'Owns relationships between labels, inputs, descriptions, errors and secondary actions.',
    'Header (label/required/actions) → single control → description → error. Description placement follows layout.',
    [
      'A single input child receives id, required, aria-describedby and invalid relationships automatically. Existing description IDs are preserved.',
      'Multiple children and composite groups require explicit group naming and relationships. Avoid redundant labels, help and errors.',
    ],
    [
      'Check htmlFor against the actual control ID, label activation and description/error associations without duplication.',
      'Focus delegation for contenteditable must respect disabled state. A radiogroup needs its own accessible name.',
    ],
    [
      'layout accepts stack/inline and defaults to stack. Consumers do not override internal CSS.',
      "An error activates the child's invalid state. Adding accessibility relationships does not require adding visible copy.",
    ],
    ['field-api-review.md', 'input-contract.md'],
  ),
  layout(
    'Primitives',
    'Shares layout, spacing, width and responsive rules.',
    'Compose Stack/Inline/Grid/Inset/Container/GridItem/Spacer according to their responsibilities.',
    'Use named Space/semantic spacing roles for gap and padding. Responsive values follow the breakpoint contract; do not copy individual CSS numbers.',
    ['LayoutStack', 'LayoutInline', 'LayoutInset', 'LayoutContainer', 'LayoutGrid', 'LayoutGridItem', 'LayoutSpacer'],
  ),
  layout(
    'ApplicationFrame',
    'Structures the product header, navigation, content and footer.',
    'Frame → landmarks and the actual content track.',
    'Place content, menus and sticky regions in their slots. Check overflow and obscured focus at narrow widths and short heights.',
  ),
  layout(
    'EditorHeader',
    "Structures an editing task's title, status, tools and primary commands.",
    'header title/status → toolbar/action groups.',
    'Connect save, cancel, status and navigation callbacks to editor state. Use compact rules rather than shrinking icons independently.',
  ),
  layout(
    'Hierarchy',
    'Provides shared indentation and spacing context for nested content.',
    'Hierarchy context → nested controls/HierarchyIndent.',
    'Use the shared indentation step for recursive depth. Preserve trigger, drag-handle and menu-indicator DOM order.',
    ['Hierarchy', 'HierarchyIndent'],
  ),
  layout(
    'SectionCard',
    'Provides section surfaces, borders, padding and nested state.',
    'Surface root → children. nested aligns with the parent content track.',
    'Choose surface/muted/plain/paper/overlay and border for the task. Review nested-card adjustment and clipping at narrow widths.',
  ),
  layout(
    'SectionHeader',
    'Places a section title, description and actions.',
    'Title/description → trailing actions. descriptionPlacement accepts with-title/below-row.',
    'Use below-row for long descriptions to preserve action-row layout and reading order. Consumers supply heading semantics.',
  ),
  layout(
    'StatCard',
    'Displays one summary metric and its context.',
    'title → value → supporting context.',
    'Provide the value, units and comparison context. Do not communicate change or risk through color alone.',
  ),
  layout(
    'ToolbarLayout',
    'Places multiple regions within a toolbar.',
    'toolbar track → start/content/end groups.',
    "Check wrapping/overflow at narrow widths without hiding priority controls. ToolbarCommand/Core owns each action's rules.",
  ),
  layout(
    'ToolbarSurface',
    'Provides toolbar surface and density context.',
    'surface → toolbar layout/actions.',
    'Use comfortable/compact and shared spacing. Do not implement density through independent icon sizes or CSS padding.',
  ),
  layout(
    'PageHeader',
    'Structures page title, description and primary controls.',
    'Title/description → actions. Narrow widths use shared layout rules.',
    "Connect the page's heading hierarchy and action purpose. Check long titles and multiple actions at narrow widths.",
  ),
  layout(
    'MediaPreviewGrid',
    'Places image/media previews in a consistent grid.',
    'Grid → item previews and their controls.',
    'Adjust columns, aspect ratio and gap through the public contract. Connect thumbnail names, selection and failure states to actual items.',
  ),

  overlay(
    'FormModal',
    'Provides a modal task for form submission and cancellation.',
    'Named dialog → form children → cancel/submit actions.',
    [
      'Supply submit, cancel and close labels. Connect onSubmit/onClose to the actual task.',
      'loading/submitDisabled block submission; loading also blocks dismissal. Preserve values and provide correction after data errors.',
    ],
    ['FormModal'],
  ),
  overlay(
    'ConfirmModal',
    'Confirms consequences before an important action.',
    'Named dialog → description → cancel/confirm actions.',
    "Identify the action's target, consequences and cancel/confirm text. Final destructive confirmation uses the shared Confirmation Feature danger/strong contract.",
  ),
  overlay(
    'BlockingAlertDialog',
    'Explains a blocking condition that requires acknowledgement.',
    'alertdialog → title/content → required acknowledgement action.',
    'Reserve for required acknowledgement. Match close/Escape policy to the actual blocking task.',
  ),
  overlay(
    'ContentModal',
    'Provides one content view or tool in a modal.',
    'named dialog → content → close action.',
    'Compare FormModal for complex submission tasks. Connect content headings, scrolling, focus order and focus return after dismissal.',
  ),
  entry(
    'Overlays/DialogActions',
    'Aligns concluding dialog commands to the logical end without stretching their buttons.',
    'Optional leading action → trailing cancel/primary commands in DOM order.',
    [
      'Use inside composed ContentModal flows. Put cancel or secondary commands first and the main command last.',
      'leadingActions separates a destructive or auxiliary command from the concluding actions. Leave field controls, list pagination and provider input rows in their own layout.',
    ],
    [
      'Buttons own names, disabled/pending state and activation. DOM order remains keyboard and reading order.',
      'The row is structural: it adds no focus stop, role or invented accessible name.',
    ],
    'End alignment, action-group gap, wrapping and content widths are closed Core decisions. Do not pass justify, grow, gap or presentation overrides.',
    'modal-actions-contract.md',
    ['DialogActions'],
  ),
  overlay(
    'Drawer',
    'Provides a secondary task from the screen edge.',
    'drawer dialog → title/close → scrollable content.',
    'Connect opened/onClose and title/closeLabel to the task. Check short heights, long content, dismissal during editing and loading policy.',
  ),
  overlay(
    'Popover',
    'Provides named dialog content near its trigger.',
    'trigger → dialog/alertdialog popup → content.',
    'role accepts only dialog or alertdialog. Compare DropdownMenu for action lists and Tooltip for brief descriptions.',
  ),
  overlay(
    'FloatingPanel',
    "Structures a floating secondary panel's surface, content and controls.",
    'floating panel → header/actions → body.',
    'Consumers connect panel position and task. Check that other sticky/overlay regions do not obscure focus or dismissal controls.',
  ),
  entry(
    'Overlays/Tooltip',
    'Provides a short supplementary description on hover/focus.',
    'trigger/anchor → tooltip text.',
    'Keep essential information and complex interactions outside tooltips. Name icon commands on the actual control.',
    [
      "Make descriptions available on keyboard focus. Keep the trigger's accessible name distinct from its tooltip description.",
      'Review dismissal, hover persistence and duration in the actual consuming screen.',
    ],
    [
      'A tooltip does not supply a button/link role or replace its name. Touch tasks must not depend on tooltip content alone.',
    ],
    'toolbar-api-review.md',
  ),

  navigation(
    'Tabs',
    'Switches between related panels in the same screen.',
    'Tabs root → named Tabs.List → Tabs.Tab → Tabs.Panel.',
    'The root name is a List fallback; an explicit List name takes priority. Connect values, panels and loading/empty states to actual data.',
    [
      'Check the tablist name, tab/panel relationships and selected state.',
      'Check arrow navigation, Tab entry/exit, activation model and focus in the actual story. Use navigation components for page destinations.',
    ],
  ),
  navigation(
    'DropdownMenu',
    'Opens related commands and destinations from a trigger.',
    'trigger → menu → named items/separators/groups.',
    'Distinguish command items from href items. Navigation preserves modified clicks and native link behavior. Place the disclosure indicator after the trigger label.',
    [
      'Supply trigger expanded/controls relationships and names for the menu and each item.',
      'Check arrow navigation, Enter activation, Escape dismissal, focus return and disabled-item handling.',
    ],
  ),
  navigation(
    'SideNavigation',
    'Displays page navigation structure and the current location.',
    'named navigation → groups → href items/current state.',
    'Connect actual routes, current location and hierarchy. Check navigation opening/dismissal and content focus on narrow screens.',
    'Check navigation landmark naming, aria-current and keyboard order in the actual page.',
  ),
  navigation(
    'MapNavigation',
    'Composes map navigation and controls.',
    'Map navigation controls → actual map callbacks.',
    'Features connect map data and camera state and consume shared controls. Distinguish directional icons from menu indicators.',
    "Check each map control's name, keyboard alternative and unobscured focus in the actual map context.",
  ),
  navigation(
    'MenuToggle',
    'Provides a menu opening/dismissal trigger.',
    'Named toggle control → expanded state → connected menu/panel.',
    'Connect actual opened, onClick and controls relationships. A chevron alone does not implement an interaction.',
    'Expose current state through aria-expanded. Check dismissal and focus return in the connected menu/panel.',
  ),
  navigation(
    'TableOfContents',
    "Navigates the current document's headings.",
    'Named navigation → quiet decorative rail/current mark → hover or focus reveals one bounded scrolling title list.',
    'Connect target heading IDs to actual document order. All headings remain in the outline. Pointer selection keeps it open until leaving; reopening starts at the beginning. See table-of-contents.md for the visually inspected Notion reference and user scenarios.',
    'Check independent list/body scrolling, last-row reachability, wrapped hierarchy, hover continuity, current location, keyboard dismissal and target heading focus.',
  ),
  navigation(
    'CommandPalette',
    'Selects commands and destinations within a named search dialog.',
    'Named dialog → search input → grouped results → selection execution.',
    'Connect query, results, command callbacks and hrefs. Define empty results, loading, unavailable commands and cancellation.',
    [
      'Check dialog/combobox names, active option and selection relationships.',
      'Review opening shortcuts, arrow keys, Enter, Escape and focus return in the actual task.',
    ],
  ),
  navigation(
    'CommandSuggestions',
    'Provides command suggestions linked to an input.',
    'anchor input → suggestions/listbox → active item.',
    'Connect items, activeId, onSelect, inputElement and position to the actual input. The host owns query. Fixture props do not define the public Core API.',
    'Check anchor controls/expanded/activedescendant, suggestion names and keyboard selection together.',
    ['CommandSuggestions'],
  ),
  navigation(
    'Carousel',
    'Navigates sequential items with previous/next controls.',
    'viewport → slides → named previous/next controls.',
    "Connect children, slideSize, slideGap, loop and labels to actual items. Core's carousel owns the current item, movement and previous/next boundaries. Essential information must not depend on automatic animation.",
    'Check previous/next purpose, current item, keyboard interaction and reduced motion with actual content.',
  ),

  entry(
    'Data Display/DataTableView',
    'Displays structured records with sorting, selection and navigation.',
    'table → column headers/sort controls → rows/cells → optional selection → loading/empty state.',
    [
      'Connect columns, rows, row keys, sorting, selection and row actions to the data model. Sorting must change the actual order, not only its icon.',
      'Review horizontal scrolling for necessary two-dimensional content at narrow widths. Compose toolbar and pagination separately.',
    ],
    [
      'Check table name, column headers, sort state, selection names and the select-all mixed state.',
      'Avoid double activation between row actions/links and row selection. Check loading, empty, failure and pagination outcomes in the actual flow.',
      'Use rowInteraction.getDescription for localized action constraints. It describes both the desktop row and mobile command without replacing the row name. Use isDisabled only when every row action is unavailable; selection eligibility belongs to selection.isRowSelectable.',
    ],
    [
      'Row/cell rendering owns data content while consuming shared Table, Button and Checkbox rules.',
      "Preserve the generic Row type name in the API table. Actual column/callback types follow the consumer's generic argument.",
    ],
    ['table-api-review.md', 'tables-and-toolbars.md'],
    ['DataTableView'],
  ),
  entry(
    'Data Display/NearEndLoader',
    'Continues a paged result set as the user approaches the scroll boundary.',
    'scroll-root sentinel → loading/end status → retry or keyboard continuation.',
    [
      'Provide the opaque next pageKey, result-set resetKey and async onLoad operation. Null pageKey marks the end. The feature owns the actual query, request cancellation and loaded records.',
      'Use rootRef for an explicit scroll root; otherwise the closest scrolling ancestor is measured. Automatic requests occur once per cursor and do not loop on failure.',
      'Keep existing records visible during further loading or a page error. Replacing the entity, search or filter must protect against stale responses.',
    ],
    [
      'Supply localized load/loading/end/retry/failed text. Loading and end are status information; failure exposes a readable error and explicit retry.',
      'Automatic continuation retains a keyboard command visible on focus. A final page retains an already-focused unavailable command until focus leaves.',
    ],
    [
      'Do not use a false cursor for a complete non-paginated folder endpoint. Do not treat a failed page as an empty result.',
      'This component does not invent total counts, backend retention or authorization. Native assistive-technology acceptance is separate from source and browser checks.',
    ],
    ['file-browser.md', 'version-history.md', 'compact-interface-contract.md'],
    ['NearEndLoader'],
  ),
  display(
    'Display',
    'Provides basic display components including Avatar, Pagination, Table and Spinner.',
    "Each display component's root, content and optional supporting slots.",
    [
      'Pagination uses a finite integer page range; implementation normalization handles NaN/Infinity and out-of-range values. Connect onChange/navigation to actual page changes.',
      'Preserve Table header/cell semantics. Supply Avatar alt, Spinner names and Skeleton loading meaning for actual content.',
    ],
    ['Avatar', 'Pagination', 'ScrollArea', 'Separator', 'Skeleton', 'Spinner', 'Table'],
  ),
  display(
    'LabelBadge',
    'Displays a short category or tag label.',
    'badge root → label → optional icon.',
    'Compose a separate named action for filtering or editing. The label itself does not become a command.',
  ),
  display(
    'StatusBadge',
    'Displays record status through brief text and a color role.',
    'badge root → status label.',
    'Use the actual status label. Color alone must not communicate success, warning or danger.',
  ),
  display(
    'Chart',
    'Charts data relationships and trends.',
    'chart region → axes/series → legend/tooltip.',
    'Connect units, ranges, legends and missing data to actual values. Review table/text alternatives and chart focus/tooltips where needed.',
  ),
  display(
    'Collection',
    'Displays multiple items using shared list/collection structure.',
    'collection root → item content → action/selection.',
    'Connect stable keys, order, empty state and item links/commands. Do not replace actual actions with decorative icons.',
  ),
  display(
    'DateTime',
    'Formats dates and times for the locale.',
    'semantic time/value → formatted text.',
    'Distinguish stored value, time zone and display locale. null/undefined and invalid dates display the fallback.',
    ['DateTime'],
  ),
  display(
    'FileTypeIcon',
    'Displays a supporting icon for a file type.',
    'file type → owned glyph.',
    'Use with a filename/extension. A type icon alone does not describe file content or a download action.',
  ),
  display(
    'ImageChrome',
    'Places readable titles, descriptions and controls over images.',
    'image parent → owned shade/placement/inset → content.',
    'Review contrast as image brightness and crop change. Use the contrast role for overlay controls.',
    ['ImageChrome'],
  ),
  display(
    'MetadataPair',
    'Displays one metadata name/value relationship.',
    'term → value.',
    'Connect label and value to the record. Compose shared navigation/actions for linked or interactive values.',
  ),
  display(
    'PublicMetadata',
    'Displays metadata name/value pairs on public screens.',
    'metadata rows → term/value pairs.',
    'Supply only publishable data. Check empty/long values, locale and reading order.',
  ),
  display(
    'SocialIcon',
    "Displays an external service's identifying icon.",
    'service identity → icon.',
    'Compose external navigation as a named href link. A service glyph alone does not provide its link name. Sign-in identities use the same API: platform="google" draws the four-segment Google mark from the fixed provider palette in brand mode. Catalog-free client views receive server-prepared glyphs from prepareSocialIcon(platform); colors always come from the Core registry, never from consumer CSS colors.',
  ),

  interaction(
    'Disclosure',
    'Expands and collapses related content.',
    'leadingActions → trigger(label → trailing chevron) → content.',
    'Place drag handles outside the trigger in leadingActions. Keep the chevron at the default end position. Connect nested/opened values to the actual hierarchy.',
    'Check trigger name, aria-expanded/controls, Enter/Space activation and focus order within expanded content.',
  ),
  interaction(
    'DisclosureRegion',
    'Composes a named disclosure region.',
    'named trigger/region → disclosure content.',
    'Connect collapsed/expanded state to the consumer. Use shared spacing for long and nested content.',
    'Check trigger/region names and expanded relationships. Hidden content must leave keyboard order.',
  ),
  interaction(
    'ResizeHandle',
    'Resizes a panel boundary.',
    'Named slider handle → resize callback → actual panel geometry.',
    'Connect direction, current value, minimum/maximum and actual panel geometry. A decorative separator is not a resize handle.',
    'Check the slider name, orientation, current value, range boundaries and keyboard resizing/cancellation. The visible handle and pointer hit area are separate geometry rules.',
  ),
  interaction(
    'SelectionSurface',
    'Provides shared selectable-item and selection presentation.',
    'selectable root → content → SelectionStatus.',
    'Connect actual selection state and callbacks. Separate selection, opening and navigation into their respective actions. Use unavailable only when the whole item is unavailable. Use selectionUnavailable with selectionUnavailableDescription when selection is blocked but preview or context actions remain available; that item cannot be selected.',
    'Check selected state, item names, keyboard entry and select-all mixed relationships in the actual list. Selection-only constraints keep the row enabled and add a description; do not mark a working preview aria-disabled.',
    ['SelectionGrid', 'SelectionSurface', 'SelectionThumbnail', 'SelectionRow', 'SelectionPath', 'SelectionViewport'],
  ),
  interaction(
    'BlockSelectionTarget',
    'Provides the shared selection target for an independent editor block.',
    'positioned block (geometry and selected boundary) → transparent named target button → Core focus ring.',
    'Connect focus/click/keyboard handlers to the editor selection command. pass-through keeps block content interactive and serves keyboard selection; capture covers embedded frames so a click selects the block. The block owns its persistent selected outline.',
    'Check the target name, tab order (tabIndex -1 when the editor is read-only), focus ring visibility and that selection does not steal content focus or editor selection.',
    ['BlockSelectionTarget'],
  ),
  interaction(
    'ReorderRow',
    'Structures controls within a reorderable row.',
    'Working drag handle on the left → row content → trailing actions.',
    'Supply actual sensor/activator bindings to the handle. Connect pending/disabled and drop outcomes to actual state.',
    'Check handle name, keyboard sensor, focus retention, movement announcements and non-drag alternatives in the reorder flow.',
  ),
  interaction(
    'SortableSurface',
    'Composes working drag and keyboard reordering for a list.',
    'sortable context → keyed items → activator/drag overlay.',
    'Connect stable IDs, items, callbacks and actual reorder results. The drag overlay reuses original content and shared styling.',
    'Check Space/Enter, arrow keys, Escape, focus after movement and change announcements in the actual flow.',
  ),
  interaction(
    'SortableGroups',
    'Composes item reordering within and between groups.',
    'groups → sortable items → actual handle → drop target.',
    'Connect stable group/item IDs and movement callbacks. Review empty groups, cross-group moves, rejected drops and cancellation.',
    'Check group/item names, keyboard movement, position announcements, focus after drop and a non-drag movement path.',
    ['SortableGroups'],
  ),
  entry(
    'Interaction/Accessibility',
    'Reviews Core naming, relationships and keyboard flow in composed examples.',
    'Interactive fixtures for keyboard forms, menus and dialogs.',
    'Use these fixtures and play tests for component regression review. Check additional product-page context and assistive technology separately.',
    [
      'Check names, roles, values and states alongside actual Tab/Arrow/Enter/Escape flows.',
      'Automated accessibility checks, keyboard execution and VoiceOver/Orca integration each have separate coverage.',
    ],
    'This group does not expose a Core component API. Fixture props are not consumer contracts.',
    ['ownership-contract.md', 'release-readiness.md'],
    [],
  ),

  feedback(
    'Alert',
    'Displays information, success, warning and error feedback.',
    'alert root → title/body → optional actions.',
    'Explain the actual state, cause and resolution. Connect retry/correction paths for significant errors and preserve meaning beyond color.',
  ),
  feedback(
    'PageLoaderView',
    'Displays initial page loading.',
    'Page loading region → named progress/description.',
    'Connect actual requests to completion/failure pages. Do not leave a loading placeholder as the final empty state.',
  ),
  feedback(
    'ProcessingOverlay',
    'Displays work in progress and interaction restrictions over a region.',
    'busy parent → processing overlay → named status.',
    'Connect blocking scope, execution prevention and recovery after failure to the actual processing task.',
  ),
  feedback(
    'Progress',
    'Displays progress state or a measured percentage.',
    'named progressbar → track/value.',
    'value is a percentage clamped to 0–100; null is indeterminate. Supply aria-label or aria-labelledby. Do not invent numeric progress for an indeterminate task.',
  ),
  feedback(
    'RouteProgressBar',
    'Displays actual route-transition progress.',
    'route transition state → progress indicator.',
    'Connect route-transition start, completion and failure. Distinguish it from saving within the current screen.',
  ),
  feedback(
    'SegmentedProgress',
    'Displays multiple item percentages as segmented progress.',
    'Named progressbar → per-item segments, percentage labels and tooltips.',
    'Connect segment id, label, value and tone to actual items. Negative/invalid values become 0; totals above 100 are proportionally normalized to 100. This is not a wizard current/completed API.',
  ),

  media(
    'MediaImage',
    'Provides image aspect ratio, fit, loading and failure presentation.',
    'Image wrapper → image or loading/fallback.',
    'Supply alt for meaningful images and empty alt for decoration. Choose fill/fit, aspect ratio and fallback for actual content conditions.',
    "Match alternative text to the image's role. Preserve essential information and controls when fallback appears.",
  ),
  media(
    'MediaControls',
    'Provides shared media playback and value controls.',
    'Play/pause, mute and volume controls → current time/duration display → additional actions. Optional MediaAudioFrame provides the surface.',
    'Connect play/pause, current time, duration, volume and loading to actual media state. Distinguish commands from persistent toggles.',
    'Check the current command name, slider value, keyboard navigation, error recovery and focus in the media task.',
  ),
  media(
    'ImageCropper',
    'Adjusts an image crop region and result.',
    'image stage → crop geometry → controls → confirmation.',
    'Connect crop result, aspect ratio, cancellation and saving to the upload task. Geometry corresponds to image dimensions and source coordinates.',
    'Review crop-control names, keyboard/non-drag interaction, result confirmation and focus return after cancellation.',
  ),
  media(
    'ImageUploadField',
    'Composes image selection, preview and replacement.',
    'named field → chooser/drop → preview → replace/remove actions.',
    'Distinguish selection, validation, uploading, completion and failure. Selecting a file does not confirm upload success.',
    'Check field and replace/remove names, error relationships and focus return in the upload flow.',
  ),
  media(
    'ImageUploadCropField',
    'Composes cropping, confirmation and upload after image selection.',
    'upload field → crop dialog → resulting preview/actions.',
    'Connect original selection, crop result, retry, cancellation and actual upload callbacks. Preserve the existing image after cancellation.',
    'Check upload/crop names, errors, focus entry/return and non-drag crop alternatives.',
  ),

  entry(
    'Typography/Text',
    'Expresses UI body and heading typography roles.',
    'semantic text/heading root → content.',
    'Choose size, weight, tone, contrast and wrap by semantic role. Use Heading with a level matching the actual page hierarchy.',
    'Check heading/paragraph semantics, reading order and content preservation at 200% zoom, with long translations and adjusted text spacing.',
    'Do not copy font-size, line-height or colors into Feature CSS. Keep ownership of UI typography distinct from user-authored content.',
    ['token-contract.md', 'size-density-contract.md'],
  ),
  entry(
    'Typography/SupportingText',
    'Displays descriptions and supporting text consistently.',
    'supporting text root → content.',
    'Use for help, constraints and supporting metadata. Keep essential errors and instructions visible at appropriate emphasis.',
    'Maintain contrast and description relationships required by the information. muted does not mean decorative or meaningless.',
    'Compose actual links/actions for interactive text. Do not turn SupportingText into a clickable span.',
    'token-contract.md',
  ),
  entry(
    'Typography/LocaleCode',
    'Displays locale identifiers with shared formatting.',
    'locale value → formatted code text.',
    'Supply actual locale values. Distinguish user-facing language names from technical identifiers.',
    'For selection controls, provide purpose, current language and full name separately. A code alone may not identify the language task.',
    'The display component does not implement locale switching.',
    'token-contract.md',
  ),
  entry(
    'Typography/TypographySupport',
    'Provides shared code, list and visually hidden text components.',
    'Code/List/List.Item/VisuallyHidden → actual content.',
    'Use ordered lists when order matters. Check Code wrapping/scrolling with long code. Reserve VisuallyHidden for necessary descriptions.',
    'Preserve list/code semantics and reading order. Hidden descriptions must not become invisible focusable controls.',
    "The fixture's ordered/wrap props are not public Core APIs. Check the actual component types and implementations below.",
    'token-contract.md',
    ['Code', 'List', 'VisuallyHidden'],
  ),
]);

guidance['Core/Input/MultiSelectComboboxView'] = Object.fromEntries([
  entry(
    'Input/MultiSelectComboboxView',
    'Searches, selects, removes and creates multiple domain items.',
    'Label → internal MultiSelect → selected pills/removal → results or creation candidate.',
    [
      'selectedItems and options contain T extends MultiSelectItem. Connect id/name and onSelect/onDeselect to actual state.',
      'label, placeholder, emptyMessage, notFoundMessage, createOptionLabel and canEdit are required contracts. Do not substitute value/onChange/defaultValue.',
      'Connect canCreateNew/onCreate/isCreating to actual item creation. canEdit=false projects the internal MultiSelect to disabled.',
    ],
    [
      'Check label and removal-control names. Distinguish isLoading/isCreating busy state from empty results.',
      'Check focus and retention of existing selections after search, selection, removal and creation.',
    ],
    ["Preserve Core's generic item model. Do not expose all internal MultiSelect props as this view's API."],
    ['input-contract.md', 'choice-api-review.md'],
    ['MultiSelectComboboxView'],
  ),
])['Core/Input/MultiSelectComboboxView'];
guidance['Core/Input/FileDropzone'] = Object.fromEntries([
  entry(
    'Input/FileDropzone',
    'Provides file selection and drop within the same task.',
    'Named DropZone → FileTrigger/file chooser button (title/description/icon) → accepted/rejected callbacks.',
    [
      'label, icon and onFilesSelected are required. Connect accept, multiple, maxFiles and maxSize to actual upload policy.',
      'onFilesRejected distinguishes too-large/invalid-type/too-many/unknown. Selected files are not completed uploads.',
    ],
    [
      'Check DropZone naming and chooser title/description relationships. The file chooser is the non-drag alternative to dropping files.',
      'Explain rejection reasons, correction/reselection paths and upload failure in the actual consumer.',
    ],
    [
      'size accepts compact/standard/large and falls back to standard. This API does not expose InputSize xs–xl or value/onChange.',
      'disabled blocks selection/drop. Do not infer support for readOnly, error or Input density.',
    ],
    'input-contract.md',
    ['FileDropzone'],
  ),
])['Core/Input/FileDropzone'];
guidance['Core/Input/Radio'].components = ['Radio', 'Radio.Group'];
guidance['Core/Input/Radio'].propTypes = { 'Radio.Group': 'RadioGroupProps' };
guidance['Core/Input/Radio'].constraints.push(
  'Radio requires an item value. Radio.Group owns value/defaultValue/onChange/orientation. Keep item and group props separate.',
);
guidance['Core/Navigation/Tabs'].components = ['Tabs', 'Tabs.List', 'Tabs.Tab', 'Tabs.Panel'];
guidance['Core/Navigation/Tabs'].propTypes = {
  'Tabs.List': 'TabsListProps',
  'Tabs.Tab': 'TabsTabProps',
  'Tabs.Panel': 'TabsPanelProps',
};
guidance['Core/Navigation/DropdownMenu'].components = [
  'DropdownMenu',
  'DropdownMenu.Dropdown',
  'DropdownMenu.Item',
  'DropdownMenu.Label',
  'DropdownMenu.Divider',
  'DropdownMenu.Section',
  'DropdownMenu.Sub',
  'DropdownMenu.Sub.Target',
  'DropdownMenu.Sub.Dropdown',
];
guidance['Core/Navigation/DropdownMenu'].propTypes = {
  'DropdownMenu.Dropdown': 'DropdownMenuDropdownProps',
  'DropdownMenu.Item': 'DropdownMenuItemProps',
  'DropdownMenu.Label': 'DropdownMenuLabelProps',
  'DropdownMenu.Divider': 'DropdownMenuDividerProps',
  'DropdownMenu.Section': 'DropdownMenuSectionProps',
  'DropdownMenu.Sub': 'DropdownMenuSubProps',
  'DropdownMenu.Sub.Target': 'DropdownMenuSubTargetProps',
  'DropdownMenu.Sub.Dropdown': 'DropdownMenuSubDropdownProps',
};
guidance['Core/Navigation/DropdownMenu'].constraints.push(
  'DropdownMenu.Target accepts one ReactElement child to connect the trigger. This inline contract is documented here rather than extracted into the API table.',
);
guidance['Core/Navigation/DropdownMenu'].usage.push(
  'Always-present chrome (site header, language and account menus) uses OnDemandDropdownMenu: the same props, members and server markup, with React Aria Menu/Popover loaded on the first hover, focus or press and shown as soon as they arrive. Screens that already ship menu code keep DropdownMenu.',
);
guidance['Core/Overlays/Tooltip'].usage.push(
  'Always-present chrome uses OnDemandTooltip: the same props and markup; the positioned surface loads on the first hover or focus, normally within the open delay.',
);
guidance['Core/Overlays/Drawer'].usage.push(
  'OnDemandDrawer renders nothing while closed and loads the surface on first open (or preloadDrawer() on trigger hover/focus). ApplicationFrame site navigation uses it; the trigger keeps focus until the drawer opens, so focus returns to it on close.',
);
guidance['Core/Overlays/ConfirmModal'].usage.push(
  'confirmDialogs.open() with one ConfirmDialogHost near the root is the imperative path. The host loads its renderer on the first request (which waits in the queue); loading="eager" is for Storybook and tests.',
);
guidance['Core/Overlays/Popover'].components = ['Popover', 'Popover.Target', 'Popover.Dropdown'];
guidance['Core/Overlays/Popover'].propTypes = {
  'Popover.Target': 'PopoverTargetProps',
  'Popover.Dropdown': 'PopoverDropdownProps',
};
guidance['Core/Navigation/CommandPalette'].components = ['CommandPalette', 'CommandPaletteResults'];
guidance['Core/Navigation/CommandPalette'].constraints.push(
  'CommandPaletteResults items are destinations with id/label/href. Do not invent a separate command callback prop.',
);
guidance['Core/Media/MediaControls'].components = ['MediaTransport', 'MediaAudioFrame', 'MediaWaveformSeek'];
guidance['Core/Media/MediaControls'].constraints.push(
  'MediaTransport displays currentTime/duration and does not expose a playback-position callback. Seeking belongs to MediaWaveformSeek: one native range named by label, with aria-valuetext "current / duration", arrows ±5 s, Page ±10 s, Home/End and Enter/Space playback toggle; the waveform host stays a pointer surface.',
  'Exported or persisted audio DOM uses applyAudioMediaPresentation and applyAudioSeekPresentation. Core maps the audio-player__*/data-audio-player-* protocol onto its own module classes; Feature CSS and Core CSS must not style those protocol class names.',
);
guidance['Core/Typography/Text'].components = ['Text', 'Heading'];
guidance['Core/Data Display/Display'].usage.push(
  'Keep inactive table-row data readable using the shared muted text role. Nested controls own their disabled presentation; do not reduce opacity across the entire row.',
);
guidance['Core/Feedback/ProcessingOverlay'].usage.push(
  'Status content sits directly on the overlay-strong scrim. Review text contrast over actual content, including light media, in the consuming region.',
);
guidance['Core/Data Display/PublicMetadata'].constraints.push(
  'inverse requires an actual image or dark chrome surface, such as Core ImageChrome. A story background parameter alone does not establish that context.',
);

guidance['Core/Feedback/Progress'].usage.push(
  'Optional title/status use compact xs typography; status is also the progress description. title is visible task text rather than the native title tooltip. xs is a 2px bar; sm retains the ordinary bar. Image contrast requires an actual dark scrim/media surface.',
);
guidance['Core/Feedback/Progress'].relatedDocs.push('docs/design-system/compact-interface-contract.md');
guidance['Core/Feedback/ProcessingOverlay'].usage.push(
  'Pass the shared Progress API in progress; the wrapper owns the blocking scope and image contrast. Preserve children only for existing custom processing content, not another independently styled progress bar.',
);
guidance['Core/Feedback/RouteProgressBar'].usage.push(
  'idle/waiting remain hidden; loading consumes the shared indeterminate Progress xs without surrounding inset, and completing commits 100. Do not present invented numeric completion.',
);
for (const title of ['ContentModal', 'Drawer']) {
  guidance[`Core/Overlays/${title}`].usage.push(
    'Compact chrome is the default. Choose standard density explicitly; size/placement remain independent. Long content scrolls in the body while the header stays visible.',
  );
  guidance[`Core/Overlays/${title}`].relatedDocs.push('docs/design-system/overlay-density-contract.md');
}
Object.assign(
  guidance,
  Object.fromEntries([
    entry(
      'Actions/CopyButton',
      'Copies a text value to the clipboard from an icon command and confirms the result in place.',
      'IconButton (copy glyph → positive check glyph) with a Tooltip → visually hidden polite status region.',
      [
        'Supply value (or a function read at press time), label and copiedLabel from locale messages. Core performs the clipboard write, shows the check for a Core-owned 2 seconds and resets.',
        'Use onCopyError to give recovery feedback (for example a danger notification) when the clipboard is unavailable or denied. Do not add a second success toast; the in-place check and status announcement are the single success treatment.',
        'Use a labeled Button instead when the copy command is a primary dialog action that needs visible text.',
      ],
      [
        'label is the stable accessible name and tooltip; it does not change when copied. copiedLabel is announced through a polite status region after a successful write.',
        'Connect aria-describedby when the copied value is identified by nearby context such as a link row.',
      ],
      [
        'Glyphs, tone, emphasis and confirmation timing are Core-owned; children, tone and visual overrides are rejected.',
        'jsdom tests mock navigator.clipboard. Real clipboard permission behavior and spoken announcements require browser and assistive-technology checks.',
      ],
      ['icon-text-button-api-review.md', 'spacing-icon-contract.md'],
    ),
    feedback(
      'EmptyState',
      'States that a collection, folder or result set has no items and offers an optional next step.',
      'Optional decorative 48px glyph → title → optional description → optional action. section inset adds the shared block inset; none sits inside an owning card or SelectionEmptyState region.',
      [
        'Use for an empty collection before any query or filter is applied. Filtered "no results" inside a table keeps the table empty message. Pass the Tabler glyph component; Core owns its size, stroke and muted color.',
        'Use live when the empty state replaces content after a user query or mutation. SelectionEmptyState remains the centered region for selection surfaces (preview, loader or empty); compose EmptyState inside it for empty content.',
      ],
    ),
    display(
      'StatusIcon',
      'Renders a glyph in a shared status tone at a Core-owned size.',
      'Decorative or named span → Tabler glyph at sm 16px, md 24px or lg 48px in positive/warning/danger/accent/neutral.',
      [
        'Pass the glyph component and a tone. Supply label only when the glyph alone carries a value (for example a yes/no table cell); otherwise adjacent text carries the meaning and the glyph is hidden from assistive technology.',
        'Do not pass raw color, size or stroke to status glyphs in Features. neutral uses the muted text role for inactive or negative values.',
      ],
    ),
    input(
      'SearchInput',
      'Captures a free-text query with native search semantics and the shared leading search glyph.',
      'TextInput with type="search" and inputmode="search"; the leading glyph follows the input size (14px at xs, 16px otherwise). WebKit native search decorations are hidden. SearchComboboxView uses leadingGlyph="search" for the same glyph in lookup comboboxes.',
    ),
  ]),
);
guidance['Core/Data Display/Display'].usage.push(
  'Avatar name derives one uppercase grapheme (first letter or number) for the fallback and shows the shared person glyph for a blank name. name is decorative fallback text, not the accessible name; supply alt when the avatar itself identifies someone. Do not compute initials in Features.',
);
guidance['Core/Layout/StatCard'].usage.push(
  'Pass the glyph component to icon; Core renders it at 20px with a 1.5 stroke in the card tone. href turns the whole card into one block navigation link; prefetch follows the shared navigation contract.',
);
export default guidance;
