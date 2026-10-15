import { ResizeHandle, type ResizeHandleProps } from './ResizeHandle';

const state = { direction: 'left' as const, value: 64, min: 10, max: 100, ariaLabel: 'Resize' };
<ResizeHandle {...state} placement="media-edge" visibility="on-interaction" onKeyDown={() => {}} />;
// @ts-expect-error Adapter geometry uses the named placement contract.
<ResizeHandle {...state} className="skin" />;
// @ts-expect-error Spreads cannot reopen control styling.
<ResizeHandle {...state} {...{ style: { opacity: 0 } }} />;
// @ts-expect-error Unsupported visibility must be resolved in the shared owner.
<ResizeHandle {...state} visibility="never" />;
// @ts-expect-error Private Core state cannot be injected through caller data attributes.
const reserved: ResizeHandleProps = { ...state, 'data-geul-resize-visibility': 'always' };
void reserved;
