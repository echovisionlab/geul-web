import { ToolbarLayout } from './ToolbarLayout';

<ToolbarLayout
  arrangement="actions-inline"
  leading="Library"
  search={null}
  actions={null}
  density="compact"
  inset="content"
/>;
// @ts-expect-error Toolbar arrangements belong to Core.
<ToolbarLayout arrangement="custom" />;
// @ts-expect-error Inline padding cannot be provided by consumers.
<ToolbarLayout style={{ padding: 30 }} />;
const unsafe = { className: 'local', style: { gap: 40 } };
// @ts-expect-error Variable spreads cannot replace toolbar geometry.
<ToolbarLayout {...unsafe} />;
