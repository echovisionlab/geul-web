import { IconFolder } from '@tabler/icons-react';
import { EmptyState } from './EmptyState';

<EmptyState title="No files" />;
<EmptyState
  title="No files"
  description="Upload one."
  icon={IconFolder}
  action={<button type="button" />}
  live
  inset="none"
/>;
// @ts-expect-error The empty statement is required.
<EmptyState description="Upload one." />;
// @ts-expect-error Core owns glyph geometry; pass the glyph component, not a sized element.
<EmptyState title="No files" icon={<IconFolder size={48} />} />;
// @ts-expect-error Insets are a closed Core choice.
<EmptyState title="No files" inset="xl" />;
// @ts-expect-error Visual overrides remain closed.
<EmptyState title="No files" style={{ opacity: 0.3 }} />;
// @ts-expect-error Spreads cannot reopen class overrides.
<EmptyState title="No files" {...{ className: 'empty' }} />;
