import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  materializeLocalizedRichTextTree,
  type LocalizedRichTextBlock,
} from '@/features/editor/contract/localized-rich-text';

export interface LongRichTextSection {
  level: number;
  title: string;
  paragraph: string;
}

const ROOM_TEXT =
  'Listen to the room before choosing the next sound. Notice its texture, distance and changes over time. '.repeat(8);

/**
 * Content languages of the reading review: Latin (en), Hangul (ko) and Arabic (ar, RTL). The long
 * fixtures author their body in the Storybook locale when it is one of these, otherwise in English, so
 * the reading measure, line height and paragraph rhythm are reviewed with real text in each script.
 */
export type LongRichTextLocale = 'en' | 'ko' | 'ar';
export function longRichTextLocale(locale: string): LongRichTextLocale {
  return locale === 'ko' || locale === 'ar' ? locale : 'en';
}
const ROOM_TEXT_BY_LOCALE: Record<LongRichTextLocale, string> = {
  en: ROOM_TEXT,
  ko: '다음 소리를 고르기 전에 먼저 방의 소리를 들어 보세요. 그 질감과 거리, 그리고 시간이 지나며 달라지는 결을 살펴봅니다. '.repeat(
    8,
  ),
  ar: 'استمع إلى الغرفة قبل أن تختار الصوت التالي. لاحظ ملمسها ومسافتها وما يتغير فيها مع مرور الوقت. '.repeat(8),
};
const SECTION_TITLE_BY_LOCALE: Record<LongRichTextLocale, (index: number) => string> = {
  en: (index) => `Listening section ${index}`,
  ko: (index) => `듣기 구간 ${index}`,
  ar: (index) => `قسم الاستماع ${index}`,
};
const LONG_TITLE_BY_LOCALE: Record<LongRichTextLocale, string> = {
  en: 'A deliberately long section title about field recordings, quiet rooms and the sounds we notice along the way',
  ko: '현장 녹음과 조용한 방, 그리고 그 길에서 우리가 알아차리는 소리들에 관한 일부러 길게 쓴 구간 제목',
  ar: 'عنوان قسم طويل عمداً عن التسجيلات الميدانية والغرف الهادئة والأصوات التي نلاحظها في الطريق',
};
const STUDIO_TITLE_BY_LOCALE: Record<LongRichTextLocale, string> = {
  en: 'Quiet Studio',
  ko: '조용한 스튜디오',
  ar: 'الاستوديو الهادئ',
};

/**
 * A long typed rich-text document for table-of-contents and reading-measure review, authored over the
 * catalog's whole heading range (H1–H3) without skipped levels. Under a document title the published
 * body demotes each authored level by one (H1 → h2, H2 → h3, H3 → h4; visual size unchanged), so the
 * title stays the page's only h1; untitled documents keep the authored levels. Deeper and skipped levels
 * are Core fixtures (DeepNesting) and unit tests. One title is very long, and there is enough text to
 * scroll well past the viewport.
 */
export const NESTED_LONG_SECTIONS: LongRichTextSection[] = [
  1, 2, 3, 3, 2, 1, 2, 3, 3, 2, 1, 2, 1, 1, 2, 3, 3, 1, 2, 3, 3, 2, 1, 1,
].map((level, index) => ({
  level,
  title: index === 7 ? LONG_TITLE_BY_LOCALE.en : SECTION_TITLE_BY_LOCALE.en(index + 1),
  paragraph: ROOM_TEXT,
}));

/**
 * The same document without a visible title: the author writes the page's one H1 and the sections
 * below it start at H2 (offset 0, so the authored levels are the rendered elements).
 */
export const UNTITLED_LONG_SECTIONS: LongRichTextSection[] = [
  { level: 1, title: STUDIO_TITLE_BY_LOCALE.en, paragraph: ROOM_TEXT },
  ...NESTED_LONG_SECTIONS.map((section) => ({ ...section, level: Math.min(3, section.level + 1) })),
];

/**
 * The nested/untitled sections in another review language: the shared room text, numbered section
 * titles, the long title and the studio title are replaced; any other authored text is kept.
 */
export function localizeLongSections(
  sections: readonly LongRichTextSection[],
  locale: LongRichTextLocale,
): LongRichTextSection[] {
  if (locale === 'en') {
    return [...sections];
  }
  return sections.map((section) => {
    const numbered = /^Listening section (\d+)$/u.exec(section.title);
    const title = numbered
      ? SECTION_TITLE_BY_LOCALE[locale](Number(numbered[1]))
      : section.title === LONG_TITLE_BY_LOCALE.en
        ? LONG_TITLE_BY_LOCALE[locale]
        : section.title === STUDIO_TITLE_BY_LOCALE.en
          ? STUDIO_TITLE_BY_LOCALE[locale]
          : section.title;
    const paragraph = section.paragraph === ROOM_TEXT ? ROOM_TEXT_BY_LOCALE[locale] : section.paragraph;
    return { ...section, title, paragraph };
  });
}

/** Materializes heading + paragraph pairs through the production typed rich-text contract. */
export function buildLongRichText(
  sections: readonly LongRichTextSection[],
  {
    profile = RichTextProfile.POST,
    firstId = 300,
    locale = 'en',
  }: { profile?: RichTextProfile; firstId?: number; locale?: LongRichTextLocale } = {},
): readonly LocalizedRichTextBlock[] {
  const id = (offset: number) => `10000000-0000-4000-8000-${String(firstId + offset).padStart(12, '0')}`;
  return materializeLocalizedRichTextTree(
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile,
      locale,
      base: {
        nodes: sections.flatMap((section, index): JsonValue[] => [
          {
            block: {
              id: id(index * 2),
              heading: {
                props: { level: section.level },
              },
            },
            placement: { index: index * 2 },
          },
          {
            block: {
              id: id(index * 2 + 1),
              paragraph: { props: {} },
            },
            placement: { index: index * 2 + 1 },
          },
        ]),
      },
      localeOverlay: {
        locale,
        blocks: sections.flatMap((section, index): JsonValue[] => [
          { blockId: id(index * 2), heading: { props: {}, content: [{ text: { text: section.title } }] } },
          { blockId: id(index * 2 + 1), paragraph: { props: {}, content: [{ text: { text: section.paragraph } }] } },
        ]),
      },
    }),
  );
}
