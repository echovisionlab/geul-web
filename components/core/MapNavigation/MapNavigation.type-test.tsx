import { MapNavigation } from './MapNavigation';
const props = {
  labels: { group: 'Map', zoomIn: 'Zoom in', zoomOut: 'Zoom out', resetNorth: 'North' },
  onZoomIn: () => {},
  onZoomOut: () => {},
  onResetNorth: () => {},
};
<MapNavigation {...props} position="bottom-left" />;
// @ts-expect-error geometry positions use the finite contract
<MapNavigation {...props} position="center" />;
// @ts-expect-error consumer cannot alter control skin
<MapNavigation {...props} style={{ background: 'blue' }} />;
