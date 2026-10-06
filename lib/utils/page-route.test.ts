import { describe, expect, it } from 'vitest';
import { buildPageEditPath, buildPagePath, getPageSlugValidationReason } from './page-route';

describe('Page route builders', () => {
  it('preserves nested separators while encoding each segment', () => {
    expect(buildPagePath('some/한글 page')).toBe('/some/%ED%95%9C%EA%B8%80%20page');
    expect(buildPageEditPath('some/where')).toBe('/some/where?edit=true');
  });

  it('keeps the nested Page path and existing query when navigating after a slug save', () => {
    expect(buildPageEditPath('some/where', '?lang=ko&edit=false')).toBe('/some/where?lang=ko&edit=true');
  });

  it('classifies malformed, reserved, and safe nested Page paths', () => {
    expect(getPageSlugValidationReason('/about')).toBe('emptySegment');
    expect(getPageSlugValidationReason('about/')).toBe('emptySegment');
    expect(getPageSlugValidationReason('about//team')).toBe('emptySegment');
    expect(getPageSlugValidationReason('about/../team')).toBe('dotSegment');
    expect(getPageSlugValidationReason('admin/team')).toBe('reservedRoute');
    expect(getPageSlugValidationReason('tools')).toBeUndefined();
    expect(getPageSlugValidationReason('tools/transcode')).toBeUndefined();
    expect(getPageSlugValidationReason('events/example')).toBeUndefined();
    expect(getPageSlugValidationReason('some/where')).toBeUndefined();
    expect(getPageSlugValidationReason('events')).toBeUndefined();
  });

  it('allows CMS tool pages while preserving the p5 runner route', () => {
    for (const slug of [
      'tools',
      'TOOLS',
      'tools/transcode',
      'tools/youtube-audio',
      'tools/hwp',
      'tools/portadj',
      'tools/future-tool/details',
      'tools/p5-runner-extra',
    ]) {
      expect(getPageSlugValidationReason(slug), slug).toBeUndefined();
    }
    for (const slug of ['tools/p5-runner', 'TOOLS/P5-RUNNER', 'tools/p5-runner/child']) {
      expect(getPageSlugValidationReason(slug), slug).toBe('reservedRoute');
    }
  });

  it('matches the complete fixed and resource-child route inventory', () => {
    const fixedRoutes = [
      '_next',
      'account',
      'admin',
      'api',
      'auth',
      'category',
      'changelog',
      'favicon.ico',
      'files',
      'login',
      'manifest.webmanifest',
      'my',
      'onboarding',
      'privacy',
      'robots.txt',
      's',
      'sitemap',
      'sitemap.xml',
      'sitemaps',
      'subscribe',
      'tag',
      'terms',
      'unsubscribe',
      'user',
      'verification',
      'verify',
    ];
    const resourceChildRoutes = [
      'artists',
      'campaigns',
      'event-series',
      'events',
      'forms',
      'labels',
      'posts',
      'releases',
      'series',
      'works',
    ];

    for (const route of fixedRoutes) {
      expect(getPageSlugValidationReason(route), route).toBe('reservedRoute');
      expect(getPageSlugValidationReason(`${route}/child`), route).toBe('reservedRoute');
    }
    for (const route of resourceChildRoutes) {
      expect(getPageSlugValidationReason(route), route).toBeUndefined();
      expect(getPageSlugValidationReason(`${route}/child`), route).toBeUndefined();
      expect(getPageSlugValidationReason(`${route}/child/more`), route).toBeUndefined();
    }
  });
});
