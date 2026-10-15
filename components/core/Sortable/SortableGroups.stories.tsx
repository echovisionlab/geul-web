import { Profiler, useCallback, useRef, useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { IconGripVertical } from '@tabler/icons-react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutStack, LayoutInset } from '../Layout';
import { Text } from '../Typography';
import { IconButton } from '../IconButton';
import { SectionCard } from '../Section';
import { Button } from '../Button';
import { TextInput } from '../Input';
import { ReorderRow } from './ReorderRow';
import { interactionBindings } from '../bindings';
import {
  SortableGroups,
  type SortableGroup,
  type SortableItem,
  type RenderGroupProps,
  type RenderItemProps,
} from './SortableGroups';
interface ExampleItem extends SortableItem {
  name: string;
}
interface ExampleGroup extends SortableGroup<ExampleItem> {
  name: string;
}
function SortableGroupsFixture() {
  const [groups, setGroups] = useState<ExampleGroup[]>([
    {
      id: 'first',
      name: 'First group',
      items: [
        { id: 'one', name: 'First item' },
        { id: 'two', name: 'Second item' },
      ],
    },
    { id: 'second', name: 'Second group', items: [{ id: 'three', name: 'Third item' }] },
  ]);
  return (
    <SortableGroups<ExampleGroup, ExampleItem>
      groups={groups}
      onGroupsChange={setGroups}
      getGroupLabel={(group) => group.name}
      getItemLabel={(item) => item.name}
      renderGroup={({ group, children, dragHandleProps, isDropTarget }) => (
        <SectionCard padding="none" appearance="plain" state={isDropTarget ? 'drop-target' : 'default'}>
          <LayoutStack gap="xxs">
            <ReorderRow
              handle={
                <IconButton
                  label={`Reorder ${group.name}`}
                  interaction="drag-handle"
                  draggable={false}
                  {...interactionBindings(dragHandleProps.attributes)}
                  {...interactionBindings(dragHandleProps.listeners)}
                >
                  <IconGripVertical aria-hidden />
                </IconButton>
              }
            >
              <Text size="xs" weight="strong">
                {group.name}
              </Text>
            </ReorderRow>
            <LayoutInset inlineStart="xl">{children}</LayoutInset>
          </LayoutStack>
        </SectionCard>
      )}
      renderItem={({ item, dragHandleProps }) => (
        <ReorderRow
          handle={
            <IconButton
              label={`Reorder ${item.name}`}
              interaction="drag-handle"
              draggable={false}
              {...interactionBindings(dragHandleProps.attributes)}
              {...interactionBindings(dragHandleProps.listeners)}
            >
              <IconGripVertical aria-hidden />
            </IconButton>
          }
        >
          <Text size="xs">{item.name}</Text>
        </ReorderRow>
      )}
    />
  );
}
const meta = {
  title: 'Core/Interaction/SortableGroups',
  component: SortableGroupsFixture,
  parameters: { layout: 'padded' },
  render: () => <SortableGroupsFixture />,
} satisfies Meta<typeof SortableGroupsFixture>;
export default meta;
export const GroupsAndItems: StoryObj<typeof meta> = {};

export const GripHoverGeometry: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Reorder First item' });
    const row = handle.closest('[data-geul-reorder-row]')!;
    const body = row.lastElementChild!;
    const before = { target: handle.getBoundingClientRect(), body: body.getBoundingClientRect() };
    await expect(before.target.width).toBeGreaterThanOrEqual(24);
    await expect(before.target.height).toBeGreaterThanOrEqual(24);
    await expect(before.target.right).toBeLessThanOrEqual(before.body.left);

    // Exercise the same shared hover-state selector as React Aria controls.
    handle.setAttribute('data-hovered', 'true');
    try {
      const after = { target: handle.getBoundingClientRect(), body: body.getBoundingClientRect() };
      const style = canvasElement.ownerDocument.defaultView!.getComputedStyle(handle);
      await expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      await expect(after.target.width).toBe(before.target.width);
      await expect(after.target.height).toBe(before.target.height);
      await expect(after.body.left).toBe(before.body.left);
      await expect(after.body.width).toBe(before.body.width);
    } finally {
      handle.removeAttribute('data-hovered');
    }
    await userEvent.click(handle);
    await userEvent.keyboard(' ');
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await expect(canvasElement.ownerDocument.defaultView!.getComputedStyle(handle).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    );
    await userEvent.keyboard('{ArrowDown} ');
    await expect(handle).toHaveFocus();
    await expect(canvas.getAllByRole('button', { name: /Reorder (First|Second|Third) item/ })[0]).toHaveAttribute(
      'aria-label',
      'Reorder Second item',
    );
  },
};

export const KeyboardItemReorder: StoryObj<typeof meta> = {
  tags: ['a11y-smoke'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Reorder First item' });
    await userEvent.click(handle);
    await userEvent.keyboard(' {ArrowDown} ');
    await expect(handle).toHaveFocus();
    const items = canvas.getAllByRole('button', { name: /Reorder (First|Second|Third) item/ });
    await expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Reorder Second item',
      'Reorder First item',
      'Reorder Third item',
    ]);
  },
};
export const KeyboardCancel: StoryObj<typeof meta> = {
  tags: ['a11y-smoke'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Reorder First item' });
    await userEvent.click(handle);
    await userEvent.keyboard(' {ArrowDown}{Escape}');
    await expect(handle).toHaveFocus();
    const items = canvas.getAllByRole('button', { name: /Reorder (First|Second|Third) item/ });
    await expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Reorder First item',
      'Reorder Second item',
      'Reorder Third item',
    ]);
  },
};

function MotionRenderingFixture() {
  const [groups, setGroups] = useState<ExampleGroup[]>(() => [
    {
      id: 'one',
      name: 'First group',
      items: Array.from({ length: 12 }, (_, index) => ({ id: `field-${index}`, name: `Field ${index + 1}` })),
    },
    { id: 'two', name: 'Empty group', items: [] },
  ]);
  const counts = useRef({ groups: 0, items: 0, commits: 0, duration: 0 });
  const [sample, setSample] = useState({ groups: 0, items: 0, commits: 0, duration: 0 });
  const renderGroup = useCallback(
    ({ group, children, dragHandleProps, isDropTarget }: RenderGroupProps<ExampleGroup, ExampleItem>) => {
      counts.current.groups += 1;
      return (
        <SectionCard padding="none" appearance="plain" state={isDropTarget ? 'drop-target' : 'default'}>
          <ReorderRow
            handle={
              <IconButton
                label={`Reorder ${group.name}`}
                interaction="drag-handle"
                draggable={false}
                {...interactionBindings(dragHandleProps.attributes)}
                {...interactionBindings(dragHandleProps.listeners)}
              >
                <IconGripVertical aria-hidden />
              </IconButton>
            }
          >
            <Text size="xs" weight="strong">
              {group.name}
            </Text>
          </ReorderRow>
          <LayoutStack gap="xxs">{children}</LayoutStack>
        </SectionCard>
      );
    },
    [],
  );
  const renderItem = useCallback(({ item, dragHandleProps }: RenderItemProps<ExampleItem>) => {
    counts.current.items += 1;
    return (
      <ReorderRow
        handle={
          <IconButton
            label={`Reorder ${item.name}`}
            interaction="drag-handle"
            draggable={false}
            {...interactionBindings(dragHandleProps.attributes)}
            {...interactionBindings(dragHandleProps.listeners)}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
        }
      >
        <TextInput aria-label={`${item.name} value`} defaultValue={item.name} />
      </ReorderRow>
    );
  }, []);
  return (
    <LayoutStack gap="sm">
      <Text size="sm">
        Drag the first grip horizontally, then sample the counters. Shell transforms remain live; unchanged field
        content should not render on each movement. React commit timing is available only in a profiling-enabled build.
      </Text>
      <Button onClick={() => setSample({ ...counts.current })}>Sample render counters</Button>
      <output aria-label="Render counter sample" data-render-groups={sample.groups} data-render-items={sample.items}>
        Group renders: {sample.groups}; item renders: {sample.items}; profiling commits: {sample.commits}; React
        duration: {sample.duration.toFixed(2)}ms
      </output>
      <Profiler
        id="SortableGroups motion"
        onRender={(_id, _phase, duration) => {
          counts.current.commits += 1;
          counts.current.duration += duration;
        }}
      >
        <SortableGroups
          groups={groups}
          onGroupsChange={setGroups}
          getGroupLabel={(group) => group.name}
          getItemLabel={(item) => item.name}
          renderGroup={renderGroup}
          renderItem={renderItem}
        />
      </Profiler>
    </LayoutStack>
  );
}

export const MotionRendering: StoryObj<typeof meta> = {
  render: () => <MotionRenderingFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sample = canvas.getByRole('button', { name: 'Sample render counters' });
    await userEvent.click(sample);
    const output = canvas.getByLabelText('Render counter sample');
    const before = {
      groups: Number(output.getAttribute('data-render-groups')),
      items: Number(output.getAttribute('data-render-items')),
    };
    const handle = canvas.getByRole('button', { name: 'Reorder Field 1' });
    const rect = handle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    await userEvent.pointer([
      { target: handle, keys: '[MouseLeft>]', coords: { clientX: x, clientY: y } },
      { target: handle, coords: { clientX: x + 12, clientY: y } },
      { target: handle, coords: { clientX: x + 24, clientY: y } },
      { target: handle, coords: { clientX: x + 36, clientY: y } },
      { target: handle, keys: '[/MouseLeft]', coords: { clientX: x + 36, clientY: y } },
    ]);
    await userEvent.click(sample);
    await expect(Number(output.getAttribute('data-render-items')) - before.items).toBeLessThanOrEqual(2);
    await expect(Number(output.getAttribute('data-render-groups')) - before.groups).toBeLessThanOrEqual(2);
    await expect(handle).not.toHaveAttribute('aria-pressed', 'true');
  },
};
