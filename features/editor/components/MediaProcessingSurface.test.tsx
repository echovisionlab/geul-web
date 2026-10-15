import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MediaProcessingSurface } from './MediaProcessingSurface';

describe('MediaProcessingSurface', () => {
  it.each(['accent', 'warning'] as const)(
    'uses accessible accent progress for an active %s media lifecycle',
    (tone) => {
      const html = renderToStaticMarkup(
        <DesignSystemProvider forceColorScheme="light">
          <MediaProcessingSurface label="Processing" tone={tone} progress={42} pending />
        </DesignSystemProvider>,
      );

      expect(html).toContain('role="group"');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-label="Processing"');
      expect(html).toContain('aria-valuemin="0"');
      expect(html).toContain('aria-valuemax="100"');
      expect(html).toContain('aria-valuenow="42"');
      expect(html).toContain('aria-valuetext="42%"');
      expect(html).toContain('data-tone="accent"');
    },
  );
});
