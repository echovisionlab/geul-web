import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutGrid, LayoutStack } from '@/components/core/Layout';
import { Heading, Text } from '@/components/core/Typography';
import { breakpointQuery, type Breakpoint } from '@/components/core/Layout/breakpoints';
import { primitiveTokens } from '@/components/core/design-tokens';
import { CodeExample, DocSection, DocTable, FoundationDoc, SourceNote, StoryLink } from './FoundationDocs';
import classes from './FoundationDocs.module.css';

function ResponsiveReference() {
  return (
    <FoundationDoc
      title="Responsive layout"
      description="Mobile, tablet and desktop are review contexts. Shared breakpoints describe layout transitions; content widths constrain reading and form surfaces."
    >
      <DocSection title="Production breakpoints">
        <DocTable
          caption="primitiveTokens.breakpoints"
          columns={['Name', 'Source', 'Below', 'At least']}
          rows={Object.entries(primitiveTokens.breakpoints).map(([name, value]) => [
            name,
            value,
            breakpointQuery(name as Breakpoint, 'below'),
            breakpointQuery(name as Breakpoint, 'at-least'),
          ])}
        />
        <Text size="sm">
          At a default 16px media-query reference these values correspond to 576/768/992/1200/1408px. They do not
          identify a specific device. Below excludes the boundary; at-least owns it. Check the boundary and both
          adjacent widths.
        </Text>
        <SourceNote>
          components/core/design-tokens.ts · components/core/Layout/breakpoints.ts · generated PostCSS
          $mantine-breakpoint-* compatibility variables
        </SourceNote>
      </DocSection>
      <DocSection title="Content maximums">
        <DocTable
          caption="primitiveTokens.contentWidth"
          columns={['Role', 'Maximum', 'Use']}
          rows={Object.entries(primitiveTokens.contentWidth).map(([name, value]) => [
            name,
            value,
            name === 'form'
              ? 'Single-column authentication/account forms.'
              : name === 'reading'
                ? 'Running-prose measure of long documents (posts); about 75–80 Latin characters at md body size.'
                : 'Core LayoutContainer content surface and document breakout width.',
          ])}
        />
        <Text size="sm">
          A maximum width does not create a breakpoint. Screens consume LayoutContainer and responsive named Layout
          props; do not copy the pixel values into feature CSS.
        </Text>
      </DocSection>
      <DocSection title="Actual responsive grid">
        <LayoutGrid columns={{ base: 1, sm: 2, md: 3 }} gap={{ base: 'sm', sm: 'lg' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} className={classes.sample}>
              <LayoutStack gap="xs">
                <Heading level={3} scale={5}>
                  {`Section ${item}`}
                </Heading>
                <Text size="sm">
                  This is the same Core LayoutGrid at every width. Resize the viewport to review wrapping and reading
                  order.
                </Text>
              </LayoutStack>
            </div>
          ))}
        </LayoutGrid>
        <CodeExample>{`<LayoutGrid\n  columns={{ base: 1, sm: 2, md: 3 }}\n  gap={{ base: 'sm', sm: 'lg' }}\n>\n  {sections}\n</LayoutGrid>`}</CodeExample>
      </DocSection>
      <DocSection title="Review matrix">
        <DocTable
          caption="Representative viewports plus boundaries"
          columns={['Context', 'Viewport', 'Check']}
          rows={[
            ['Small phone / reflow', '320 × 640', 'Essential content, controls and overflow.'],
            ['Phone', '390 × 844', 'Long labels, action wrapping, touch targets.'],
            ['Tablet', '834 × 1112', 'Columns, navigation and touch input.'],
            ['Desktop', '1440 × 900', 'Content maximums, density and keyboard flow.'],
            [
              'Boundary / low height / zoom',
              'Transition −1 / exact / +1; task-specific height.',
              'Sticky UI, overlays, focus visibility and reading.',
            ],
          ]}
        />
        <Text size="sm">
          Viewport width does not imply coarse pointer input. Test touch capability separately. Treat document editors,
          maps and other essential 2D surfaces according to their own overflow contract.
        </Text>
        <StoryLink id="core-layout-primitives--responsive-grid">Core responsive grid</StoryLink>
        <StoryLink id="pages-application-frames--public">Actual application frame</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Responsive',
  component: ResponsiveReference,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ResponsiveReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = {};
export const Phone: StoryObj<typeof meta> = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const Tablet: StoryObj<typeof meta> = { globals: { viewport: { value: 'tablet', isRotated: false } } };
export const Desktop: StoryObj<typeof meta> = { globals: { viewport: { value: 'desktop', isRotated: false } } };
