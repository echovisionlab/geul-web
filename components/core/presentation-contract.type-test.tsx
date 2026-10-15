import { SectionCard } from './Section';
import { Text } from './Typography';
import { LayoutStack } from './Layout';
import { Tooltip } from './Tooltip';

const foreignSpace = { children: 'Content', px: 37 };
// @ts-expect-error Surface props remain closed when spread through a variable.
export const surfaceSpacing = <SectionCard {...foreignSpace} />;
const foreignWeight = { children: 'Content', fw: 900 };
// @ts-expect-error Typography weight is selected through the finite semantic contract.
export const textWeight = <Text {...foreignWeight} />;
const foreignInk = { children: 'Content', c: '#ff0000' };
// @ts-expect-error Layout cannot own private control colors hidden in a variable.
export const layoutInk = <LayoutStack {...foreignInk} />;
const foreignFont = { label: 'Help', children: <button type="button">Help</button>, ff: 'Comic Sans' };
// @ts-expect-error Overlay typography cannot be replaced through a variable spread.
export const overlayFont = <Tooltip {...foreignFont} />;
const reservedState = { children: 'Content', 'data-core-selected': 'true' };
// @ts-expect-error Layout cannot forge a reserved implementation marker.
export const layoutMarker: import('./Layout').LayoutStackProps = reservedState;
