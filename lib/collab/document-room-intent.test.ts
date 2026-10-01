import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import {
  hydrateEmailLayoutCanonicalRoom,
  EMAIL_LAYOUT_HTML_TEXT_NAME,
  EMAIL_LAYOUT_LOCALE_VALUES_MAP_NAME,
  type EmailLayoutUnit,
} from '@echovisionlab/geul-common/collaboration/email-layout';
import {
  materializeMenuCanonicalItems,
  hydrateMenuCanonicalRoom,
  MENU_ITEMS_MAP_NAME,
  MENU_SOURCE_LABELS_MAP_NAME,
  replaceMenuCanonicalSource,
  setMenuLocaleLabel,
  unsetMenuLocaleLabel,
  type MenuCollaborationItem,
} from '@echovisionlab/geul-common/collaboration/menu';
import {
  hydratePostSeriesCanonicalRoom,
  setPostSeriesLocaleField,
  unsetPostSeriesLocaleField,
} from '@echovisionlab/geul-common/collaboration/post-series';
import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import {
  captureDocumentRoomSnapshot,
  DocumentRoomIntentError,
  replayDocumentRoomChanges,
} from './document-room-intent';
import { DOCUMENT_ROOM_SNAPSHOT_KEYS, DOCUMENT_ROOM_SNAPSHOT_MAP_NAME } from './document-room-snapshot';

const ENTITY_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_REVISION = '22222222-2222-4222-8222-222222222222';
const TARGET_REVISION = '33333333-3333-4333-8333-333333333333';
const ORIGIN = Symbol('test-replay-origin');

function projectObservedSnapshot(document: Y.Doc, documentName: string, sourceLocale: string, locale: string) {
  const snapshot = document.getMap<string | boolean>(DOCUMENT_ROOM_SNAPSHOT_MAP_NAME);
  snapshot.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentName, documentName);
  snapshot.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.documentRevision, DOCUMENT_REVISION);
  snapshot.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.sourceLocale, sourceLocale);
  snapshot.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.locale, locale);
  snapshot.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.localeExists, true);
  if (locale !== sourceLocale) {
    snapshot.set(DOCUMENT_ROOM_SNAPSHOT_KEYS.targetRevision, TARGET_REVISION);
  }
  return document;
}

function menuRoom(
  locale: string,
  items: MenuCollaborationItem[],
  requestedLabels: Record<string, string>,
  name = 'Main menu',
): { document: Y.Doc; documentName: string } {
  const documentName = createDocumentName(CollaborativeDocumentType.MENU, ENTITY_ID, locale);
  const document = hydrateMenuCanonicalRoom({
    sourceLocale: 'en',
    locale,
    localeExists: true,
    name,
    items,
    sourceLabels: Object.fromEntries(items.map((item) => [item.id, item.label ?? item.id])),
    requestedLabels,
  });
  return { document: projectObservedSnapshot(document, documentName, 'en', locale), documentName };
}

function postSeriesRoom(
  locale: string,
  requested: { title?: string; summary?: string },
): {
  document: Y.Doc;
  documentName: string;
} {
  const documentName = createDocumentName(CollaborativeDocumentType.POST_SERIES, ENTITY_ID, locale);
  const document = hydratePostSeriesCanonicalRoom({
    sourceLocale: 'en',
    locale,
    localeExists: true,
    source: { title: 'source title', summary: 'source summary' },
    requested,
  });
  return { document: projectObservedSnapshot(document, documentName, 'en', locale), documentName };
}

function emailRoom(
  locale: string,
  contentHtml: string,
  units: EmailLayoutUnit[] = [],
  localeValues: Record<string, string> = {},
): { document: Y.Doc; documentName: string } {
  const documentName = createDocumentName(CollaborativeDocumentType.EMAIL_LAYOUT, ENTITY_ID, locale);
  const document = hydrateEmailLayoutCanonicalRoom({
    sourceLocale: 'en',
    locale,
    localeExists: true,
    contentHtml,
    units,
    localeValues,
  });
  return { document: projectObservedSnapshot(document, documentName, 'en', locale), documentName };
}

const menuItems = (...ids: string[]): MenuCollaborationItem[] =>
  ids.map((id) => ({ id, label: `${id} source`, linkType: 'external', url: `https://${id}.example` }));

const emailUnits = (...handles: string[]): EmailLayoutUnit[] =>
  handles.map((handle, order) => ({
    handle,
    kind: 'text',
    element: 'p',
    attribute: '',
    order,
    sourceValue: `${handle} source`,
  }));

describe('document room semantic intent replay', () => {
  it('replays only edited Post Series leaves over newer peer values', () => {
    const baseline = postSeriesRoom('ko', { title: 'old title', summary: 'old summary' });
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    expect(before?.documentType).toBe('post_series');
    if (!before || before.documentType !== 'post_series') {
      throw new Error('expected Post Series snapshot');
    }

    setPostSeriesLocaleField(baseline.document, 'title', 'local title');
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'post_series') {
      throw new Error('expected Post Series snapshot');
    }

    const current = postSeriesRoom('ko', { title: 'peer title', summary: 'peer summary' });
    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    const result = captureDocumentRoomSnapshot(current.documentName, current.document);
    expect(result).toMatchObject({
      documentType: 'post_series',
      fields: { title: 'local title', summary: 'peer summary' },
    });
  });

  it('replays Post Series field removal as a presence change', () => {
    const baseline = postSeriesRoom('ko', { title: 'old title' });
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'post_series') {
      throw new Error('expected Post Series snapshot');
    }

    unsetPostSeriesLocaleField(baseline.document, 'title');
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'post_series') {
      throw new Error('expected Post Series snapshot');
    }

    const current = postSeriesRoom('ko', { title: 'peer title', summary: 'peer summary' });
    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    const result = captureDocumentRoomSnapshot(current.documentName, current.document);
    expect(result).toMatchObject({ documentType: 'post_series', fields: { summary: 'peer summary' } });
    expect(result?.documentType === 'post_series' && Object.hasOwn(result.fields, 'title')).toBe(false);
  });

  it('replays Menu target add/update/remove presence without reviving deleted or overwriting untouched labels', () => {
    const baseline = menuRoom('ko', menuItems('a', 'b', 'c', 'd'), { a: 'old a', b: 'old b' });
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'menu') {
      throw new Error('expected Menu snapshot');
    }

    setMenuLocaleLabel(baseline.document, 'a', 'local a');
    unsetMenuLocaleLabel(baseline.document, 'b');
    setMenuLocaleLabel(baseline.document, 'c', 'local c');
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'menu') {
      throw new Error('expected Menu snapshot');
    }

    const current = menuRoom('ko', menuItems('a', 'b', 'd'), {
      a: 'peer a',
      b: 'peer b',
      d: 'peer d',
    });
    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    const result = captureDocumentRoomSnapshot(current.documentName, current.document);
    expect(result).toMatchObject({
      documentType: 'menu',
      requestedLabels: { a: 'local a', d: 'peer d' },
    });
    expect(result?.documentType === 'menu' && Object.hasOwn(result.requestedLabels, 'b')).toBe(false);
    expect(result?.documentType === 'menu' && Object.hasOwn(result.requestedLabels, 'c')).toBe(false);
    expect(current.document.getMap<string>(MENU_ITEMS_MAP_NAME).has('c')).toBe(false);
  });

  it('replays source HTML as a last-intent single field', () => {
    const baseline = emailRoom('en', '<p>old</p>');
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'email_layout' || before.role !== 'source') {
      throw new Error('expected Email Layout source snapshot');
    }

    baseline.document
      .getText(EMAIL_LAYOUT_HTML_TEXT_NAME)
      .delete(0, baseline.document.getText(EMAIL_LAYOUT_HTML_TEXT_NAME).length);
    baseline.document.getText(EMAIL_LAYOUT_HTML_TEXT_NAME).insert(0, '<p>local</p>');
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'email_layout' || after.role !== 'source') {
      throw new Error('expected Email Layout source snapshot');
    }

    const current = emailRoom('en', '<p>peer</p>');
    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    expect(current.document.getText(EMAIL_LAYOUT_HTML_TEXT_NAME).toString()).toBe('<p>local</p>');
  });

  it('replays only changed Email Layout target handles present in the current unit catalog', () => {
    const baseline = emailRoom('ko', '', emailUnits('a', 'b', 'c'), { a: 'old a', b: 'old b' });
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'email_layout' || before.role !== 'target') {
      throw new Error('expected Email Layout target snapshot');
    }

    const baselineValues = baseline.document.getMap<string>(EMAIL_LAYOUT_LOCALE_VALUES_MAP_NAME);
    baselineValues.set('a', 'local a');
    baselineValues.delete('b');
    baselineValues.set('c', 'local c');
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'email_layout' || after.role !== 'target') {
      throw new Error('expected Email Layout target snapshot');
    }

    const current = emailRoom('ko', '', emailUnits('a', 'b', 'd'), {
      a: 'peer a',
      b: 'peer b',
      d: 'peer d',
    });
    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    const result = captureDocumentRoomSnapshot(current.documentName, current.document);
    expect(result).toMatchObject({
      documentType: 'email_layout',
      localeValues: { a: 'local a', d: 'peer d' },
    });
    expect(
      result?.documentType === 'email_layout' && result.role === 'target' && Object.hasOwn(result.localeValues, 'b'),
    ).toBe(false);
    expect(
      result?.documentType === 'email_layout' && result.role === 'target' && Object.hasOwn(result.localeValues, 'c'),
    ).toBe(false);
  });

  it('replays Menu source edits by stable item ID while keeping peer-only rows', () => {
    const baseline = menuRoom('en', menuItems('a', 'b'), { a: 'a source', b: 'b source' });
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'menu') {
      throw new Error('expected Menu source snapshot');
    }

    const localItems = materializeMenuCanonicalItems(baseline.document).map((item) =>
      item.id === 'a' ? { ...item, url: 'https://local-a.example' } : item,
    );
    replaceMenuCanonicalSource(baseline.document, before.name, localItems, before);
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'menu') {
      throw new Error('expected Menu source snapshot');
    }

    const current = menuRoom(
      'en',
      [
        ...menuItems('a'),
        { id: 'b', label: 'b source', linkType: 'external', url: 'https://peer-b.example' },
        { id: 'peer-added', label: 'peer item', linkType: 'external', url: 'https://peer-added.example' },
      ],
      { a: 'a source', b: 'b source', 'peer-added': 'peer item' },
    );
    replaceMenuCanonicalSource(current.document, 'Peer renamed menu', materializeMenuCanonicalItems(current.document), {
      name: 'Main menu',
      items: menuItems('a', 'b'),
    });
    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    const result = captureDocumentRoomSnapshot(current.documentName, current.document);
    expect(result).toMatchObject({
      documentType: 'menu',
      name: 'Peer renamed menu',
      items: [
        { id: 'a', url: 'https://local-a.example' },
        { id: 'b', url: 'https://peer-b.example' },
        { id: 'peer-added', url: 'https://peer-added.example' },
      ],
    });
  });

  it('cascades a stale explicit parent delete over peer descendants while preserving unrelated local and peer edits', () => {
    const baselineItems: MenuCollaborationItem[] = [
      {
        id: 'branch',
        label: 'Branch',
        linkType: 'external',
        url: 'https://branch.example',
        children: [
          {
            id: 'baseline-child',
            label: 'Baseline child',
            linkType: 'external',
            url: 'https://baseline-child.example',
          },
        ],
      },
      { id: 'unrelated', label: 'Unrelated', linkType: 'external', url: 'https://unrelated.example' },
    ];
    const baseline = menuRoom('en', baselineItems, {});
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'menu') {
      throw new Error('expected Menu source snapshot');
    }

    const localItems = materializeMenuCanonicalItems(baseline.document)
      .filter((item) => item.id !== 'branch')
      .map((item) => (item.id === 'unrelated' ? { ...item, url: 'https://local-unrelated.example' } : item));
    replaceMenuCanonicalSource(baseline.document, before.name, localItems, before);
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'menu') {
      throw new Error('expected Menu source snapshot');
    }

    const current = menuRoom(
      'en',
      [
        {
          ...baselineItems[0]!,
          children: [
            baselineItems[0]!.children![0]!,
            {
              id: 'peer-child',
              label: 'Peer child',
              linkType: 'external',
              url: 'https://peer-child.example',
              children: [
                {
                  id: 'peer-grandchild',
                  label: 'Peer grandchild',
                  linkType: 'external',
                  url: 'https://peer-grandchild.example',
                },
              ],
            },
          ],
        },
        baselineItems[1]!,
        { id: 'peer-root', label: 'Peer root', linkType: 'external', url: 'https://peer-root.example' },
      ],
      {},
      'Peer renamed menu',
    );

    replayDocumentRoomChanges(baseline.documentName, current.document, [{ before, after }], ORIGIN);

    const result = captureDocumentRoomSnapshot(current.documentName, current.document);
    expect(result).toMatchObject({
      documentType: 'menu',
      name: 'Peer renamed menu',
      items: [
        { id: 'unrelated', url: 'https://local-unrelated.example' },
        { id: 'peer-root', url: 'https://peer-root.example' },
      ],
    });
    const currentItems = current.document.getMap<string>(MENU_ITEMS_MAP_NAME);
    const sourceLabels = current.document.getMap<string>(MENU_SOURCE_LABELS_MAP_NAME);
    for (const deletedId of ['branch', 'baseline-child', 'peer-child', 'peer-grandchild']) {
      expect(currentItems.has(deletedId)).toBe(false);
      expect(sourceLabels.has(deletedId)).toBe(false);
    }
    expect(currentItems.has('peer-root')).toBe(true);
  });

  it.each([
    ['document identity', 'document_identity_mismatch', { documentName: 'menu:other:ko' }],
    ['source locale', 'source_locale_mismatch', { sourceLocale: 'fr' }],
    ['target locale', 'locale_mismatch', { locale: 'fr' }],
    ['source/target role', 'role_mismatch', { role: 'source' }],
  ] as const)('rejects a %s mismatch without changing the current room', (_label, reason, mismatch) => {
    const baseline = menuRoom('ko', menuItems('a'), { a: 'old' });
    const before = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!before || before.documentType !== 'menu') {
      throw new Error('expected Menu snapshot');
    }
    setMenuLocaleLabel(baseline.document, 'a', 'local');
    const after = captureDocumentRoomSnapshot(baseline.documentName, baseline.document);
    if (!after || after.documentType !== 'menu') {
      throw new Error('expected Menu snapshot');
    }

    const current = menuRoom('ko', menuItems('a'), { a: 'peer' });
    const stateBefore = Y.encodeStateAsUpdate(current.document);
    const invalidBefore = { ...before, ...mismatch } as typeof before;

    expect(() =>
      replayDocumentRoomChanges(baseline.documentName, current.document, [{ before: invalidBefore, after }], ORIGIN),
    ).toThrow(new DocumentRoomIntentError(reason));
    expect(Y.encodeStateAsUpdate(current.document)).toEqual(stateBefore);
  });

  it('captures only when canonical context agrees with the server-projected room identity', () => {
    const room = menuRoom('ko', menuItems('a'), { a: 'label' });
    room.document.getMap<string | boolean>('menu-context').set('locale', 'fr');

    expect(captureDocumentRoomSnapshot(room.documentName, room.document)).toBeNull();
  });
});
