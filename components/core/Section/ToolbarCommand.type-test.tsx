import { ToolbarCommand } from './ToolbarCommand';
<ToolbarCommand label="Edit" presentation="responsive" icon={<svg />} />;
// @ts-expect-error Responsive commands require an icon.
<ToolbarCommand label="Edit" presentation="responsive" />;
// @ts-expect-error Shared target size is owned by Core.
<ToolbarCommand label="Edit" size="xl" />;
// @ts-expect-error Callers cannot style shared commands.
<ToolbarCommand label="Edit" style={{ padding: 5 }} />;
// @ts-expect-error Presentation is a closed contract.
<ToolbarCommand label="Edit" presentation="custom" />;
<ToolbarCommand label="Bold" presentation="icon" icon={<svg />} pressed={false} />;
// @ts-expect-error A toggle's selected appearance is owned by Core.
<ToolbarCommand label="Bold" presentation="icon" icon={<svg />} pressed tone="accent" />;
// @ts-expect-error Toggle state uses pressed.
<ToolbarCommand label="Bold" aria-pressed />;

import { SectionHeader } from './SectionHeader';
<SectionHeader title="Translations" descriptionPlacement="below-row" />;
// @ts-expect-error Section header copy placement is closed.
<SectionHeader title="Translations" descriptionPlacement="custom" />;
