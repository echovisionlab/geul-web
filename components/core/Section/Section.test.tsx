import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button';
import { SectionCard } from './SectionCard';
import { SectionHeader } from './SectionHeader';
import { StatCard } from './StatCard';

describe('Section primitives', () => {
  it('renders card content', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider>
        <SectionCard>section body</SectionCard>
      </DesignSystemProvider>,
    );

    expect(html).toContain('section body');
  });

  it('keeps ordinary groups borderless and requires an explicit boundary', () => {
    const html = renderToStaticMarkup(
      <>
        <SectionCard>ordinary section</SectionCard>
        <SectionCard withBorder>bounded workspace</SectionCard>
        <SectionCard border="inline-start">docked panel</SectionCard>
      </>,
    );
    expect(html).toContain('data-border="none"');
    expect(html).toContain('data-border="all"');
    expect(html).toContain('data-border="inline-start"');
  });

  it('renders stat card label, value, and description', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider>
        <StatCard label="Subscribers" value="1,284" description="Last 30 days" tone="positive" />
      </DesignSystemProvider>,
    );

    expect(html).toContain('Subscribers');
    expect(html).toContain('1,284');
    expect(html).toContain('Last 30 days');
  });

  it('lets header text and actions wrap instead of clipping narrow controls', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider>
        <SectionHeader
          title="Personal access token"
          description="A long description"
          actions={<Button>Create</Button>}
        />
      </DesignSystemProvider>,
    );

    expect(html).toContain('data-geul-layout-wrap="wrap"');
    expect(html).toContain('data-geul-layout-align="start"');
    expect(html).toContain('Create');
  });
});
