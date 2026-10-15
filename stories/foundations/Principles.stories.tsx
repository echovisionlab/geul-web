import type { Meta, StoryObj } from '@storybook/nextjs';
import { Text } from '@/components/core/Typography';
import { CodeExample, DocSection, DocTable, FoundationDoc, SourceNote, StoryLink } from './FoundationDocs';

function Principles() {
  return (
    <FoundationDoc
      title="Principles and ownership"
      description="Adopted product definitions live in the repository. Storybook is their documentation and review surface. Each story identifies the actual owner and the limits of its fixture."
    >
      <DocSection title="One owner for each decision">
        <DocTable
          caption="System → composition → product"
          columns={['Layer', 'Owns', 'Must use']}
          rows={[
            [
              'Tokens / theme',
              'Meaning, scale, theme and input capability.',
              'components/core/design-tokens.ts · lib/theme/themes.ts · theme.ts',
            ],
            [
              'Core',
              'Public props, slots, internal geometry, state and accessibility contracts.',
              'components/core/**',
            ],
            [
              'Composition',
              'Relationships between controls and reusable task patterns.',
              'Core Layout and component APIs.',
            ],
            [
              'Feature',
              'Data, permissions, mutations and domain behavior.',
              'Core contracts; fixture adapters for stories.',
            ],
            [
              'Page',
              'Route composition, task flow, reading order and recovery.',
              'Actual views with explicit local dependencies.',
            ],
          ]}
        />
        <Text size="sm">
          Start with an existing role or component. Add a token or variant only when a repeated meaning or supported
          user state cannot be expressed. Do not patch shared controls with local CSS.
        </Text>
        <SourceNote>AGENTS.md · docs/design-system.md · components/core/visual-contract.ts</SourceNote>
      </DocSection>
      <DocSection title="Command emphasis">
        <DocTable
          caption="Current Geul action policy"
          columns={['Context', 'Choice']}
          rows={[
            ['General commands and connection management', 'Button: neutral / medium; secondary: low'],
            ['Specified dialog primary action: save, upload, insert or submit', 'Button: strong'],
            ['Final destructive confirmation', 'Confirmation Feature: danger / strong'],
            ['Navigation, dismiss and row actions', 'medium / low'],
          ]}
        />
        <Text size="sm">
          An action name such as “submit” does not by itself authorize a filled or full-width CTA. Keep content width
          and the existing shared action row unless the task requires another documented contract.
        </Text>
        <StoryLink id="core-actions-button--playground">Button</StoryLink>
      </DocSection>
      <DocSection title="Required component documentation">
        <CodeExample>{`Purpose / use and non-use conditions\nOwner / public export / actual consumers\nAnatomy / slots / permitted API and defaults\nValid state combinations / unsupported cases\nTokens / geometry / wrapping and overflow\nKeyboard / name / role / state / focus / errors\nLive examples / local dependencies / verification limits\nChange impact / compatibility / migration`}</CodeExample>
        <Text size="sm">
          Write observable rules: condition → behavior → how to check. Keep explanation in documentation and task copy
          in the product UI.
        </Text>
      </DocSection>
      <DocSection title="Change and review">
        <DocTable
          caption="Review sequence"
          columns={['Step', 'Evidence']}
          rows={[
            ['1', 'Read the owner, its consumers and existing story before changing it.'],
            ['2', 'Change the owning definition and the affected consumers.'],
            ['3', 'Document allowed/blocked API and reproduce affected states in Storybook.'],
            ['4', 'Review light/dark, content length, locales and viewport boundaries.'],
            ['5', 'Record executed checks and remaining manual work separately.'],
          ]}
        />
        <Text size="sm">
          A story existing, a token check passing or a screenshot looking aligned is not evidence that every behavior is
          approved. Keep unreviewed states visible. Preserve meaningful source identity when reorganizing the catalog.
        </Text>
        <StoryLink id="foundations-review-canvas--standard">Review canvas and completion evidence</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Principles',
  component: Principles,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Principles>;
export default meta;
export const Ownership: StoryObj<typeof meta> = {};
