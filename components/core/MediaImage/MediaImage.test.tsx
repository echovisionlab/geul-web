// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { MediaImage } from './MediaImage';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe('MediaImage authored geometry and Core ownership', () => {
  it('uses fallback on load error and retries when the actual source changes', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const render = (src: string) =>
      act(() => root.render(<MediaImage src={src} alt="Cover" fallbackSrc="/fallback.png" width={72} height={72} />));
    render('/one.png');
    const image = host.querySelector('img')!;
    expect(image.style.width).toBe('72px');
    act(() => image.dispatchEvent(new Event('error')));
    expect(image.getAttribute('src')).toBe('/fallback.png');
    render('/two.png');
    expect(image.getAttribute('src')).toBe('/two.png');
    act(() => root.unmount());
  });
});
