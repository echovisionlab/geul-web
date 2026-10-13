import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('separates semantic heading level from the shared visual scale', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider>
        <PageHeader level={2} title="Profile" description="Shown to other members" />
      </DesignSystemProvider>,
    );

    expect(html).toContain('<h2');
    expect(html).toContain('var(--geul-heading-h2)');
    expect(html).toContain('data-size="xs"');
    expect(html).toContain('data-weight="regular"');
    expect(html).toContain('Profile');
    expect(html).toContain('<p');
    expect(html).toContain('Shown to other members');
  });
});
