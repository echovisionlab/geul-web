import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender, useStorybookText } from '@/.storybook/fixture-i18n';
import { LayoutStack, LayoutInline } from '../Layout';
import { Avatar, ScrollArea, Separator, Skeleton, Spinner, Table } from './Display';
import { Pagination } from './Pagination';
const meta: Meta = { title: 'Core/Data Display/Display', parameters: { layout: 'padded' }, tags: ['core-display'] };
export default meta;
type Story = StoryObj;
export const States: Story = {
  name: 'Avatar states',
  render: localizedRender(() => (
    <LayoutInline gap="md">
      <Avatar alt="Artist" size="sm">
        AR
      </Avatar>
      <Avatar alt="Label" shape="square" size="md">
        LB
      </Avatar>
    </LayoutInline>
  )),
};
export const AvatarInitials: Story = {
  name: 'Avatar name initials',
  render: () => (
    <LayoutInline gap="md">
      <Avatar name="june han" size="sm" />
      <Avatar name="한글 사용자" size="sm" />
      <Avatar name="émile" size="md" />
      <Avatar name="Release title" shape="square" size="md" />
      <Avatar name={null} size="md" />
    </LayoutInline>
  ),
};
export const LoadingIndicators: Story = {
  render: localizedRender(() => (
    <LayoutInline gap="md">
      <Spinner size="xs" aria-label="Loading" />
      <Spinner tone="danger" aria-label="Retrying" />
    </LayoutInline>
  )),
};
export const ContentSeparator: Story = { render: localizedRender(() => <Separator label="Content" />) };
export const SkeletonStates: Story = {
  render: () => (
    <LayoutStack gap="xs">
      <Skeleton roleType="heading" width="medium" />
      <Skeleton roleType="text" width="long" />
    </LayoutStack>
  ),
};
export const TableStates: Story = {
  render: localizedRender(() => (
    <Table bordered highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th align="end">Value</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        <Table.Tr>
          <Table.Td>Selected item</Table.Td>
          <Table.Td align="end">12</Table.Td>
        </Table.Tr>
        <Table.Tr disabled>
          <Table.Td>Unavailable item</Table.Td>
          <Table.Td align="end">0</Table.Td>
        </Table.Tr>
        <Table.Tr dimmed>
          <Table.Td>Muted item</Table.Td>
          <Table.Td align="end">5</Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  )),
};
export const ScrollableContent: Story = {
  render: localizedRender(() => (
    <ScrollArea.Autosize size="compact" aria-label="Items">
      <LayoutStack gap="xs">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i}>Item {i + 1}</span>
        ))}
      </LayoutStack>
    </ScrollArea.Autosize>
  )),
};
export const PageNavigation: Story = {
  render: localizedRender(() => {
    const [page, setPage] = useState(1);
    const text = useStorybookText();
    return (
      <Pagination
        total={99}
        value={page}
        onChange={setPage}
        labels={{
          previousPage: text('Previous page'),
          nextPage: text('Next page'),
          page: (n) => text('Page {page}', { page: n }),
        }}
      />
    );
  }),
};
/** URL-owned pages: anchors with hrefs, first/last bounds, and current page as aria-current link. */
export const LinkPageNavigation: Story = {
  name: 'Page navigation links',
  render: localizedRender(() => {
    // Stands in for the route's search params; onNavigate keeps the Storybook frame on this story.
    const [page, setPage] = useState(5);
    const text = useStorybookText();
    return (
      <Pagination
        aria-label={text('Pagination')}
        total={12}
        value={page}
        getHref={(n) => `?page=${n}`}
        onNavigate={(event) => {
          event.preventDefault();
          setPage(event.page);
        }}
        labels={{
          firstPage: text('First page'),
          previousPage: text('Previous page'),
          nextPage: text('Next page'),
          lastPage: text('Last page'),
          page: (n) => text('Page {page}', { page: n }),
        }}
      />
    );
  }),
};
