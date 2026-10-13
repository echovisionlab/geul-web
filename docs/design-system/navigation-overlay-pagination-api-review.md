# Navigation, Tabs, Menu, Popover and Pagination review

Status: Draft. Reviewed against current Core APIs and actual consumers. Corrections and DOM tests below are not design approval or an application-wide accessibility pass. Colors, neutral emphasis and Feature CSS were unchanged.

## Adopted criteria

| Area                | Review criterion                                                                                                                                                                                                                                                                           | Geul application                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Page navigation     | Ordinary site navigation uses links/disclosure. Menu roles require their keyboard contract. [APG disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)                                                                               | Expanded SideNavigation uses links/disclosure; compact group popups use DropdownMenu                               |
| In-screen tabs      | Distinguish tablist name, tab/panel relations, selection, roving focus and automatic/manual activation. [Carbon Tabs](https://www.carbondesignsystem.com/building-blocks/core/components/tabs/accessibility), [APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)                   | Use NavigationLink for URL navigation; automatic activation suits consumers with immediate panel display           |
| Menu commands       | Check button name/expanded state, first-item focus, arrows, Escape and trigger restoration. [Carbon Menu buttons](https://www.carbondesignsystem.com/building-blocks/core/components/menu-buttons/accessibility), [APG Menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) | Keep React Aria menu behavior. selected display is not a radio/checkbox-role implementation                        |
| Popup forms/content | Check dialog name, focus entry/restoration, Escape and background restrictions. [APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)                                                                                                                                       | Popover holds dialog/alertdialog content; DropdownMenu is a command menu                                           |
| Page numbers        | Check previous/next names, current page, disabled boundaries and keyboard interaction. [Carbon Pagination](https://www.carbondesignsystem.com/building-blocks/core/components/pagination/accessibility)                                                                                    | Carbon page-size selection and interactive ellipsis are absent from Geul's current API; no new controls were added |

Carbon tags/appearance/approval results are not assigned to Geul. Geul uses React Aria div[role=tab] and a/div[role=menuitem]; their roles and behavior are what is verified.

## Current APIs and responsibilities

### NavigationLink, SideNavigation and MenuToggle

Owners: components/core/Navigation/NavigationLink.tsx, navigation-events.ts, NavigationIntentProvider.tsx, components/core/SideNavigation/SideNavigation.tsx and components/core/MenuToggle/MenuToggle.tsx.

- NavigationLink accepts string or Next URL-object href and supports replace/scroll/prefetch/target/rel/download/onNavigate. Defaults: appearance=content, mediaPosition=fill, separator=none, tone=primary. appearance content/quiet/block/media/row/graphic (graphic: content-sized inline-flex box around a logo or image, no underline, inherited color; used by public form and form dashboard logos and Marquee logo items); size xs/sm/md; weight regular/medium/strong; tone primary/secondary/muted/inverse/inherit.
- Only ordinary same-origin clicks pass through app NavigationIntentProvider. Canceled events, modifiers, other targets, downloads and external links retain browser navigation. No disabled link API. Callers name icon/media-only links.
- SideNavigation consumes caller ariaLabel/sections/mode/openSectionKeys/onToggleSection/onSelectItem. Consumer state controls expanded/compact mode. Active items use aria-current=page; expanded group buttons use aria-expanded/aria-controls and hidden content. showExpandedIcons defaults true.
- MenuToggle requires opened/label/onClick and renders a Core IconButton size=chrome (32px, 16px glyph, coarse pointer ≥ 44px) with aria-expanded/aria-controls and a menu/close glyph swap. It has no size prop; visibility defaults always (always/mobile-only). With controls, callers connect an existing target ID and open state. Not every toggle is a menu.

### Tabs

Owner: components/core/Tabs/Tabs.tsx.

- Root: value/defaultValue/onChange, keepMounted, orientation, activation, disabled, fill. Defaults: tone=neutral, appearance=line, keepMounted=true, orientation=horizontal, activation=automatic, disabled=false, fill=false. appearance line/outline/pills. null value maps internally to undefined; it does not guarantee empty selection.
- List: grow, wrap=wrap/nowrap, inset/paddingTop. Tab: value, disabled, leftSection/rightSection, externalPanel. Panel: value, inset/paddingTop. List/Panel inset/paddingTop default none.
- List aria-label/aria-labelledby takes precedence, otherwise Root naming is forwarded. Disabled tabs are skipped; manual mode separates arrow focus from Enter/Space activation. Inactive mounted panels use inert to restrict reading/keyboard access.
- externalPanel={id, tabId} connects an external panel; callers update its content/aria-labelledby for the active tab. Actual owners: features/admin/MapThemeEditor/MapThemeVariantTabs.tsx and ThemeEditorCanvas.tsx.
- MapThemeVariantTabs uses existing mapControls.fields.colorScheme naming (Color Scheme and its Korean translation). PageBlockSettingsSurface uses the existing section title passed from SectionItemView. Naming added no visible copy, translation keys or new props.

### DropdownMenu

Owner: components/core/DropdownMenu/DropdownMenu.tsx.

- Root defaults: size=standard, placement=bottom-start, trigger=click, portal=true, arrow=false, defaultOpened=false, closeOnItemClick=true, loop=true. size compact/standard/wide/expanded; trigger click/hover/click-hover. opened/onChange is controlled; defaultOpened initializes uncontrolled state. onOpen/onClose supported.
- Target is one ReactElement. Tooltip and Core/native triggers connect through OverlayTriggerTarget without nesting buttons. Hover adds an input path while retaining keyboard/click access.
- Item: icon/colorPreview, tone, selected, disabled, onClick, href/target/rel/download, id/title, aria-label/aria-current and data attributes. href items are anchors. String children or aria-label supplies typeahead textValue.
- Current selected means a check mark and aria-current=true. No selectionMode/selectedKeys, menuitemradio/menuitemcheckbox or aria-checked APIs. Mutually exclusive/toggle menus need a separate contract review against [APG Menu roles](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).
- Supports Section(label), Label, Divider, Sub(size/placement), Sub.Target(children/icon/disabled), Sub.Dropdown. Sub placement defaults right-start. Sub.Target with only compound nodes has no separate aria-label/textValue API; inspect naming/typeahead in actual submenu consumers.
- Menu popup is isNonModal; open editor content is not hidden from AT. Command execution/dismissal and link navigation are separate. App guards canceling navigation do not remove existing Item onClick/dismissal behavior.

### Popover

Owners: components/core/Popover/Popover.tsx and Popover.type-test.tsx.

- Root: open/defaultOpen/onOpenChange/onOpen/onClose, placement=bottom-start, size=standard, portal=true. placement bottom-start/bottom/bottom-end/top-start/top/top-end; size compact/standard/wide.
- Target is one ReactElement. Dropdown accepts padding=standard (none/compact/standard), id, aria-label/aria-labelledby/aria-describedby, role, click/mousedown and data attributes.
- role permits only dialog (default)/alertdialog. Other roles such as menu/group are rejected by types/runtime, not silently coerced. No separate modal-mode API; it uses React Aria Popover default modality.
- Consumer title/name takes precedence; otherwise trigger ID supplies naming. features/data-table/MultiFilterEditorView.tsx and MultiSortView.tsx provide explicit names. Actual form initial focus, scrolling and mobile Drawer transitions need browser verification.

### Pagination

Owners: components/core/Display/Pagination.tsx, features/data-table/DataTablePagination.tsx and features/data-table/ServerDataTable/ServerDataTablePaginationView.tsx.

- Core Pagination has two exclusive modes. Button mode requires value/total/onChange; link mode requires value/total/getHref(page) => string. Types reject onChange with getHref and reject replace/scroll/prefetch/onNavigate in button mode.
- labels: previousPage, nextPage, page(page) function; optional firstPage/lastPage add first/last controls in either mode. size defaults sm (xs/sm/md/lg/xl). nav uses explicit aria-label or current-page label.
- Both modes share the Core Button/IconButton item appearance. Button mode renders buttons. Link mode renders every reachable page and step as an anchor (Button/IconButton href, Core navigation guard and hover/focus prefetch); the current page is an anchor with aria-current=page. Boundary first/previous/next/last are native disabled buttons without href in both modes.
- Link mode: scroll defaults false (the list updates in place; consumers own scroll restoration), replace/prefetch pass through, onNavigate({ page, href, preventDefault }) runs only for ordinary same-origin primary clicks; Ctrl/Command/Shift/Alt and canceled events keep native anchor behavior.
- Pagination.tsx has no client directive: link mode renders from Server Components and only passes href/label strings to client parts. No client state is needed.
- value/total normalize to finite integers. total minimum is 1; current is 1..total; NaN/Infinity become 1. Shows first, current±2 and last; a gap larger than one page shows a decorative ellipsis. No page-size selection API.
- Server consumer: currentPage/totalPages/getPageUrl/labels, onNavigate(href), reserveSpaceWhenHidden. It composes Core link mode with first/last labels and labels.navigation as the nav name, centered in a Feature layout. totalPages<1 hides empty-data pagination; reservation leaves an existing 36px slot. Core value/total normalization now also applies to server pages. The former Feature pager used the same range (current±2 plus first/last with ellipses), so page visibility is unchanged; number items now use Core Button geometry and the Core ellipsis glyph.

## Reproductions and corrections

| Defect                                        | Reproduction                                                                           | Correction / regression evidence                                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Root naming did not reach TabList             | Root name left tablist aria-label null                                                 | Naming fallback/List priority tests plus existing DocumentEditorPanels state-retention regressions                                           |
| Invalid page values                           | value=2.7 retained current=2.7; NaN lacked a current page; Infinity displayed Infinity | Finite integer/range normalization; four invalid-input cases and integer-emission checks                                                     |
| Popover role type differed from actual role   | Broad AriaRole accepted roles silently replaced by dialog                              | Closed role type, runtime rejection, alertdialog naming and rejected-type tests                                                              |
| Menu links bypassed edit-leave guard          | DropdownMenu.Item href invoked NavigationIntentProvider zero times                     | Existing NavigationLink guard connected to MenuItem onClick; canceled/allowed/modifier-click and SideNavigation expanded/compact regressions |
| Server pagination intercepted modified clicks | onNavigate adapter called preventDefault with modifiers                                | Ctrl/Command/Shift/Alt native-anchor and ordinary-click onNavigate regressions                                                               |

## Checks and remaining work

Final related run passed 10 files / 67 tests. Core type-contract checks and changed-file ESLint passed.
jsdom does not implement real cross-document navigation, producing warnings; tests check callbacks/cancellation/href, not successful new-tab/window navigation.

Later consumer-naming work passed 5 files / 20 tests covering MapThemeVariantTabs, PageBlockSettingsSurface, Core Tabs, DocumentEditorPanels and ThemeEditorCanvas. Six new naming regressions use actual Korean/English messages.
Four changed TS files passed ESLint, formatting and diff checks. Modal-path tests verify jsdom branches/DOM, not actual viewports or AT.

- Core tests: NavigationLink, SideNavigation, Tabs, DropdownMenu, Popover, MenuToggle and Display.
- Consumer tests: ServerDataTablePaginationView, DocumentEditorPanels and ThemeEditorCanvas.
- Coverage: Tabs automatic/manual/horizontal/vertical, disabled skipping, panel relations/state retention; menu arrows/Home/Escape/restoration; link guards; Pagination current/boundaries/numbers/modifiers and link-mode hrefs/disabled bounds/ellipses/server markup; Popover names/roles/dismissal.

| Remaining item                  | Owner                                                         | Required evidence                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Format-selection menu semantics | components/core/DropdownMenu and editor color/alignment menus | Decide command/current versus radio/checkbox selection, then verify keys/checked-state contract                                         |
| Compound submenu names          | components/core/DropdownMenu and Sub.Target consumers         | Names/typeahead, submenu entry/restoration, LTR/RTL                                                                                     |
| Mobile/tablet/desktop           | Relevant Core and actual Feature consumers                    | Light/Dark, Korean/long labels, wrapping/overflow, visible focus, portal overlap, touch, browser Back/modifier clicks                   |
| Actual assistive technology     | Relevant Core and actual Feature consumers                    | Names/current/expanded/selected, tab/panel movement, modal-background restriction and initial/restored focus. jsdom is not a substitute |

No UI/MCP was operated in this review. Screen/AT items remain pending. These results did not certify current code or a draft native library as Stable.
