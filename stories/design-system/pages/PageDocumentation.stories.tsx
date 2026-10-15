import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageDocumentationBrowser } from './PageDocumentation';

const meta = {
  title: 'Design System/Pages',
  component: PageDocumentationBrowser,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Page task contracts, production owner and route source mappings, local fixture states, excluded service behavior and viewport review criteria. Existing Pages stories are linked rather than duplicated. Generated source coverage and implemented examples remain separate from browser, assistive technology and service verification results.',
      },
    },
  },
  args: { initialRoute: '/login' },
  argTypes: {
    initialRoute: {
      control: 'text',
      description: 'Initial source selection. Does not request or serve the application route.',
    },
  },
  render: (args) => <PageDocumentationBrowser key={args.initialRoute} {...args} />,
} satisfies Meta<typeof PageDocumentationBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Browse: Story = {};
export const Login: Story = { args: { initialRoute: '/login' } };
export const PublicForm: Story = { args: { initialRoute: '/forms/[slug]' } };
export const PostEditor: Story = { args: { initialRoute: '/posts/[idOrSlug]' } };
export const AdminContent: Story = { args: { initialRoute: '/admin/posts' } };
export const BlockedRoute: Story = { args: { initialRoute: '/admin/forms/[id]/submissions' } };
export const RedirectRoute: Story = { args: { initialRoute: '/files' } };
