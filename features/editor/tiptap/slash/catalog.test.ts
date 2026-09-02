import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { createTiptapSlashCatalog, filterTiptapSlashCatalog, type CreateTiptapSlashCatalogOptions } from './catalog';
import type { TiptapSlashMenuMessages } from './types';

function splitItemAliases<Item extends { aliases: string }>(item: Item) {
  return { ...item, aliases: item.aliases.split('\n') };
}

function splitAliases(messages: typeof enMessages.editorCommon.editor.slashMenu): TiptapSlashMenuMessages {
  return {
    placeholder: messages.placeholder,
    unavailable: messages.unavailable,
    groups: messages.groups,
    items: {
      heading: splitItemAliases(messages.items.heading),
      heading2: splitItemAliases(messages.items.heading2),
      heading3: splitItemAliases(messages.items.heading3),
      paragraph: splitItemAliases(messages.items.paragraph),
      bulletList: splitItemAliases(messages.items.bulletList),
      numberedList: splitItemAliases(messages.items.numberedList),
      checkList: splitItemAliases(messages.items.checkList),
      quote: splitItemAliases(messages.items.quote),
      callout: splitItemAliases(messages.items.callout),
      divider: splitItemAliases(messages.items.divider),
      codeBlock: splitItemAliases(messages.items.codeBlock),
      table: splitItemAliases(messages.items.table),
      emoji: splitItemAliases(messages.items.emoji),
      mathBlock: splitItemAliases(messages.items.mathBlock),
      inlineMath: splitItemAliases(messages.items.inlineMath),
      map: splitItemAliases(messages.items.map),
      externalVideo: splitItemAliases(messages.items.externalVideo),
      p5Sketch: splitItemAliases(messages.items.p5Sketch),
      threeScene: splitItemAliases(messages.items.threeScene),
      shader: splitItemAliases(messages.items.shader),
      file: splitItemAliases(messages.items.file),
      aiAssistant: splitItemAliases(messages.items.aiAssistant),
    },
  };
}

const enSlashMessages = splitAliases(enMessages.editorCommon.editor.slashMenu);
const koSlashMessages = splitAliases(koMessages.editorCommon.editor.slashMenu);

function catalog(options: Partial<CreateTiptapSlashCatalogOptions> = {}) {
  return createTiptapSlashCatalog(enSlashMessages, options);
}

describe('Tiptap slash catalog policy', () => {
  it('keeps Geul order and appends the approved runtime workflows before AI', () => {
    expect(catalog().map((item) => item.key)).toEqual([
      'heading',
      'heading_2',
      'heading_3',
      'quote',
      'callout',
      'numbered_list',
      'bullet_list',
      'check_list',
      'paragraph',
      'code_block',
      'divider',
      'table',
      'emoji',
      'math',
      'inline-math',
      'map',
      'external-video',
      'file',
      'p5',
      'three',
      'shader',
      'ai',
    ]);
  });

  it('preserves localized group metadata instead of deriving it from item order', () => {
    const messages = koSlashMessages;
    const grouped = createTiptapSlashCatalog(messages, {});

    expect(grouped.map(({ key, group }) => [key, group])).toEqual([
      ['heading', '제목'],
      ['heading_2', '제목'],
      ['heading_3', '제목'],
      ['quote', '기본 블록'],
      ['callout', '기본 블록'],
      ['numbered_list', '기본 블록'],
      ['bullet_list', '기본 블록'],
      ['check_list', '기본 블록'],
      ['paragraph', '기본 블록'],
      ['code_block', '기본 블록'],
      ['divider', '기본 블록'],
      ['table', '고급'],
      ['emoji', '기타'],
      ['math', '수학'],
      ['inline-math', '인라인'],
      ['map', '임베드'],
      ['external-video', '임베드'],
      ['file', '미디어'],
      ['p5', '임베드'],
      ['three', '임베드'],
      ['shader', '임베드'],
      ['ai', 'AI'],
    ]);
  });

  it('preserves translated aliases for specialized items', () => {
    const localizedAliases = {
      mathBlock: ['수학', '수식'],
      inlineMath: ['인라인 수식', '내장 수식'],
      map: ['지도', '위치'],
      externalVideo: ['외부 영상', '동영상 임베드'],
      file: ['첨부', '파일'],
    } as const;
    const messages: TiptapSlashMenuMessages = {
      ...koSlashMessages,
      items: {
        ...koSlashMessages.items,
        mathBlock: { ...koSlashMessages.items.mathBlock, aliases: localizedAliases.mathBlock },
        inlineMath: { ...koSlashMessages.items.inlineMath, aliases: localizedAliases.inlineMath },
        map: { ...koSlashMessages.items.map, aliases: localizedAliases.map },
        externalVideo: { ...koSlashMessages.items.externalVideo, aliases: localizedAliases.externalVideo },
        file: { ...koSlashMessages.items.file, aliases: localizedAliases.file },
      },
    };
    const items = createTiptapSlashCatalog(messages, {});

    expect(items.find((item) => item.key === 'math')?.aliases).toBe(localizedAliases.mathBlock);
    expect(items.find((item) => item.key === 'inline-math')?.aliases).toBe(localizedAliases.inlineMath);
    expect(items.find((item) => item.key === 'map')?.aliases).toBe(localizedAliases.map);
    expect(items.find((item) => item.key === 'external-video')?.aliases).toBe(localizedAliases.externalVideo);
    expect(items.find((item) => item.key === 'file')?.aliases).toBe(localizedAliases.file);
  });

  it('preserves the exact English inline math aliases', () => {
    expect(catalog().find((item) => item.key === 'inline-math')?.aliases).toEqual([
      'inline',
      'inline math',
      'inlinemath',
      'latex',
      '$',
    ]);
  });

  it('gates intrinsic math and table on profile capability but never on callbacks', () => {
    for (const key of ['math', 'inline-math', 'table']) {
      expect(catalog().find((item) => item.key === key)).toMatchObject({
        enabled: false,
        unavailableReason: expect.any(String),
        execution: { type: 'intrinsic' },
      });
    }

    const available = catalog({ capabilities: { math: true, table: true } });
    for (const key of ['math', 'inline-math', 'table']) {
      expect(available.find((item) => item.key === key)).toMatchObject({
        enabled: true,
        unavailableReason: undefined,
        execution: { type: 'intrinsic' },
      });
    }
  });

  it('keeps schema-local commands visible disabled when a profile forbids them', () => {
    expect(catalog({ intrinsicAvailability: { quote: false } }).find((item) => item.key === 'quote')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
  });

  it('keeps every workflow visible and requires both an explicit capability and callback', () => {
    const unavailable = '이 편집기에서는 사용할 수 없습니다.';
    const messages = { ...koSlashMessages, unavailable };
    const callback = vi.fn();
    const capabilities = {
      emoji: true,
      map: true,
      file: true,
      externalVideo: true,
      p5: true,
      three: true,
      shader: true,
      ai: true,
    } as const;
    const missingCallbacks = createTiptapSlashCatalog(messages, { capabilities });

    for (const key of ['emoji', 'map', 'external-video', 'file', 'p5', 'three', 'shader', 'ai']) {
      expect(missingCallbacks.find((item) => item.key === key)).toMatchObject({
        enabled: false,
        unavailableReason: expect.any(String),
        execution: { type: 'workflow' },
      });
    }

    const callbacks = {
      emoji: callback,
      map: callback,
      file: callback,
      externalVideo: callback,
      p5: callback,
      three: callback,
      shader: callback,
      ai: callback,
    };
    const enabled = createTiptapSlashCatalog(messages, {
      capabilities,
      callbacks,
    });
    for (const key of ['emoji', 'map', 'external-video', 'file', 'p5', 'three', 'shader', 'ai']) {
      expect(enabled.find((item) => item.key === key)).toMatchObject({ enabled: true, unavailableReason: undefined });
    }

    const callbacksWithoutCapabilities = createTiptapSlashCatalog(messages, {
      callbacks,
    });
    expect(
      callbacksWithoutCapabilities.filter((item) => item.execution.type === 'workflow').every((item) => !item.enabled),
    ).toBe(true);
  });

  it('uses a precise localized reason when Emoji has no adapter', () => {
    const emojiUnavailableReason = '이 편집기에는 이모지 선택기가 연결되지 않았습니다.';
    expect(
      catalog({ capabilities: { emoji: true }, emojiUnavailableReason }).find((item) => item.key === 'emoji'),
    ).toMatchObject({
      enabled: false,
      unavailableReason: emojiUnavailableReason,
    });
  });

  it('filters localized title, subtext, and aliases using the editor locale', () => {
    const messages = {
      ...enSlashMessages,
      items: {
        ...enSlashMessages.items,
        p5Sketch: {
          ...enSlashMessages.items.p5Sketch,
          title: 'İçerik çizimi',
          subtext: 'Etkileşimli çizim ekle',
          aliases: ['taslak'],
        },
      },
    };
    const items = createTiptapSlashCatalog(messages, {});

    expect(filterTiptapSlashCatalog(items, 'içerik', 'tr').map((item) => item.key)).toEqual(['p5']);
    expect(filterTiptapSlashCatalog(items, 'etkileşimli', 'tr').map((item) => item.key)).toEqual(['p5']);
    expect(filterTiptapSlashCatalog(items, 'TASLAK', 'tr').map((item) => item.key)).toEqual(['p5']);
    expect(filterTiptapSlashCatalog(items, '', 'tr').length).toBe(items.length);
    expect(filterTiptapSlashCatalog(items, 'taslak', 'tr')[0]?.enabled).toBe(false);
  });

  it('matches canonical command keys independently of the editor locale', () => {
    const items = createTiptapSlashCatalog(koSlashMessages, {
      capabilities: { emoji: true, table: true },
      callbacks: { emoji: vi.fn() },
    });

    expect(filterTiptapSlashCatalog(items, 'table', 'ko').map((item) => item.key)).toEqual(['table']);
    expect(filterTiptapSlashCatalog(items, 'emoji', 'ko').map((item) => item.key)).toEqual(['emoji']);
  });
});
