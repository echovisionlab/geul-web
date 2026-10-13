import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { NativeSelect, TextInput } from '@/components/core/Input';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { TextButton } from '@/components/core/TextButton';
import { Heading, List, Text } from '@/components/core/Typography';
import { Table } from '@/components/core/Display';
import { Disclosure } from '@/components/core/Disclosure';
import { PreviewFrame } from '../../shared/PreviewFrame';
import { StorybookLink } from '../../shared/StorybookLink';
import { handbookDocumentId } from '../handbook-navigation';
import registry from './component-docs.generated.json';

function GuidanceList({ items }: { items: string[] }) {
  return (
    <List size="sm" spacing="xs">
      {items.map((item) => (
        <List.Item key={item}>
          <Text size="sm" wrap="anywhere">
            {item}
          </Text>
        </List.Item>
      ))}
    </List>
  );
}

function ComponentsCatalog() {
  const [query, setQuery] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('Core/Actions/Button');
  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return registry.components.filter((component) =>
      `${component.title} ${component.summary} ${component.api.map((property) => property.name).join(' ')}`
        .toLocaleLowerCase()
        .includes(search),
    );
  }, [query]);
  const selected = registry.components.find((component) => component.title === selectedTitle);
  const permittedApi = selected?.api.filter((property) => property.type !== 'never') ?? [];
  const forbiddenApi = selected?.api.filter((property) => property.type === 'never') ?? [];
  return (
    <PreviewFrame
      wide
      title="Component documentation"
      description="Review purpose, anatomy, API, states, accessibility and consumers. State links open examples using actual Core components."
    >
      <LayoutStack gap="lg" lang="en" dir="ltr">
        <TextInput
          label="Search components or APIs"
          placeholder="Button, labelWrap, input…"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Text size="sm" tone="secondary" aria-live="polite">
          {matches.length} / {registry.components.length} documents
        </Text>
        <NativeSelect
          label="Core components"
          description="Select a component to review its role and API. Search narrows the list."
          value={selectedTitle}
          data={(matches.some((component) => component.title === selectedTitle) || !selected
            ? matches
            : [selected, ...matches]
          ).map((component) => ({ value: component.title, label: component.title }))}
          onChange={(event) => setSelectedTitle(event.currentTarget.value)}
        />
        {!matches.length ? <Text size="sm">No matching components.</Text> : null}
        <LayoutStack gap="lg" lang="en">
          {selected ? (
            <SectionCard>
              <LayoutStack gap="md">
                <Heading level={2} scale={2}>
                  {selected.title}
                </Heading>
                <Text size="sm" wrap="anywhere">
                  {selected.summary}
                </Text>
                <SectionHeader title="Anatomy" />
                <GuidanceList items={selected.anatomy} />
                <SectionHeader title="Usage guidance" />
                <GuidanceList items={selected.usage.filter((item) => !item.startsWith('Consumer: '))} />
                <SectionHeader title="Accessibility" />
                <GuidanceList items={selected.accessibility} />
                <SectionHeader title="Constraints and review scope" />
                <GuidanceList items={selected.constraints} />
                <SectionHeader
                  title="State examples"
                  description="Open one state at a time to review behavior and presentation."
                />
                <LayoutInline gap="action-group" wrap="wrap">
                  {selected.stateStories.map((story) => (
                    <TextButton key={story.id} href={`/?path=/story/${story.id}`} target="_top" appearance="accent">
                      {story.name}
                    </TextButton>
                  ))}
                </LayoutInline>
                {selected.stateStories[0] ? (
                  <StorybookLink href={`/?path=/docs/${selected.stateStories[0].id.split('--')[0]}--documentation`}>
                    Open API documentation and live example
                  </StorybookLink>
                ) : null}
              </LayoutStack>
            </SectionCard>
          ) : null}
        </LayoutStack>
        {selected ? (
          <SectionCard>
            <LayoutStack gap="md">
              <SectionHeader
                title={`${selected.title} · Public API`}
                description="Required means required in every union branch. Read action/link, name and geometry constraints above. Defaults are shown only when explicit in the implementation."
              />
              {permittedApi.length ? (
                <Table.ScrollContainer aria-label="Component API">
                  <Table density="compact" aria-label={`${selected.title} Public API`}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Property</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Required</Table.Th>
                        <Table.Th>Explicit default</Table.Th>
                        <Table.Th>Description</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {permittedApi.map((property) => (
                        <Table.Tr key={property.name}>
                          <Table.Td>
                            <Text size="xs" font="mono" wrap="anywhere">
                              {property.name}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" font="mono" wrap="anywhere">
                              {property.type}
                            </Text>
                          </Table.Td>
                          <Table.Td>{property.required ? 'Required' : 'Conditional / optional'}</Table.Td>
                          <Table.Td>
                            <Text size="xs" font="mono" wrap="anywhere">
                              {'defaultValue' in property ? property.defaultValue : '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" wrap="anywhere">
                              {'description' in property ? property.description : '—'}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              ) : (
                <Text size="sm">
                  No API table is extracted for this group. Check the linked components and sources; fixture props and
                  unresolved types do not establish a public contract.
                </Text>
              )}
              {forbiddenApi.length ? (
                <Disclosure label={`Unsupported properties (${forbiddenApi.length})`}>
                  <LayoutStack gap="xs">
                    <Text size="sm">
                      These properties are closed with never in the public type. They cannot bypass styling or internal
                      state.
                    </Text>
                    <Text size="xs" font="mono" wrap="anywhere">
                      {forbiddenApi.map((property) => property.name).join(', ')}
                    </Text>
                  </LayoutStack>
                </Disclosure>
              ) : null}
              <Disclosure label="Source files and consumers">
                <GuidanceList items={selected.sourceFiles} />
                <GuidanceList items={selected.usage.filter((item) => item.startsWith('Consumer: '))} />
              </Disclosure>
              <SectionHeader title="Related specifications" />
              <List size="sm" spacing="xs">
                {selected.relatedDocs.map((file) => (
                  <List.Item key={file}>
                    <StorybookLink
                      href={`/?path=/story/design-system-handbook--reference&args=initialDocument:${handbookDocumentId(file)}`}
                    >
                      {file}
                    </StorybookLink>
                  </List.Item>
                ))}
              </List>
            </LayoutStack>
          </SectionCard>
        ) : null}
      </LayoutStack>
    </PreviewFrame>
  );
}

const meta = {
  title: 'Design System/Components',
  component: ComponentsCatalog,
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta<typeof ComponentsCatalog>;
export default meta;
export const Catalog: StoryObj<typeof meta> = {};
