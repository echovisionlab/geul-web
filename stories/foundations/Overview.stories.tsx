import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutGrid, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Heading, Text } from '@/components/core/Typography';
import { DocSection, DocTable, FoundationDoc, SourceNote, StoryLink } from './FoundationDocs';

function Overview() {
  const chapters = [
    {
      title: 'Foundations',
      description: 'Definitions, roles and review rules read from the production source.',
      links: [
        ['Principles and ownership', 'foundations-principles--ownership'],
        ['Complete token reference', 'foundations-tokens--reference'],
        ['Palette and theme roles', 'foundations-material-palette--grades'],
        ['Typography and locale fonts', 'foundations-typography--reference'],
        ['Spacing and gap relationships', 'foundations-spacing--relationships'],
        ['Icon glyph and control target', 'foundations-iconography--glyph-and-target'],
        ['Size and density', 'foundations-size-and-density--reference'],
        ['Responsive layout', 'foundations-responsive--reference'],
        ['Review canvas standard', 'foundations-review-canvas--standard'],
        ['Accessibility and motion', 'foundations-accessibility-and-motion--criteria'],
      ],
    },
    {
      title: 'Core components',
      description:
        'Actual production owners, public APIs, state and content fixtures. Open Docs for the contract and Canvas for execution.',
      links: [
        ['Component contract catalog', 'design-system-components--catalog'],
        ['Button', 'core-actions-button--playground'],
        ['IconButton', 'core-actions-iconbutton--button-aligned-sizes'],
        ['TextButton', 'core-actions-textbutton--long-menu-label'],
        ['Input state matrix', 'core-input-input-states--state-matrix'],
        ['TextInput', 'core-input-textinput--playground'],
        ['Select', 'core-input-select--playground'],
        ['Checkbox', 'core-input-checkbox--playground'],
        ['DropdownMenu', 'core-navigation-dropdownmenu--playground'],
        ['Tabs', 'core-navigation-tabs--playground'],
        ['FormModal', 'core-overlays-formmodal--playground'],
        ['Core Layout', 'core-layout-primitives--responsive-grid'],
      ],
    },
    {
      title: 'Compositions and features',
      description:
        'Controls working together for a task. Domain state and local services are explicit; a pattern alone is not route coverage.',
      links: [
        ['Pattern documentation', 'design-system-patterns--form'],
        ['Validated form', 'composition-form--playground'],
        ['Filter, sort and select', 'composition-data-table--playground'],
        ['Shared size/density owners', 'composition-size-and-density--shared-owners'],
        ['Admin workspace pattern', 'composition-admin-workspace--workspace'],
        ['Profile form', 'feature-my-profileform--populated'],
        ['Editor runtime', 'feature-editor-tiptap-playground--editor'],
      ],
    },
    {
      title: 'Product pages',
      description:
        'Production views and route sections with deterministic local adapters. Review task flow, layout, failure and recovery in their stated scope.',
      links: [
        ['Page contract catalog', 'design-system-pages--browse'],
        ['Application frame', 'pages-application-frames--public'],
        ['Admin frame', 'pages-application-frames--admin'],
        ['Account profile', 'pages-account-settings--profile'],
        ['Account security', 'pages-account-settings--security'],
        ['Email verification', 'pages-auth-verification--flow'],
        ['Public series', 'pages-public-series--populated'],
        ['Share password gate', 'pages-share-password-gate--locked'],
      ],
    },
  ];
  return (
    <FoundationDoc
      title="Geul design system"
      description="The repository owns the adopted tokens, theme and Core contracts. Storybook is the shared documentation and working review surface for components, patterns and product pages."
    >
      <DocSection title="How to use this system">
        <Text size="sm">
          Read the rule and choose an existing owner → inspect its public API and states → compose the actual task →
          review content, layout and interaction → record evidence and remaining work. Documentation stays English.
          Theme and Locale apply to the same running product specimen; custom themes keep the shared semantic roles.
        </Text>
        <SourceNote>
          components/core/design-tokens.ts · theme.ts · components/core/** · docs/design-system.md
        </SourceNote>
        <StoryLink id="design-system-handbook--reference">System handbook and source documents</StoryLink>
        <StoryLink id="design-system-handbook--getting-started">Get started</StoryLink>
        <StoryLink id="design-system-handbook--contribution">Propose and review a change</StoryLink>
        <StoryLink id="design-system-usage-rules--action-emphasis">Correct and incorrect usage</StoryLink>
        <DocTable
          caption="What each view tells you"
          columns={['View', 'Purpose', 'Limit']}
          rows={[
            ['Docs', 'Usage, API, rules, source and examples.', 'A documented rule still needs execution evidence.'],
            [
              'Canvas',
              'Run the actual view with selected state and globals.',
              'A fixture may replace services; its stated scope remains.',
            ],
            [
              'a11y / interactions',
              'Execute automated rules and scenario assertions.',
              'Manual and assistive-technology review remain separate.',
            ],
          ]}
        />
      </DocSection>
      <LayoutGrid columns={{ base: 1, md: 2 }} gap="section">
        {chapters.map((chapter) => (
          <SectionCard key={chapter.title}>
            <LayoutStack gap="md">
              <Heading level={2} scale={4}>
                {chapter.title}
              </Heading>
              <Text size="sm" tone="secondary">
                {chapter.description}
              </Text>
              <LayoutStack gap="xs">
                {chapter.links.map(([label, id]) => (
                  <StoryLink key={id} id={id}>
                    {label}
                  </StoryLink>
                ))}
              </LayoutStack>
            </LayoutStack>
          </SectionCard>
        ))}
      </LayoutGrid>
      <DocSection title="Find the actual page source">
        <Text size="sm">
          The route inventory maps source owners to previews and states the scope. Open the mapped preview and check its
          local dependencies before treating it as a full page.
        </Text>
        <StoryLink id="design-system-pages--browse">Search production routes and page contracts</StoryLink>
      </DocSection>
      <DocSection title="Review status">
        <Text size="sm">
          This catalog documents current source contracts and fixtures. It does not certify every component, viewport or
          assistive technology. Review results must identify the executed scenario and remaining work; counts are not
          completion rates.
        </Text>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Overview',
  component: Overview,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Start here: ownership, foundations, component contracts, compositions, page sources and review scope.',
      },
    },
  },
} satisfies Meta<typeof Overview>;
export default meta;
export const Start: StoryObj<typeof meta> = {};
