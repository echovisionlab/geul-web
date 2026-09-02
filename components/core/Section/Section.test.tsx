import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Button } from '../Button';
import { ContentCard, ContentCardSection } from './ContentCard';
import { SectionCard } from './SectionCard';
import { SectionHeader } from './SectionHeader';
import { StatCard } from './StatCard';

describe('Section primitives', () => {
  it('renders card content and card sections', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SectionCard>section body</SectionCard>
        <ContentCard>
          <ContentCardSection>content section</ContentCardSection>
        </ContentCard>
      </MantineProvider>,
    );

    expect(html).toContain('section body');
    expect(html).toContain('content section');
  });

  it('renders stat card label, value, and description', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <StatCard label="Subscribers" value="1,284" description="Last 30 days" tone="positive" />
      </MantineProvider>,
    );

    expect(html).toContain('Subscribers');
    expect(html).toContain('1,284');
    expect(html).toContain('Last 30 days');
  });

  it('lets header text and actions wrap instead of clipping narrow controls', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SectionHeader
          title="Personal access token"
          description="A long description"
          actions={<Button>Create</Button>}
        />
      </MantineProvider>,
    );

    expect(html).toContain('--group-wrap:wrap');
    expect(html).toContain('flex-shrink:0');
    expect(html).toContain('Create');
  });
});
