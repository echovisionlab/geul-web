import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutInline, LayoutStack } from '../Layout';
import { TextButton } from '../TextButton';
import { TableRowMenu } from './TableRowMenu';

const meta = {
  title: 'Core/Data Display/TableRowMenu',
  component: TableRowMenu,
  args: { 'aria-label': 'Actions for Ada', items: [] },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Return the whole command promise from items[].onClick. Core dismisses the menu as usual, shows progress on the named row trigger and prevents other row commands until settlement. Resolve restores the trigger; rejection calls items[].onError and restores retry without claiming success. The Feature owns domain notifications and failure semantics. Without onError, Core logs rejection. A void callback stays synchronous; fire-and-forget work cannot be tracked. Links, disabled items, keyboard navigation and dismissal retain their normal behavior.',
      },
    },
  },
} satisfies Meta<typeof TableRowMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'Actions for Ada',
    items: [
      { label: 'Edit', href: '#edit' },
      { label: 'Delete', tone: 'danger', onClick: () => undefined },
    ],
  },
};

function PendingExample() {
  const settlement = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('Open the row menu and choose Unban.');
  return (
    <LayoutStack gap="sm">
      <TableRowMenu
        aria-label="Actions for Ada"
        items={[
          {
            label: 'Unban',
            onClick: () => {
              setPending(true);
              setMessage('Unbanning Ada');
              return new Promise<void>((resolve, reject) => {
                settlement.current = { resolve, reject };
              });
            },
            onError: () => {
              setMessage('Unban failed. Try again from the row menu.');
            },
          },
        ]}
      />
      <LayoutInline gap="sm">
        <TextButton
          disabled={!pending}
          onClick={() => {
            settlement.current?.resolve();
            setPending(false);
            setMessage('Ada was unbanned.');
          }}
        >
          Resolve action
        </TextButton>
        <TextButton
          disabled={!pending}
          onClick={() => {
            settlement.current?.reject(new Error('Example failure'));
            setPending(false);
          }}
        >
          Reject action
        </TextButton>
      </LayoutInline>
      <span role="status">{message}</span>
    </LayoutStack>
  );
}

export const ReturnedPromise: Story = { render: () => <PendingExample /> };
