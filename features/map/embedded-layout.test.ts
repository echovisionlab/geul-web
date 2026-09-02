import { describe, expect, it } from 'vitest';
import { resolveMapEmbeddedContainerStyle } from './embedded-layout';

describe('resolveMapEmbeddedContainerStyle', () => {
  it('centers narrower maps when block alignment is center', () => {
    expect(
      resolveMapEmbeddedContainerStyle({
        previewWidth: 60,
        blockAlignment: 'center',
        applyPreviewWidth: true,
        isMobileViewport: false,
      }),
    ).toMatchObject({
      width: '60%',
      marginLeft: 'auto',
      marginRight: 'auto',
    });
  });

  it('keeps full-width maps stretched on mobile', () => {
    expect(
      resolveMapEmbeddedContainerStyle({
        previewWidth: 60,
        blockAlignment: 'right',
        applyPreviewWidth: true,
        isMobileViewport: true,
      }),
    ).toMatchObject({
      width: '100%',
      maxWidth: '100%',
    });
  });
});
