import { publicAccessibilityLabels } from '@/stories/shared/public-accessibility';
import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { create } from '@bufbuild/protobuf';
import { expect, within } from 'storybook/test';
import {
  ParagraphBlockSchema,
  ParagraphBlockLocaleSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { LayoutContainer } from '@/components/core/Layout';
import { TermsPageClient } from '@/app/(general)/terms/TermsPageClient';
import { PrivacyPageClient } from '@/app/(general)/privacy/PrivacyPageClient';
import type { PublicLegalPageInitialData } from '@/lib/queries/legal-public-page';
import { PublicShellStoryHarness } from '@/stories/public/fixtures/PublicShellStoryHarness';
import { assertDocumentOutline } from '@/stories/public/fixtures/document-outline';
import {
  buildLongRichText,
  longRichTextLocale,
  type LongRichTextLocale,
  type LongRichTextSection,
} from '@/stories/public/fixtures/long-rich-text';

/** Long terms per review content language (Storybook locale `ko`/`ar`, else English). */
const LEGAL_CLAUSE: Record<LongRichTextLocale, string> = {
  en: 'The service is provided under these conditions. Where a provision is unenforceable, the remaining provisions continue to apply, and notices are sent to the address registered with the account. ',
  ko: '서비스는 이 조건에 따라 제공됩니다. 어느 조항이 효력을 갖지 못하더라도 나머지 조항은 계속 적용되며, 통지는 계정에 등록된 주소로 보내집니다. ',
  ar: 'تُقدَّم الخدمة وفق هذه الشروط. وإذا تعذّر تنفيذ أحد الأحكام، تظل الأحكام الأخرى سارية، وتُرسَل الإشعارات إلى العنوان المسجل في الحساب. ',
};
const LEGAL_OUTLINE: readonly (readonly [level: number, en: string, ko: string, ar: string])[] = [
  [1, '1. Scope of these terms', '1. 약관의 적용 범위', '1. نطاق هذه الشروط'],
  [2, '1.1 Definitions', '1.1 정의', '1.1 التعريفات'],
  [2, '1.2 Changes to these terms', '1.2 약관의 변경', '1.2 التغييرات على هذه الشروط'],
  [1, '2. Accounts', '2. 계정', '2. الحسابات'],
  [2, '2.1 Eligibility', '2.1 가입 자격', '2.1 الأهلية'],
  [
    3,
    '2.1.1 Guardians acting for minors and the documents required to verify their authority',
    '2.1.1 미성년자를 대리하는 보호자와 그 권한을 확인하는 데 필요한 서류',
    '2.1.1 الأوصياء الذين يتصرفون نيابة عن القاصرين والمستندات المطلوبة للتحقق من صلاحيتهم',
  ],
  [2, '2.2 Security of credentials', '2.2 인증 정보의 보안', '2.2 أمان بيانات الاعتماد'],
  [1, '3. Content you publish', '3. 게시하는 콘텐츠', '3. المحتوى الذي تنشره'],
  [2, '3.1 Licence to host and display', '3.1 호스팅 및 표시 이용 허락', '3.1 ترخيص الاستضافة والعرض'],
  [2, '3.2 Removal', '3.2 삭제', '3.2 الإزالة'],
  [1, '4. Payments and refunds', '4. 결제와 환불', '4. المدفوعات والمبالغ المستردة'],
  [2, '4.1 Billing', '4.1 청구', '4.1 الفوترة'],
  [2, '4.2 Refund requests', '4.2 환불 요청', '4.2 طلبات الاسترداد'],
  [1, '5. Termination', '5. 해지', '5. الإنهاء'],
  [1, '6. Liability', '6. 책임', '6. المسؤولية'],
  [2, '6.1 Limitations', '6.1 책임의 제한', '6.1 القيود'],
  [1, '7. Contact', '7. 연락처', '7. التواصل'],
];
const longLegalContents = new Map<LongRichTextLocale, ReturnType<typeof buildLongRichText>>();
function longLegalContentFor(locale: LongRichTextLocale) {
  if (!longLegalContents.has(locale)) {
    const sections: LongRichTextSection[] = LEGAL_OUTLINE.map(([level, en, ko, ar]) => ({
      level,
      title: { en, ko, ar }[locale],
      paragraph: LEGAL_CLAUSE[locale].repeat(4),
    }));
    longLegalContents.set(locale, buildLongRichText(sections, { firstId: 900, locale }));
  }
  return longLegalContents.get(locale)!;
}
export function LegalPagePreview({
  document = 'terms',
  scheduled = false,
  state = 'empty',
}: {
  document?: 'terms' | 'privacy';
  scheduled?: boolean;
  state?: 'empty' | 'body' | 'long' | 'fallback' | 'preview' | 'invalid-preview' | 'loading' | 'error';
}) {
  const locale = useLocale();
  const contentLocale = longRichTextLocale(locale);
  // The long terms are authored in the review content language; other states keep their fixed text.
  const displayedLocale = state === 'fallback' ? 'ko' : state === 'long' ? contentLocale : 'en';
  const content = useMemo(
    () =>
      state === 'long'
        ? longLegalContentFor(contentLocale)
        : [
            {
              id: '10000000-0000-4000-8000-000000000401',
              kind: 'paragraph' as const,
              base: create(ParagraphBlockSchema),
              locale: create(ParagraphBlockLocaleSchema, {
                content: [
                  {
                    value: {
                      case: 'text',
                      value: {
                        text:
                          state === 'fallback'
                            ? '이 문서는 원문 언어로 제공됩니다.'
                            : 'This policy explains the current conditions and effective period.',
                      },
                    },
                  },
                ],
              }),
              children: [],
            },
          ],
    [state, contentLocale],
  );
  const localizationInfo = useMemo(
    () => ({
      requestedLocale: locale,
      displayedLocale,
      sourceLocale: displayedLocale,
      isFallback: locale !== displayedLocale,
      isOriginal: true,
      machineGenerated: false,
      fallbackReason: 0,
      availableLocales: [displayedLocale],
    }),
    [locale, displayedLocale],
  );
  const client = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false, retry: false, staleTime: Infinity } },
    });
    if (state === 'preview' || state === 'invalid-preview') {
      client.setQueryData(
        [document, 'preview', 'preview-next', 'local-token', locale],
        state === 'invalid-preview'
          ? null
          : {
              id: 'preview-next',
              version: 4,
              title: 'Upcoming policy',
              content,
              localizationInfo,
              status: 'scheduled',
              effectiveFrom: new Date('2026-11-01T00:00:00Z'),
            },
      );
    } else if (state === 'loading' || state === 'error') {
      client
        .getQueryCache()
        .build(client, { queryKey: [document, 'page', locale] })
        .setState(
          state === 'loading'
            ? { status: 'pending', fetchStatus: 'fetching' }
            : { status: 'error', fetchStatus: 'idle', error: new Error('Local query failure') },
        );
    }
    return client;
  }, [locale, document, scheduled, state, content, localizationInfo]);
  const initialData: PublicLegalPageInitialData = {
    requestedLocale: locale,
    updatedAt: 1,
    data: {
      active: {
        id: 'preview-current',
        version: 3,
        title: 'Current policy',
        content: state === 'empty' ? null : content,
        localizationInfo: state === 'empty' ? null : localizationInfo,
        status: 'active',
        effectiveFrom: new Date('2026-10-01T00:00:00Z'),
        createdAt: null,
      },
      scheduled: scheduled
        ? {
            id: 'preview-next',
            version: 4,
            title: 'Upcoming policy',
            localizationInfo: null,
            status: 'scheduled',
            effectiveFrom: new Date('2026-11-01T00:00:00Z'),
          }
        : null,
    },
  };
  const page =
    document === 'terms' ? (
      <TermsPageClient initialData={state === 'loading' || state === 'error' ? undefined : initialData} />
    ) : (
      <PrivacyPageClient initialData={state === 'loading' || state === 'error' ? undefined : initialData} />
    );
  return (
    <QueryClientProvider key={`${document}:${state}:${locale}`} client={client}>
      {state === 'long' ? (
        // Production frame: the route renders directly in the site shell's main region.
        <PublicShellStoryHarness initialPath={`/${document}`}>{page}</PublicShellStoryHarness>
      ) : (
        <LayoutContainer size="wide" inset="md">
          {page}
        </LayoutContainer>
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Legal/Public Document',
  excludeStories: ['LegalPagePreview'],
  component: LegalPagePreview,
  args: { document: 'terms', scheduled: false, state: 'empty' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/terms', query: {} } },
    docs: {
      description: {
        component:
          'Actual TermsPageClient/PrivacyPageClient with per-locale local query data and disabled transport. Current/empty body, source-language fallback, scheduled preview, invalid preview, loading and query failure use production branches. Local preview token reproduces the client surface and does not grant service access.',
      },
    },
  },
} satisfies Meta<typeof LegalPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Terms: Story = {};
export const TermsUpcoming: Story = { args: { scheduled: true } };
export const Privacy: Story = {
  args: { document: 'privacy' },
  parameters: { nextjs: { navigation: { pathname: '/privacy', query: {} } } },
};
export const PrivacyUpcoming: Story = {
  args: { document: 'privacy', scheduled: true },
  parameters: { nextjs: { navigation: { pathname: '/privacy', query: {} } } },
};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const TermsBody: Story = { args: { state: 'body' } };
/** A long, nested legal document in the production site shell: outline column, rail and reading measure. */
export const TermsLongDocument: Story = { args: { state: 'long' }, play: assertDocumentOutline };
export const PrivacyBody: Story = { args: { document: 'privacy', state: 'body' }, parameters: Privacy.parameters };
export const SourceLanguageFallback: Story = {
  args: { state: 'fallback' },
  tags: ['a11y-public'],
  play: async ({ canvasElement, globals }) => {
    const t = await publicAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    await expect((await canvas.findByText('이 문서는 원문 언어로 제공됩니다.')).closest('[lang]')).toHaveAttribute(
      'lang',
      'ko',
    );
    await expect(canvas.getByRole('heading', { level: 1, name: t('common.entities.terms') })).toBeInTheDocument();
  },
};
const previewParameters = {
  nextjs: { navigation: { pathname: '/terms', query: { preview: 'preview-next', token: 'local-token' } } },
};
export const ScheduledPreview: Story = { args: { state: 'preview' }, parameters: previewParameters };
export const InvalidPreview: Story = { args: { state: 'invalid-preview' }, parameters: previewParameters };
export const PrivacyScheduledPreview: Story = {
  args: { document: 'privacy', state: 'preview' },
  parameters: {
    nextjs: { navigation: { pathname: '/privacy', query: { preview: 'preview-next', token: 'local-token' } } },
  },
};
export const PrivacyInvalidPreview: Story = {
  ...PrivacyScheduledPreview,
  args: { document: 'privacy', state: 'invalid-preview' },
};
export const Loading: Story = { args: { state: 'loading' } };
export const QueryFailure: Story = { args: { state: 'error' } };
