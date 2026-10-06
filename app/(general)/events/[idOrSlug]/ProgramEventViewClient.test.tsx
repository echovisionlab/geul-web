// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { create } from '@bufbuild/protobuf';
import { MantineProvider } from '@mantine/core';
import {
  FileBlockLocaleSchema,
  FileBlockSchema,
  ParagraphBlockLocaleSchema,
  ParagraphBlockSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import type { GeneratedRichTextBlockViewProps } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView.types';
import type { LocationPlaceSummary } from '@/lib/utils/location-place';
import { ProgramEventViewClient } from './ProgramEventViewClient';

const mocks = vi.hoisted(() => ({ renderBlock: vi.fn(), renderPlace: vi.fn() }));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('@/components/core/Navigation', () => ({
  default: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/share/ShareButton', () => ({ ShareButton: () => null }));
vi.mock('@/features/navigation/TableOfContents', () => ({ TableOfContents: () => null }));
vi.mock('@/features/location/LocationPlaceMetadataRows', () => ({
  LocationPlaceMetadataRows: (props: { place: LocationPlaceSummary }) => {
    mocks.renderPlace(props);
    return <span>{props.place.name}</span>;
  },
}));
vi.mock('@/features/page/PageView/blocks/GeneratedRichTextBlockView', () => ({
  GeneratedRichTextBlockView: (props: GeneratedRichTextBlockViewProps) => {
    mocks.renderBlock(props);
    return <p>{props.block.kind === 'file' ? props.block.base.props?.name : 'Event body'}</p>;
  },
}));

type Event = ComponentProps<typeof ProgramEventViewClient>['event'];

function renderEvent(content: Event['content'], overrides: Partial<Event> = {}) {
  const event: Event = {
    id: 'event-id',
    slug: 'event-slug',
    title: 'Event title',
    summary: 'Event summary',
    content,
    blockMedia: [],
    type: null,
    series: null,
    startsAt: null,
    endsAt: null,
    timezone: 'Asia/Seoul',
    allDay: false,
    locationMode: 'tba',
    locationPlace: null,
    posterUrl: null,
    ticketUrl: null,
    streamUrl: null,
    externalUrl: null,
    artists: [],
    labels: [],
    clients: [],
    credits: [],
    publishedAt: null,
    updatedAt: null,
    ...overrides,
  };

  return renderToStaticMarkup(
    <MantineProvider>
      <ProgramEventViewClient
        event={event}
        shareUrl="https://www.dsub.io/events/event-slug"
        locale="en"
        pathname="/events/event-slug"
        requestedLocale="en"
      />
    </MantineProvider>,
  );
}

describe('ProgramEventViewClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the body with one metadata divider and no summary', () => {
    const block = {
      id: 'paragraph-block',
      kind: 'paragraph',
      base: create(ParagraphBlockSchema),
      locale: create(ParagraphBlockLocaleSchema),
      children: [],
    } satisfies LocalizedRichTextBlock;

    const html = renderEvent([block]);

    expect(html).toContain('Event body');
    expect(html).not.toContain('Event summary');
    expect(html.match(/role="separator"/g)).toHaveLength(1);
  });

  it.each([null, []])('does not show the summary when the body is %j', (content) => {
    const html = renderEvent(content);

    expect(html).toContain('Event title');
    expect(html).not.toContain('Event summary');
    expect(html).not.toContain('role="separator"');
    expect(mocks.renderBlock).not.toHaveBeenCalled();
  });

  it('keeps a file-only body and its event download owner', () => {
    const block = {
      id: 'file-block',
      kind: 'file',
      base: create(FileBlockSchema, {
        props: {
          attachment: { state: { case: 'activeFileId', value: 'file-id' } },
          name: 'First Play.pdf',
        },
      }),
      locale: create(FileBlockLocaleSchema),
      children: [],
    } satisfies LocalizedRichTextBlock;

    const html = renderEvent([block]);

    expect(html).toContain('First Play.pdf');
    expect(html).not.toContain('Event summary');
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(mocks.renderBlock).toHaveBeenCalledWith({
      block,
      requestedLocale: 'en',
      downloadOwner: { entityType: PublicMediaEntityType.PROGRAM_EVENT, entityId: 'event-id' },
    });
  });

  it.each(['map_place', 'online', 'hybrid', 'tba'] as const)('omits the %s location type', (locationMode) => {
    const html = renderEvent(null, { locationMode });

    expect(html).not.toContain('locationModes.');
    expect(html).not.toContain('>location<');
    expect(mocks.renderPlace).not.toHaveBeenCalled();
  });

  it('keeps the actual place metadata', () => {
    const place = { name: 'Gangdong University', lat: 37.0, lng: 127.0 };

    const html = renderEvent(null, { locationMode: 'map_place', locationPlace: place });

    expect(html).toContain('Gangdong University');
    expect(html).not.toContain('locationModes.');
    expect(mocks.renderPlace).toHaveBeenCalledWith({ place, textSize: 'sm', coordinateVisibility: 'desktop' });
  });
});

type Credit = Event['credits'][number];

function renderCredits(credits: Credit[], posterUrl: string | null = null) {
  const container = document.createElement('div');
  container.innerHTML = renderEvent(null, { credits, posterUrl });
  return container;
}

function credit(overrides: Partial<Credit>): Credit {
  return { id: 'credit', name: null, creditRole: null, description: null, artist: null, member: null, ...overrides };
}

describe('ProgramEventViewClient credits', () => {
  it.each([null, 'https://example.com/poster.jpg'])(
    'renders ordered Work credit items with profile avatars, roles, and notes (poster %s)',
    (posterUrl) => {
      const container = renderCredits(
        [
          credit({
            id: 'member',
            name: 'Display name',
            creditRole: 'Sound',
            description: 'Recorded on location',
            member: { id: 'member-1', name: 'Member name', image: 'https://example.com/member.jpg' },
          }),
          credit({
            id: 'artist',
            creditRole: 'Performer',
            description: 'Live set',
            artist: {
              id: 'artist-1',
              name: 'Artist name',
              slug: 'artist-slug',
              imageUrl: 'https://example.com/artist.jpg',
            },
            member: { id: 'other-member', name: 'Other member', image: 'https://example.com/other.jpg' },
          }),
          credit({ id: 'plain', name: 'Guest', description: 'Guest contribution' }),
        ],
        posterUrl,
      );
      const list = container.querySelector('[role="list"][aria-label="public.credits"]')!;
      const items = Array.from(list.querySelectorAll('[role="listitem"]'));
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('Display name — Sound');
      expect(items[0]).toHaveTextContent('Recorded on location');
      expect(items[0].querySelector('a')).toHaveAttribute('href', '/user/member-1');
      expect(items[0].querySelector('img')).toHaveAttribute('src', 'https://example.com/member.jpg');
      expect(items[0].querySelector('img')).toHaveAttribute('alt', 'Display name');
      expect(items[1]).toHaveTextContent('Artist name — Performer');
      expect(items[1]).toHaveTextContent('Live set');
      expect(items[1].querySelector('a')).toHaveAttribute('href', '/artists/artist-slug');
      expect(items[1].querySelector('img')).toHaveAttribute('src', 'https://example.com/artist.jpg');
      expect(items[2]).toHaveTextContent('Guest');
      expect(items[2]).toHaveTextContent('Guest contribution');
      expect(items[2].querySelector('a')).toBeNull();
      expect(items[2].querySelector('img')).toBeNull();
      // Work's initial avatar is used for entries without an image.
      expect(items[2].firstElementChild).toHaveTextContent('G');
      expect(container.textContent?.match(/public\.credits/g)).toHaveLength(1);
    },
  );

  it('falls back to member or unknown names and artist ids without changing link precedence', () => {
    const container = renderCredits([
      credit({ id: 'member', name: '', member: { id: 'member-1', name: 'Member name', image: null } }),
      credit({ id: 'unknown' }),
      credit({
        id: 'artist',
        artist: { id: 'artist-1', name: 'Artist name', slug: null, imageUrl: null },
        member: { id: 'member-2', name: 'Member 2', image: 'https://example.com/member.jpg' },
      }),
    ]);
    const items = container.querySelectorAll('[role="listitem"]');
    expect(items[0]).toHaveTextContent('Member name');
    expect(items[1]).toHaveTextContent('unknown');
    expect(items[1].querySelector('a')).toBeNull();
    expect(items[2].querySelector('a')).toHaveAttribute('href', '/artists/artist-1');
    expect(items[2].querySelector('img')).toHaveAttribute('src', 'https://example.com/member.jpg');
  });

  it('hides the Credits label and list when no credits exist', () => {
    const container = renderCredits([]);
    expect(container.textContent).not.toContain('public.credits');
    expect(container.querySelector('[role="list"]')).toBeNull();
  });
});
