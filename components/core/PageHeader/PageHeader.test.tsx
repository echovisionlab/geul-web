import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('separates semantic heading level from the shared visual scale', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <PageHeader level={2} title="Profile" description="Shown to other members" />
      </MantineProvider>,
    );

    expect(html).toContain('<h2');
    expect(html).toContain('font-size:1.5rem');
    expect(html).toContain('Profile');
    expect(html).toContain('<p');
    expect(html).toContain('Shown to other members');
  });
});
