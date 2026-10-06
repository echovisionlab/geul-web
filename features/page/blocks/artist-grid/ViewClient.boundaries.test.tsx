import { PassThrough } from 'node:stream';
import type { ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { ArtistListViewClient } from './ViewClient';
import { parseArtistListProps } from './schema';
import { AuthorListViewClient } from '../author-list/ViewClient';
import { parseAuthorListProps } from '../author-list/schema';
import { LabelListViewClient } from '../label-list/ViewClient';
import { parseLabelListProps } from '../label-list/schema';
import { PostListViewClient } from '../post-list/ViewClient';
import { parsePostListProps } from '../post-list/schema';
import { WorkListViewClient } from '../works-gallery/ViewClient';
import { parseWorkListProps } from '../works-gallery/schema';
import { ReleaseListViewClient } from '../releases-gallery/ViewClient';
import { parseReleaseListProps } from '../releases-gallery/schema';
import { ProgramEventListViewClient } from '../program-event-list/ViewClient';
import { parseProgramEventListProps } from '../program-event-list/schema';

const probes = vi.hoisted(() => ({ loads: 0, options: [] as Array<{ ssr?: boolean } | undefined> }));

// Use the App Router implementation that Next compiles next/dynamic to. Keep
// every runtime leaf real so this verifies its server HTML across the boundary.
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return {
    default: (loader: Parameters<typeof dynamic>[0], options?: Parameters<typeof dynamic>[1]) => {
      probes.options.push(options);
      if (typeof loader !== 'function') {
        throw new Error('Expected a dynamic import loader');
      }
      return dynamic(() => {
        probes.loads += 1;
        return loader();
      }, options);
    },
  };
});

function renderServer(node: ReactNode) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => {
      html += chunk.toString();
    });
    output.on('end', () => resolve(html));
    output.on('error', reject);
    const stream = renderToPipeableStream(
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
      {
        onAllReady() {
          stream.pipe(output);
        },
        onError: reject,
      },
    );
  });
}

const item = { id: 'item-1', href: '/items/item-1', title: 'Visible title', imageUrl: null };
const listProps = { layout: 'list', showImage: 'false', showMeta: 'true' };

describe('optional list runtime boundaries', () => {
  it('defers all seven real leaves and retains links and metadata in streamed server HTML', async () => {
    expect(probes.loads).toBe(0);
    expect(probes.options).toHaveLength(7);
    expect(probes.options.every((options) => options?.ssr !== false)).toBe(true);
    const cases: Array<{ node: ReactNode; href: string; copy: string[] }> = [
      {
        node: (
          <ArtistListViewClient
            artists={[{ ...item, socialLinks: null }]}
            parsedProps={parseArtistListProps(listProps)}
          />
        ),
        href: item.href,
        copy: [item.title],
      },
      {
        node: (
          <AuthorListViewClient
            authors={[{ id: 'author-1', name: 'Writer', image: null, bio: 'Writer biography', post_count: 3 }]}
            parsedProps={parseAuthorListProps({
              layout: 'list',
              showAvatar: 'false',
              showBio: 'true',
              showPostCount: 'true',
            })}
          />
        ),
        href: '/user/author-1',
        copy: ['Writer', 'Writer biography'],
      },
      {
        node: (
          <LabelListViewClient labels={[{ ...item, countryCode: 'KR' }]} parsedProps={parseLabelListProps(listProps)} />
        ),
        href: item.href,
        copy: [item.title, 'South Korea'],
      },
      {
        node: (
          <PostListViewClient
            posts={[
              {
                id: 'post-1',
                slug: 'public-post',
                title: 'Public post',
                featured_image_url: null,
                published_at: null,
                authors: [{ id: 'writer-1', name: 'Post writer', image: null }],
                categories: [],
                tags: [],
              },
            ]}
            parsedProps={parsePostListProps({ layout: 'list', showFeaturedImage: 'false', showMeta: 'true' })}
          />
        ),
        href: '/posts/public-post',
        copy: ['Public post', 'Post writer'],
      },
      {
        node: (
          <WorkListViewClient
            works={[{ ...item, type: 'article', publishedAt: null }]}
            parsedProps={parseWorkListProps(listProps)}
          />
        ),
        href: item.href,
        copy: [item.title, enMessages.works.types.article],
      },
      {
        node: (
          <ReleaseListViewClient
            releases={[
              {
                ...item,
                releaseDate: null,
                mainArtists: [{ id: 'artist-1', label: 'Release artist', href: '/artists/artist-1' }],
              },
            ]}
            parsedProps={parseReleaseListProps(listProps)}
          />
        ),
        href: item.href,
        copy: [item.title, 'Release artist', 'TBA'],
      },
      {
        node: (
          <ProgramEventListViewClient
            events={[
              {
                ...item,
                typeName: 'Concert',
                startsAt: null,
                endsAt: null,
                timezone: null,
                allDay: false,
                locationMode: 'online',
              },
            ]}
            parsedProps={parseProgramEventListProps(listProps)}
            locale="en"
          />
        ),
        href: item.href,
        copy: [item.title, 'Concert'],
      },
    ];
    for (const [index, entry] of cases.entries()) {
      const html = await renderServer(entry.node);
      expect(html).toContain(`href="${entry.href}"`);
      for (const copy of entry.copy) {
        expect(html).toContain(copy);
      }
      expect(probes.loads).toBe(index + 1);
    }
  }, 15_000);
});
