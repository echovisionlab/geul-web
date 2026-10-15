import type { Meta, StoryObj } from '@storybook/nextjs';
import { LabelBadge } from '@/components/core/Badge';
import { LayoutGrid, LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { primitiveTokens, tokenVar, type SemanticToken } from '@/components/core/design-tokens';
import { SiteLogoView } from '@/features/site/ui/SiteLogo/SiteLogoView';
import { useColorScheme } from '@/lib/providers/DesignSystemProvider';
import { getThemeDefinition, getThemeTokens } from '@/lib/theme/themes';
import { DocSection, FoundationDoc, LocalizedSpecimen, SourceNote, StoryLink, useFoundationUI } from './FoundationDocs';

const roles: SemanticToken[] = [
  'background',
  'surface',
  'surface-muted',
  'surface-hover',
  'surface-active',
  'text-primary',
  'text-secondary',
  'border-default',
  'status-accent',
  'status-positive',
  'status-warning',
  'status-danger',
  'action-primary',
];
const families = [
  'neutral',
  'graphite',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'brown',
  'purple',
  'pink',
] as const;
function colorGrade(value: string) {
  for (const family of families) {
    for (const [grade, hex] of Object.entries(primitiveTokens.colors[family])) {
      if (hex === value) {
        return `${family}-${grade}`;
      }
    }
  }
  return value;
}
function MaterialPalettePreview() {
  const ui = useFoundationUI();
  const { themeId } = useColorScheme();
  const activeTheme = getThemeDefinition(themeId);
  const activeTokens = getThemeTokens(themeId);
  return (
    <FoundationDoc
      title="Material palette and roles"
      description="Palette grades are materials. Semantic theme roles determine readable UI use; a palette family does not by itself assign an action or status meaning."
    >
      <LayoutInline justify="between" align="center">
        <SiteLogoView src="/storybook/media/rawsector-logo.svg" alt="rawsector" height={32} />
        <Text size="xs" tone="secondary">
          {activeTheme.label} · brand {primitiveTokens.colors.brand}
        </Text>
      </LayoutInline>
      <DocSection title="Status and command meaning">
        <LocalizedSpecimen>
          <LayoutInline gap="md" wrap="wrap">
            <LabelBadge tone="neutral" appearance="dot">
              {ui('General', '일반')}
            </LabelBadge>
            <LabelBadge tone="accent" appearance="dot">
              {ui('Information', '정보')}
            </LabelBadge>
            <LabelBadge tone="positive" appearance="dot">
              {ui('Success', '성공')}
            </LabelBadge>
            <LabelBadge tone="warning" appearance="dot">
              {ui('Warning', '주의')}
            </LabelBadge>
            <LabelBadge tone="danger" appearance="dot">
              {ui('Error', '오류')}
            </LabelBadge>
          </LayoutInline>
        </LocalizedSpecimen>
        <Text size="sm">
          Commands use neutral emphasis by default. Status roles communicate domain state together with text and shape.
          Orange is a reserved material family; authored document color names are content data and retain their own
          selection meaning.
        </Text>
        <StoryLink id="foundations-principles--ownership">Command emphasis policy</StoryLink>
      </DocSection>
      <DocSection title={`Active semantic roles · ${activeTheme.label}`}>
        <LayoutGrid columns={{ base: 1, sm: 2, md: 3 }} gap="lg">
          {roles.map((role) => (
            <LayoutStack key={role} gap="xs">
              <div
                style={{
                  blockSize: 'var(--geul-control-height-lg)',
                  background: tokenVar(role),
                  border: 'var(--geul-border-thin) solid var(--geul-border-default)',
                }}
                aria-hidden
              />
              <Text size="xs" weight="strong" font="mono" wrap="anywhere">
                {role}
              </Text>
              <Text size="xs" tone="secondary">
                {colorGrade(activeTokens[role])} · {activeTokens[role]}
              </Text>
            </LayoutStack>
          ))}
        </LayoutGrid>
        <SourceNote>components/core/design-tokens.ts · lib/theme/themes.ts → getThemeTokens(themeId)</SourceNote>
        <StoryLink id="foundations-tokens--reference">Complete token and theme registry reference</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
function PaletteGradesPreview() {
  return (
    <FoundationDoc
      title="Palette grades"
      description="Every production palette family, read from primitiveTokens. Grades 50 → 900 increase in darkness. Select semantic roles for product UI instead of a raw palette grade."
    >
      <LayoutStack gap="section">
        {families.map((family) => (
          <DocSection key={family} title={family}>
            <LayoutGrid columns={{ base: 2, sm: 5, lg: 10 }} gap="sm">
              {Object.entries(primitiveTokens.colors[family]).map(([grade, hex]) => (
                <LayoutStack key={grade} gap="xxs">
                  <div
                    style={{
                      blockSize: 'var(--geul-control-height-lg)',
                      background: hex,
                      border: 'var(--geul-border-thin) solid var(--geul-border-default)',
                    }}
                    aria-hidden
                  />
                  <Text size="xs" weight="strong">
                    {family}-{grade}
                  </Text>
                  <Text size="xs" tone="secondary">
                    {hex}
                  </Text>
                </LayoutStack>
              ))}
            </LayoutGrid>
          </DocSection>
        ))}
      </LayoutStack>
      <SourceNote>components/core/design-tokens.ts · primitiveTokens.colors</SourceNote>
      <StoryLink id="foundations-tokens--reference">Semantic selection and full token source</StoryLink>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Material Palette',
  component: MaterialPalettePreview,
  tags: ['autodocs'],
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta<typeof MaterialPalettePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Composition: Story = {};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const Grades: Story = { render: () => <PaletteGradesPreview /> };
