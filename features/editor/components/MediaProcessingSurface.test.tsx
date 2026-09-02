import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { MediaProcessingSurface } from './MediaProcessingSurface';

describe('MediaProcessingSurface', () => {
  it('uses the Core progress contract for accessible determinate media progress', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MediaProcessingSurface label="Processing" color="cyan" progress={42} pending />
      </MantineProvider>,
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Processing"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuetext="42%"');
    expect(html).toContain('data-tone="accent"');
  });
});
