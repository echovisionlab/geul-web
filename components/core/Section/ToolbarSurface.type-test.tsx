import { ToolbarSurface } from './ToolbarSurface';
import { HeaderDensityProvider } from '../control-context';

<ToolbarSurface label="Commands" appearance="inline" density="comfortable" />;
<HeaderDensityProvider density="compact">Header slots</HeaderDensityProvider>;
// @ts-expect-error Toolbar placement is a closed semantic contract.
<ToolbarSurface label="Commands" appearance="custom" />;
// @ts-expect-error Caller CSS cannot change shared toolbar geometry.
<ToolbarSurface label="Commands" style={{ padding: 19 }} />;
// @ts-expect-error Header density does not accept arbitrary breakpoints or sizes.
<HeaderDensityProvider density="tiny">Header slots</HeaderDensityProvider>;
