import { IconCheck } from '@tabler/icons-react';
import { StatusIcon } from './StatusIcon';

<StatusIcon icon={IconCheck} tone="positive" />;
<StatusIcon icon={IconCheck} tone="neutral" size="lg" label="Yes" />;
// @ts-expect-error A status tone is required; color is never implicit.
<StatusIcon icon={IconCheck} />;
// @ts-expect-error Tones are the shared status roles.
<StatusIcon icon={IconCheck} tone="brand" />;
// @ts-expect-error Glyph dimensions belong to the Core size contract.
<StatusIcon icon={IconCheck} tone="positive" size={16} />;
// @ts-expect-error Raw colors cannot bypass the status role.
<StatusIcon icon={IconCheck} tone="positive" color="var(--geul-status-positive)" />;
// @ts-expect-error Pass the glyph component so Core can size it.
<StatusIcon icon={<IconCheck size={16} />} tone="positive" />;
