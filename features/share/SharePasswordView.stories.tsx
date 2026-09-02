import type { Meta, StoryObj } from '@storybook/nextjs';

import { SharePasswordView } from './SharePasswordView';

const meta = {
  title: 'Feature/Share/SharePasswordView',
  component: SharePasswordView,
  args: {
    pending: false,
    labels: {
      title: 'Password required',
      description: 'Enter the password supplied with this share link.',
      password: 'Password',
      submit: 'Open page',
    },
  },
} satisfies Meta<typeof SharePasswordView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: { password: '', onPasswordChange: () => {} },
};

export const IncorrectPassword: Story = {
  args: {
    password: 'wrong',
    onPasswordChange: () => {},
    error: 'Incorrect password.',
  },
};

export const Release: Story = {
  args: {
    password: '',
    onPasswordChange: () => {},
    labels: {
      ...meta.args.labels,
      submit: 'Open release',
    },
  },
};
