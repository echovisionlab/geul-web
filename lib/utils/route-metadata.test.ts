import { describe, expect, it } from 'vitest';
import { resolveAdminRouteMetadata, withNoIndex } from './route-metadata';

describe('resolveAdminRouteMetadata', () => {
  it('resolves the Site Admin file manager route', () => {
    expect(resolveAdminRouteMetadata('/admin/files', 'Geul')).toMatchObject({
      path: '/admin/files',
      title: 'Files',
      description: 'Files page in the admin panel for Geul.',
    });
  });
});

describe('withNoIndex', () => {
  it('prevents referrer leakage by default', () => {
    expect(withNoIndex({ title: 'Preview' })).toMatchObject({
      referrer: 'no-referrer',
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      },
    });
  });

  it('preserves an explicit caller referrer policy', () => {
    expect(withNoIndex({ referrer: 'same-origin' }).referrer).toBe('same-origin');
  });
});
