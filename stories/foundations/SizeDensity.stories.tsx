import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconCheck, IconDots } from '@tabler/icons-react';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextButton } from '@/components/core/TextButton';
import { TextInput } from '@/components/core/Input';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { ActionRowSizeProvider, ToolbarDensityProvider } from '@/components/core/control-context';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
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

const actionSizes = ['compact', 'xs', 'sm', 'md', 'lg', 'xl'] as const;
function SizeDensity() {
  const ui = useFoundationUI();
  const [clicks, setClicks] = useState(0);
  const [value, setValue] = useState('');
  const increment = () => setClicks((current) => current + 1);
  return (
    <FoundationDoc
      title="Size and density"
      description="Control geometry, type scale and input capability are independent decisions. Shared contexts establish one action row contract."
    >
      <DocSection title="Named geometry">
        <DocTable
          caption="primitiveTokens.controlHeight"
          columns={['Role', 'Source value', 'Fine pointer, 16px root']}
          rows={Object.entries(primitiveTokens.controlHeight).map(([name, value]) => [
            name,
            value,
            `${parseFloat(value) * 16}px`,
          ])}
        />
        <Text size="sm">
          Coarse and hybrid devices set the shared minimum to 2.75rem (44px at a 16px root). Targets occupy layout
          space. Keep the glyph at 1rem; do not enlarge it to meet the interaction minimum or add overlapping invisible
          targets.
        </Text>
        <SourceNote>
          components/core/design-tokens.ts · lib/styles/design-tokens.css · components/core/Control.module.css
        </SourceNote>
        <LocalizedSpecimen>
          <LayoutStack gap="sm">
            {actionSizes.map((size) => (
              <LayoutInline key={size} gap="action-group" wrap="wrap">
                <Text size="xs" font="mono">
                  {size}
                </Text>
                <Button size={size} leftSection={<IconCheck />} onClick={increment}>
                  {ui('Save', '저장')}
                </Button>
                <IconButton size={size} label={ui(`More actions · ${size}`, `더보기 · ${size}`)} onClick={increment}>
                  <IconDots />
                </IconButton>
              </LayoutInline>
            ))}
          </LayoutStack>
        </LocalizedSpecimen>
      </DocSection>
      <DocSection title="Context precedence">
        <DocTable
          caption="Action size resolution"
          columns={['Order', 'Owner', 'Result']}
          rows={[
            ['1', 'ToolbarDensityProvider: compact', 'compact'],
            ['2', 'ActionRowSizeProvider', 'xs / sm / md'],
            ['3', 'Standalone component size', 'Requested or component default.'],
            ['Separate', 'HeaderDensityProvider', 'Internal gap and padding, not row size.'],
          ]}
        />
        <Text size="sm">
          The following row requests different component sizes but its shared owner resolves all three to sm. TextButton
          joins action sizing through density="chrome"; a prose link keeps its text line geometry.
        </Text>
        <LocalizedSpecimen>
          <ActionRowSizeProvider size="sm">
            <LayoutInline gap="action-group" wrap="wrap">
              <Button size="lg" onClick={increment}>
                {ui('Save', '저장')}
              </Button>
              <IconButton size="xs" label={ui('More actions', '더보기')} onClick={increment}>
                <IconDots />
              </IconButton>
              <TextButton density="chrome" controlSize="md" onClick={increment}>
                {ui('Manage', '관리')}
              </TextButton>
            </LayoutInline>
          </ActionRowSizeProvider>
        </LocalizedSpecimen>
        <CodeExample>{`<ActionRowSizeProvider size="sm">\n  <LayoutInline gap="action-group" wrap="wrap">\n    <Button size="lg">{save}</Button>\n    <IconButton size="xs" label={more}><IconDots /></IconButton>\n    <TextButton density="chrome" controlSize="md">{manage}</TextButton>\n  </LayoutInline>\n</ActionRowSizeProvider>`}</CodeExample>
        <Text size="sm">
          Compact toolbar density has priority over the row context, demonstrated below with the same production
          controls.
        </Text>
        <LocalizedSpecimen>
          <ToolbarDensityProvider density="compact">
            <ActionRowSizeProvider size="sm">
              <LayoutInline gap="action-group" wrap="wrap">
                <Button onClick={increment}>{ui('Save', '저장')}</Button>
                <IconButton label={ui('More actions', '더보기')} onClick={increment}>
                  <IconDots />
                </IconButton>
                <TextButton density="chrome" onClick={increment}>
                  {ui('Manage', '관리')}
                </TextButton>
              </LayoutInline>
            </ActionRowSizeProvider>
          </ToolbarDensityProvider>
        </LocalizedSpecimen>
        <LocalizedSpecimen>
          <Text role="status" size="sm">
            {ui(`Local actions: ${clicks}`, `로컬 실행: ${clicks}`)}
          </Text>
        </LocalizedSpecimen>
      </DocSection>
      <DocSection title="Input density">
        <LocalizedSpecimen>
          <TextInput
            label={ui('Compact title', 'compact 제목')}
            density="compact"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            description={ui('Enter a title for this draft.', '이 초안의 제목을 입력하세요.')}
          />
        </LocalizedSpecimen>
        <Text size="sm">
          Retired compact-xs and touch sizes are not public API. Choose the named size and let input capability raise
          the minimum. Review density with its real labels, errors and siblings.
        </Text>
        <StoryLink id="composition-size-and-density--shared-owners">Full size/density composition</StoryLink>
        <StoryLink id="core-actions-iconbutton--button-aligned-sizes">Button-aligned icon targets</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Size and Density',
  component: SizeDensity,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof SizeDensity>;
export default meta;
export const Reference: StoryObj<typeof meta> = {};
