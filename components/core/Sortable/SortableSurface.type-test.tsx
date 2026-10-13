import { SortableSurface, type SortableSurfaceProps } from './SortableSurface';
declare const motion: SortableSurfaceProps['motion'];
<SortableSurface motion={motion}>Domain content</SortableSurface>;
// @ts-expect-error A sensor consumer cannot override the Core drag surface.
<SortableSurface motion={motion} style={{ padding: 4 }} />;
// @ts-expect-error Core state markers are private.
<SortableSurface motion={motion} data-sortable-item />;
// @ts-expect-error Sensor state cannot be replaced by a caller-owned marker.
<SortableSurface motion={motion} data-dragging />;
