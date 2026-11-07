import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale } from 'next-intl';
import { primitiveTokens, printTokens, responsiveTokens } from '@echovisionlab/design-system/tokens';
import { Heading, Text, type HeadingScale } from '@/components/core/Typography';
import { LayoutStack } from '@/components/core/Layout';
import { getLocaleDirection, getLocaleFontProfile } from '@/lib/i18n/locale';
import { theme } from '@/theme';
import {
  CodeExample,
  DocSection,
  DocTable,
  FoundationDoc,
  LocalizedSpecimen,
  SourceNote,
  StoryLink,
  useFoundationUI,
} from './FoundationDocs';
import classes from './FoundationDocs.module.css';

function TypographyReference() {
  const ui = useFoundationUI();
  const locale = useLocale();
  return (
    <FoundationDoc
      title="Typography"
      description="Typography roles use production Core Text and Heading. Semantic heading level and visible scale are separate choices."
    >
      <DocSection title="Font and locale">
        <DocTable
          caption="Active production font contract"
          columns={['Role', 'Value']}
          rows={[
            ['UI', theme.fontFamily],
            ['Monospace', theme.fontFamilyMonospace],
            ['Locale', locale],
            ['Font profile', getLocaleFontProfile(locale)],
            ['Direction', getLocaleDirection(locale)],
          ]}
        />
        <Text size="sm">
          The locale toolbar supplies the same language, direction and font profile as the app. Korean uses Noto Sans
          KR, Latin uses Noto Sans; other scripts select their existing locale profile. Documentation remains English;
          live specimens keep their selected product locale.
        </Text>
        <SourceNote>
          theme.ts · lib/i18n/locale.ts · lib/styles/font-assignment.css · .storybook/preview-fonts.css
        </SourceNote>
      </DocSection>
      <DocSection title="Text scale">
        <LocalizedSpecimen>
          <LayoutStack gap="md">
            {Object.entries(primitiveTokens.fontSize).map(([size, value]) => (
              <div key={size} className={classes.sample}>
                <LayoutStack gap="xs">
                  <Text size={size as keyof typeof primitiveTokens.fontSize}>
                    {ui('Readable task text · Save your changes', '읽을 수 있는 과업 문구 · 변경 내용을 저장하세요')}
                  </Text>
                  <Text size="xs" tone="secondary" font="mono">
                    {size} · {value} · line-height{' '}
                    {primitiveTokens.lineHeight[size as keyof typeof primitiveTokens.lineHeight]}
                  </Text>
                </LayoutStack>
              </div>
            ))}
          </LayoutStack>
        </LocalizedSpecimen>
        <DocTable
          caption="primitiveTokens.fontWeight"
          columns={['Role', 'Weight']}
          rows={Object.entries(primitiveTokens.fontWeight)}
        />
        <Text size="sm">
          400/500/600 are requested weights. The current Storybook font declarations load 400/700 for several Noto
          families, so intermediate weight synthesis needs visual review; this page does not claim exact font-face
          coverage.
        </Text>
      </DocSection>
      <DocSection title="Heading scale">
        <Text size="sm">
          These samples all have level=3 under this section; scale changes their appearance. Production pages use levels
          for document structure and scale for size. `title` is the document title role (Post, Page and public document
          details), one text-scale step above an authored body h1 at every width. The token layer makes title and h1–h3
          responsive at `sm` and replaces every type role on paper; resize the preview to see the base step.
        </Text>
        <LocalizedSpecimen>
          <LayoutStack gap="md">
            {(['title', 1, 2, 3, 4, 5, 6] as HeadingScale[]).map((scale) => {
              const role = scale === 'title' ? 'title' : (`h${scale}` as const);
              const wide = responsiveTokens.sm[`heading-${role}` as keyof typeof responsiveTokens.sm];
              const paper = printTokens[`heading-${role}` as keyof typeof printTokens];
              return (
                <div key={scale} className={classes.sample}>
                  <Heading level={3} scale={scale}>
                    {ui('Section heading', '구역 제목')} · {scale}
                  </Heading>
                  <Text size="xs" tone="secondary" font="mono">
                    {primitiveTokens.heading[role]}
                    {wide ? ` · sm+ ${wide}` : ''}
                    {paper ? ` · paper ${paper}` : ''} · line-height {primitiveTokens.heading['line-height']}
                  </Text>
                </div>
              );
            })}
          </LayoutStack>
        </LocalizedSpecimen>
      </DocSection>
      <DocSection title="Paper">
        <DocTable
          caption="printTokens: print media replaces these roles (A4/Letter)"
          columns={['Role', 'Screen', 'Paper']}
          rows={Object.entries(printTokens).map(([role, value]) => [
            role,
            role in responsiveTokens.sm
              ? `${String((primitiveTokens as Record<string, unknown>)[role] ?? '')}${
                  responsiveTokens.sm[role as keyof typeof responsiveTokens.sm]
                }`
              : '',
            value,
          ])}
        />
        <Text size="sm">
          Running text prints at 10.5pt with code, tables and captions at 9pt. Feature and print CSS consume the role
          names; the token scanner rejects literal type sizes, including pt values in print rules.
        </Text>
        <StoryLink id="pages-public-documents--post-heading-hierarchy">Document heading hierarchy</StoryLink>
      </DocSection>
      <DocSection title="Content behavior">
        <CodeExample>{`<Heading level={1} scale={{ base: 3, sm: 2 }}>{pageTitle}</Heading>\n<Text size="sm" tone="secondary">{help}</Text>\n<Text font="mono" numeric="tabular">{formattedValue}</Text>\n<Text wrap="anywhere">{unbrokenIdentifier}</Text>`}</CodeExample>
        <Text size="sm">
          Choose wrapping or truncation from the task. If essential text is shortened, provide a path to the full value.
          Review long Korean/English labels, unbroken strings, RTL, 200% text enlargement and user text spacing. Coarse
          text inputs retain at least 16px text independently of compact geometry.
        </Text>
        <StoryLink id="core-typography-text--scale">Core Text scale</StoryLink>
        <StoryLink id="core-actions-textbutton--long-menu-label">Long menu label wrapping</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Typography',
  component: TypographyReference,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof TypographyReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = {};
