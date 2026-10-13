// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { UrlSection, type UrlEntityType } from './UrlSection';

describe('editor public links', () => {
  it.each<[UrlEntityType, string]>([
    ['post', '/posts/'],
    ['work', '/works/'],
    ['artist', '/artists/'],
    ['label', '/labels/'],
    ['release', '/releases/'],
    ['form', '/forms/'],
    ['program_event', '/events/'],
    ['program_event_series', '/event-series/'],
    ['page', '/'],
  ])('uses the served public route for %s, for both slug and ID links', (entityType, path) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      act(() =>
        root.render(
          <TestProviders>
            <UrlSection
              baseUrl="https://studio.example.com/"
              entityType={entityType}
              entityId="entity-id"
              slug="example"
              onChange={() => {}}
            />
          </TestProviders>,
        ),
      );
      expect(Array.from(host.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual([
        `https://studio.example.com${path}example`,
        `https://studio.example.com${path}entity-id`,
      ]);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
