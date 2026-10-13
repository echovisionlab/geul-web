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
