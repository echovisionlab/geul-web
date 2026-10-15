import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutContainer } from '@/components/core/Layout';
import AdminEmailsPage from '@/app/admin/emails/page';
const meta = {
  title: 'Pages/Admin/Email Events',
  component: AdminEmailsPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual production email events page. The route provides notices explaining removed database logs and the external dashboard; no fabricated event table or transport.',
      },
    },
  },
  decorators: [
    (Story) => (
      <LayoutContainer size="wide" inset="md">
        <Story />
      </LayoutContainer>
    ),
  ],
} satisfies Meta<typeof AdminEmailsPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Notices: Story = {};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
