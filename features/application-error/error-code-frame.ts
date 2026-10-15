import type { CSSProperties } from 'react';

// Geometry shared by the particle error code and its on-demand loading placeholder, so the
// deferred particle chunk cannot shift the error page layout.
export const ERROR_CODE_FRAME_WIDTH = 480;
export const ERROR_CODE_FRAME_HEIGHT = 200;
export const errorCodeFrameStyle: CSSProperties = {
  width: `min(${ERROR_CODE_FRAME_WIDTH}px, 80vw)`,
  position: 'relative',
  aspectRatio: `${ERROR_CODE_FRAME_WIDTH} / ${ERROR_CODE_FRAME_HEIGHT}`,
};
