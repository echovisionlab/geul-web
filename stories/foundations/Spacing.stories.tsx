import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconCheck } from '@tabler/icons-react';
import { primitiveTokens, derivedTokenRoles } from '@echovisionlab/design-system/tokens';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { HeaderDensityProvider } from '@/components/core/control-context';
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

function SpacingRelationships() {
  const ui = useFoundationUI();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const roles = [
    ['control-label', 'Label ↔ icon / indicator', 'Control.module.css'],
    ['control-label-compact', 'HeaderDensity compact label ↔ icon', 'HeaderDensityProvider → Control.module.css'],
    ['action-group', 'Commands in an external action row', 'Layout / ToolbarLayout / SectionHeader'],
    ['toolbar-item', 'Comfortable ToolbarSurface items', 'ToolbarSurface'],
    ['field-label', 'Field label ↔ control', 'Field'],
    ['field-column', 'Inline Field columns', 'Field'],
    ['section', 'Independent composition sections', 'Layout'],
  ] as const;
  return (
    <FoundationDoc
      title="Spacing and gap relationships"
      description="Spacing names describe a shared scale. Relationship roles identify why elements are separated and who owns the distance."
    >
      <DocSection title="Shared scale">
        <DocTable
          caption="primitiveTokens.spacing"
          columns={['Name', 'Source value', 'Scale sample']}
          rows={Object.entries(primitiveTokens.spacing).map(([name, value]) => [
            name,
            value,
            <div className={classes.spaceBar} style={{ inlineSize: `var(--geul-spacing-${name})` }} aria-hidden />,
          ])}
        />
        <Text size="sm">
          At a 16px root: xxs/xs/sm/md/lg/xl = 4/8/10/12/16/24px. The scale does not change automatically with viewport
          width. Use an explicit responsive Layout prop when the relationship must change.
        </Text>
      </DocSection>
      <DocSection title="Roles and owners">
        <DocTable
          caption="primitiveTokens.spacingRole → derivedTokenRoles"
          columns={['Role', 'Alias / value', 'Relationship', 'Owner']}
          rows={roles.map(([role, relationship, owner]) => [
            role,
            `${derivedTokenRoles[`spacing-role-${role}`]} · ${primitiveTokens.spacingRole[role]}`,
            relationship,
            owner,
          ])}
        />
        <Text size="sm">
          Core owns internal gaps and padding. Composition owns external spacing. Layout exposes action-group and
          section as external roles; control-label is not a Layout gap option. A compact Button or compact Toolbar does
          not imply the 4px HeaderDensity gap.
        </Text>
        <SourceNote>
          components/core/design-tokens.ts · Control.module.css · Layout/layout-contract.ts · Section/ToolbarSurface.tsx
        </SourceNote>
      </DocSection>
      <DocSection title="Actual controls and composition">
        <LocalizedSpecimen>
          <LayoutStack gap="section">
            <TextInput
              label={ui('Draft title', '초안 제목')}
              description={ui('Use a title you can recognize later.', '나중에 알아볼 수 있는 제목을 입력하세요.')}
              value={value}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
            <LayoutInline gap="action-group" wrap="wrap">
              <Button
                leftSection={<IconCheck />}
                onClick={() => setSaved(value || ui('Untitled draft', '제목 없는 초안'))}
              >
                {ui('Save draft', '초안 저장')}
              </Button>
              <Button
                emphasis="low"
                onClick={() => {
                  setValue('');
                  setSaved('');
                }}
              >
                {ui('Clear', '비우기')}
              </Button>
            </LayoutInline>
            <Text role="status" size="sm">
              {saved
                ? ui(`Saved locally: ${saved}`, `로컬 저장: ${saved}`)
                : ui('No saved draft.', '저장한 초안이 없습니다.')}
            </Text>
          </LayoutStack>
        </LocalizedSpecimen>
        <CodeExample>{`<LayoutStack gap="section">\n  <TextInput label={label} description={help} />\n  <LayoutInline gap="action-group" wrap="wrap">\n    <Button leftSection={<IconCheck />}>{saveLabel}</Button>\n    <Button emphasis="low">{cancelLabel}</Button>\n  </LayoutInline>\n</LayoutStack>`}</CodeExample>
      </DocSection>
      <DocSection title="Compact header relationship">
        <LocalizedSpecimen>
          <HeaderDensityProvider density="compact">
            <LayoutInline gap="action-group">
              <Button
                size="xs"
                leftSection={<IconCheck />}
                onClick={() => setSaved(value || ui('Untitled draft', '제목 없는 초안'))}
              >
                {ui('Save draft', '초안 저장')}
              </Button>
            </LayoutInline>
          </HeaderDensityProvider>
        </LocalizedSpecimen>
        <CodeExample>{`<HeaderDensityProvider density="compact">\n  <Button size="xs" leftSection={<IconCheck />}>{label}</Button>\n</HeaderDensityProvider>`}</CodeExample>
        <Text size="sm">
          This context selects the 4px internal label–icon gap and compact horizontal padding; the xs target stays 30px
          for fine input and at least 44px for coarse input.
        </Text>
        <StoryLink id="composition-size-and-density--shared-owners">Shared size and density owners</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Spacing',
  component: SpacingRelationships,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof SpacingRelationships>;
export default meta;
export const Relationships: StoryObj<typeof meta> = {};
