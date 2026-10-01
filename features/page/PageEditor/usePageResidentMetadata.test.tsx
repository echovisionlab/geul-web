// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BlockRoomBootstrap } from '@/lib/collab/block-room-bootstrap';
import { usePageResidentMetadata, type UsePageResidentMetadataInput } from './usePageResidentMetadata';

type PageBootstrap = Pick<BlockRoomBootstrap, 'documentRevision' | 'locale' | 'localeMetadata' | 'targetRevision'>;

type ResidentMetadata = ReturnType<typeof usePageResidentMetadata>;

let container: HTMLDivElement;
let root: Root;
let current: ResidentMetadata | null;

function Harness({ input }: { input: UsePageResidentMetadataInput }) {
  current = usePageResidentMetadata(input);
  return null;
}

function render(input: UsePageResidentMetadataInput): void {
  act(() => root.render(<Harness input={input} />));
}

function metadata(): ResidentMetadata {
  if (!current) {
    throw new Error('Page resident metadata is unavailable.');
  }
  return current;
}

function bootstrap(locale: string, title: string, summary: string): PageBootstrap {
  return {
    locale,
    localeMetadata: { locale, title, summary },
    documentRevision: `revision-${locale}`,
  };
}

function input(overrides: Partial<UsePageResidentMetadataInput> = {}): UsePageResidentMetadataInput {
  return {
    roomIdentity: null,
    sessionLocale: 'en',
    roomLocale: 'en',
    bootstrap: null,
    fallbackTitle: 'Initial title',
    fallbackSummary: 'Initial summary',
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  current = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Page resident metadata controller', () => {
  it('uses fallback until the initial asynchronous canonical bootstrap arrives', () => {
    const room = {};
    const initial = input({ roomIdentity: room });
    render(initial);
    expect(metadata()).toMatchObject({ title: 'Initial title', summary: 'Initial summary' });

    render({ ...initial, bootstrap: bootstrap('en', 'Canonical title', 'Canonical summary') });
    expect(metadata()).toMatchObject({ title: 'Canonical title', summary: 'Canonical summary' });
  });

  it('preserves an accepted local title when its own metadata ACK replaces the bootstrap', () => {
    const room = {};
    const initialBootstrap = bootstrap('en', 'Saved title', 'Saved summary');
    const initial = input({ roomIdentity: room, bootstrap: initialBootstrap });
    render(initial);

    act(() => metadata().setTitle('Title accepted by the server'));
    render({ ...initial, bootstrap: { ...initialBootstrap, documentRevision: 'revision-after-title-ack' } });

    expect(metadata().title).toBe('Title accepted by the server');
  });

  it('keeps a newer pending title through a layout ACK', () => {
    const room = {};
    const initialBootstrap = bootstrap('en', 'Canonical title', 'Canonical summary');
    const initial = input({ roomIdentity: room, bootstrap: initialBootstrap });
    render(initial);

    act(() => metadata().setTitle('Newer pending title'));
    render({
      ...initial,
      bootstrap: { ...initialBootstrap, documentRevision: 'revision-after-layout-ack' },
    });

    expect(metadata().title).toBe('Newer pending title');
  });

  it('keeps a newer local edit when an older request ACK arrives later', () => {
    const room = {};
    const initialBootstrap = bootstrap('en', 'Canonical title', 'Canonical summary');
    const initial = input({ roomIdentity: room, bootstrap: initialBootstrap });
    render(initial);

    act(() => metadata().setTitle('Earlier request value'));
    act(() => metadata().setTitle('Newer local value'));
    render({ ...initial, bootstrap: { ...initialBootstrap, documentRevision: 'older-ack-revision' } });

    expect(metadata().title).toBe('Newer local value');
  });

  it('preserves drafts during a transient disconnect, then restores metadata for a new room and locale', () => {
    const firstRoom = {};
    const initial = input({ roomIdentity: firstRoom, bootstrap: bootstrap('en', 'Room title', 'Room summary') });
    render(initial);
    act(() => metadata().setTitle('Local draft before reload'));

    render({ ...initial, roomIdentity: null, bootstrap: null });
    expect(metadata().title).toBe('Local draft before reload');

    const reloadedRoom = {};
    render({
      ...initial,
      roomIdentity: reloadedRoom,
      bootstrap: bootstrap('en', 'Reloaded title', 'Reloaded summary'),
    });
    expect(metadata()).toMatchObject({ title: 'Reloaded title', summary: 'Reloaded summary' });

    render({
      ...initial,
      roomIdentity: null,
      sessionLocale: 'ko',
      roomLocale: 'ko',
      bootstrap: null,
      fallbackTitle: '한국어 제목',
      fallbackSummary: '한국어 요약',
    });
    expect(metadata()).toMatchObject({ title: '한국어 제목', summary: '한국어 요약' });

    const koreanRoom = {};
    render({
      ...initial,
      roomIdentity: koreanRoom,
      sessionLocale: 'ko',
      roomLocale: 'ko',
      bootstrap: bootstrap('ko', 'Canonical 한국어 제목', 'Canonical 한국어 요약'),
      fallbackTitle: '한국어 제목',
      fallbackSummary: '한국어 요약',
    });
    expect(metadata()).toMatchObject({ title: 'Canonical 한국어 제목', summary: 'Canonical 한국어 요약' });
  });

  it('uses the matching locale fallback when bootstrap metadata is absent or belongs to another locale', () => {
    const room = {};
    render(
      input({
        roomIdentity: room,
        bootstrap: { locale: 'ko', localeMetadata: undefined, documentRevision: 'revision-ko' } as PageBootstrap,
      }),
    );
    expect(metadata()).toMatchObject({ title: 'Initial title', summary: 'Initial summary' });

    render(
      input({ roomIdentity: room, bootstrap: { locale: 'en', documentRevision: 'revision-en' } as PageBootstrap }),
    );
    expect(metadata()).toMatchObject({ title: 'Initial title', summary: 'Initial summary' });
  });

  it('applies updated initial metadata rows only after the locale session changes', () => {
    render(input({ roomLocale: null, fallbackTitle: 'English source title' }));
    act(() => metadata().setTitle('Local field state'));

    render(input({ roomLocale: null, fallbackTitle: 'Updated English row' }));
    expect(metadata().title).toBe('Local field state');

    render(
      input({
        sessionLocale: 'ko',
        roomLocale: null,
        fallbackTitle: '한국어 행 제목',
        fallbackSummary: '한국어 행 요약',
      }),
    );
    expect(metadata()).toMatchObject({ title: '한국어 행 제목', summary: '한국어 행 요약' });
  });
});
