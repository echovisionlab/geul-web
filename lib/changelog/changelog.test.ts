import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../site-version';
import { parseChangelogMarkdown } from './changelog';

describe('parseChangelogMarkdown', () => {
  it('parses release sections, groups, bullets, and inline links', () => {
    const releases = parseChangelogMarkdown(`## [0.1.2](https://example.com/compare) (2026-04-09)

### Features

* add a [linked feature](https://example.com/feature)

### Bug Fixes

- fix plain text
`);

    expect(releases).toEqual([
      {
        version: '0.1.2',
        url: 'https://example.com/compare',
        date: '2026-04-09',
        groups: [
          {
            title: 'Features',
            items: [
              {
                rawText: 'add a [linked feature](https://example.com/feature)',
                parts: [
                  { type: 'text', text: 'add a ' },
                  {
                    type: 'link',
                    text: 'linked feature',
                    href: 'https://example.com/feature',
                  },
                ],
              },
            ],
          },
          {
            title: 'Bug Fixes',
            items: [
              {
                rawText: 'fix plain text',
                parts: [{ type: 'text', text: 'fix plain text' }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('parses unlinked release headings without inventing a URL', () => {
    const releases = parseChangelogMarkdown(`## 0.1.0 (2026-09-02)

### Features

* publish the initial application
`);

    expect(releases).toEqual([
      {
        version: '0.1.0',
        url: null,
        date: '2026-09-02',
        groups: [
          {
            title: 'Features',
            items: [
              {
                rawText: 'publish the initial application',
                parts: [{ type: 'text', text: 'publish the initial application' }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('keeps the larger section when the same version appears more than once', () => {
    const releases = parseChangelogMarkdown(`## [0.1.1](https://example.com/small) (2026-04-08)

### Bug Fixes

* one fix

## [0.1.2](https://example.com/latest) (2026-04-09)

### Features

* latest change

## [0.1.1](https://example.com/full) (2026-04-08)

### Features

* one feature

### Bug Fixes

* one fix
* another fix
`);

    expect(releases.map((release) => release.version)).toEqual(['0.1.1', '0.1.2']);
    expect(releases[0].url).toBe('https://example.com/full');
    expect(releases[0].groups.flatMap((group) => group.items)).toHaveLength(3);
  });

  it('keeps the checked-in changelog aligned with the release manifest', async () => {
    const [markdown, manifestSource] = await Promise.all([
      readFile(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8').catch(() => null),
      readFile(path.join(process.cwd(), '.release-please-manifest.json'), 'utf8'),
    ]);
    expect(markdown).not.toBeNull();

    const releases = parseChangelogMarkdown(markdown ?? '');
    const manifest = JSON.parse(manifestSource) as Record<string, string>;

    if (manifest['.']) {
      expect(releases[0]?.version).toBe(APP_VERSION);
      expect(manifest['.']).toBe(APP_VERSION);
      return;
    }

    expect(releases).toEqual([]);
  });
});
