import { DropdownMenu } from './DropdownMenu/DropdownMenu';
import { Popover } from './Popover/Popover';
import { Tooltip } from './Tooltip/Tooltip';
import { ContentModal } from './Modal/ContentModal';
import { Drawer } from './Drawer/Drawer';
import { Disclosure } from './Disclosure/Disclosure';
import { MenuToggle } from './MenuToggle/MenuToggle';

const close = () => {};
// @ts-expect-error Feature styling cannot replace the Core menu surface.
const menuStyle = <DropdownMenu.Dropdown style={{ padding: 1 }}>Content</DropdownMenu.Dropdown>;
// @ts-expect-error Feature CSS classes cannot replace Core item states.
const itemClass = <DropdownMenu.Item className="local">Item</DropdownMenu.Item>;
// @ts-expect-error Popover presentation uses closed padding/size options.
const popupClass = <Popover.Dropdown className="local">Content</Popover.Dropdown>;
// prettier-ignore
// @ts-expect-error Tooltip width is a finite shared size contract.
const tooltipWidth = <Tooltip label="Help" w={280}><button type="button">Help</button></Tooltip>;
// prettier-ignore
// @ts-expect-error ContentModal cannot use framework sizes.
const modalWidth = <ContentModal opened onClose={close} title="Title" closeLabel="Close" size="lg">Content</ContentModal>;
// prettier-ignore
// @ts-expect-error Drawer body cannot be overridden.
const drawerStyle = <Drawer opened onClose={close} title="Title" closeLabel="Close" styles={{ body: { padding: 1 } }}>Content</Drawer>;
// prettier-ignore
// @ts-expect-error Disclosure cannot be overridden.
const disclosureClass = <Disclosure label="Section" className="local">Content</Disclosure>;
// @ts-expect-error MenuToggle delegates visual states to shared Core controls.
const toggleClass = <MenuToggle opened label="Close" onClick={close} className="local" />;
void [menuStyle, itemClass, popupClass, tooltipWidth, modalWidth, drawerStyle, disclosureClass, toggleClass];

const compactContent = (
  <ContentModal opened onClose={close} title="Title" closeLabel="Close" size="compact" density="compact">
    Content
  </ContentModal>
);
const densityEscape = (
  // @ts-expect-error Modal density is a finite Core contract.
  <ContentModal opened onClose={close} title="Title" closeLabel="Close" density="tight">
    Content
  </ContentModal>
);
void [compactContent, densityEscape];

const fittedContent = (
  <ContentModal opened onClose={close} title="Title" closeLabel="Close" bodyLayout="fit">
    Content
  </ContentModal>
);
const bodyLayoutEscape = (
  // @ts-expect-error Modal body layout is a finite Core contract.
  <ContentModal opened onClose={close} title="Title" closeLabel="Close" bodyLayout="hidden">
    Content
  </ContentModal>
);
void [fittedContent, bodyLayoutEscape];

const compactDrawer = { opened: true, onClose: () => {}, title: 'History', closeLabel: 'Close history' };
<Drawer {...compactDrawer} density="compact" />;
<Drawer {...compactDrawer} density="standard" />;
// @ts-expect-error Drawer density follows the shared closed dialog contract.
<Drawer {...compactDrawer} density="dense" />;
