import type { CompactTiptapEditorProps } from './CompactTiptapEditor';
import type { Breakpoint } from '@/components/core/Layout/breakpoints';
const supported: Pick<CompactTiptapEditorProps, 'id' | 'readOnly'> = { id: 'description', readOnly: true };
// @ts-expect-error The shared adapter owns its frame.
const privateFrame: Pick<CompactTiptapEditorProps, 'className'> = { className: 'local-frame' };
// @ts-expect-error Shared visual props stay closed.
const inlineFrame: Pick<CompactTiptapEditorProps, 'style'> = { style: { minHeight: 180 } };
const supportedBreakpoint: Breakpoint = 'sm';
// @ts-expect-error Consumers choose a registered boundary.
const rawBreakpoint: Breakpoint = '768px';
void [supported, privateFrame, inlineFrame, supportedBreakpoint, rawBreakpoint];
