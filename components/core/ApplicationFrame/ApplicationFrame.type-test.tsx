import { ApplicationFrame } from './ApplicationFrame';
const actions = { label: 'Toggle navigation', onToggle() {} };
<ApplicationFrame kind="workspace" navigationMode="compact" navigationToggle={actions}>
  Content
</ApplicationFrame>;
<ApplicationFrame
  kind="site"
  header="Header"
  navigationOpened={false}
  onCloseNavigation={() => {}}
  navigationLabel="Navigation"
  closeLabel="Close"
  navigationId="site-menu"
>
  Content
</ApplicationFrame>;
// @ts-expect-error Closed application chrome prevents consumer skins through variable spreads.
<ApplicationFrame kind="workspace" navigationMode="expanded" {...{ style: { padding: 8 } }} />;
// @ts-expect-error Sidebar widths are selected by the shared mode, not arbitrary values.
<ApplicationFrame kind="workspace" navigationMode="expanded" navigationWidth={280} />;

import { SiteHeader } from './SiteHeader';
const headerSlots = { logo: 'Brand', navigationToggle: 'Menu', mobileActions: 'Account', desktopActions: 'Navigation' };
<SiteHeader {...headerSlots} />;
// @ts-expect-error Header alignment belongs to Core, including overrides hidden in spreads.
<SiteHeader {...headerSlots} {...{ style: { display: 'flex' } }} />;
// @ts-expect-error Header insets come from shared chrome tokens.
<SiteHeader {...headerSlots} px={12} />;
