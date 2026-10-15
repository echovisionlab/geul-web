import type { Meta, StoryObj } from '@storybook/nextjs';
import { Text } from '@/components/core/Typography';
import { DocSection, DocTable, FoundationDoc, SourceNote, StoryLink } from './FoundationDocs';

function ReviewCanvas() {
  return (
    <FoundationDoc
      title="Review canvas standard"
      description="The canvas is a working specimen with a known context. Documentation, interactive states and actual page fixtures need different frames and explicit evidence."
    >
      <DocSection title="Frame and context">
        <DocTable
          caption="Shared preview framing"
          columns={['Area', 'Rule', 'Owner']}
          rows={[
            [
              'Context strip',
              'Story title, state, current language and theme remain outside the specimen.',
              '.storybook/StoryCanvas.tsx',
            ],
            ['Theme surface', 'background / text-primary', 'DesignSystemProvider → semanticThemes'],
            [
              'Foundation document',
              '16px named lg gutter; standard content width; section relationships.',
              'FoundationDocs.module.css',
            ],
            [
              'Core specimen',
              'Shared canvas inset; the control owns its interior. State labels belong outside the control.',
              'StoryCanvas / Core',
            ],
            [
              'Product page',
              'Keep the real frame and its gutter; no second decorative frame around it.',
              'Actual PageView / route fixture',
            ],
          ]}
        />
        <Text size="sm">
          Do not arrange hundreds of independent specimens on a fixed giant canvas. Group by task or state axis, keep
          each group readable at a narrow width, and link directly to the focused story.
        </Text>
        <SourceNote>
          .storybook/preview.tsx · .storybook/StoryCanvas.tsx · stories/foundations/FoundationDocs.tsx
        </SourceNote>
      </DocSection>
      <DocSection title="Required specimen context">
        <DocTable
          caption="Document once; verify per scenario"
          columns={['Field', 'Required detail']}
          rows={[
            ['Identity', 'Public export, source owner and a direct story link.'],
            ['Task', 'Who acts, expected result and recovery path.'],
            ['State', 'Data and availability, supported combinations and transitions.'],
            ['Environment', 'Viewport, theme, locale/direction, pointer and relevant zoom.'],
            ['Dependencies', 'Real view vs composition; fixture data, navigation and service adapters.'],
            ['Evidence', 'What was executed, which assertion passed or failed, and what remains untested.'],
          ]}
        />
      </DocSection>
      <DocSection title="Review in this order">
        <DocTable
          caption="Specimen → actual user task"
          columns={['Scope', 'Check']}
          rows={[
            ['Tokens', 'Role, alias, unit and theme interpretation.'],
            ['Core', 'API, anatomy, state, geometry and keyboard contract.'],
            ['Composition', 'Action rows, form relationships, scrolling and focus return.'],
            ['Page', 'Entry, normal/empty/loading/error/permission states, execution and recovery.'],
            ['Environment', 'Small phone, phone, tablet, desktop and relevant transition boundaries.'],
          ]}
        />
        <Text size="sm">
          Compare the same production owner across themes and widths. A fixture adapter may replace service responses;
          it must not replace the visual component with a lookalike. A composition preview is not route coverage.
        </Text>
        <StoryLink id="pages-application-frames--public">Application frame specimen</StoryLink>
        <StoryLink id="foundations-responsive--reference">Viewport and boundary matrix</StoryLink>
      </DocSection>
      <DocSection title="Completion evidence">
        <Text size="sm">
          Keep automated contract tests, browser interactions, visual review and assistive-technology checks distinct.
          Record the actual scope and remaining items. A catalog count or an a11y panel with no errors does not certify
          the whole system.
        </Text>
        <StoryLink id="foundations-accessibility-and-motion--criteria">Accessibility and motion criteria</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Review Canvas',
  component: ReviewCanvas,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ReviewCanvas>;
export default meta;
export const Standard: StoryObj<typeof meta> = {};
