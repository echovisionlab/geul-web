import { MenuToggle } from './MenuToggle';

<MenuToggle opened loading label="Navigation" onClick={() => {}} />;
// @ts-expect-error Pending uses the boolean Core control contract.
<MenuToggle opened loading="pending" label="Navigation" onClick={() => {}} />;
// @ts-expect-error Loading cannot replace the required accessible name.
<MenuToggle opened loading onClick={() => {}} />;
// @ts-expect-error Pending presentation stays in Core.
<MenuToggle opened loading label="Navigation" onClick={() => {}} style={{ width: 12 }} />;
