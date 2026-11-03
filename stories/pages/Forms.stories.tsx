import { expect, userEvent, waitFor, within } from 'storybook/test';
import { navigatePreview } from '../shared/preview-navigation';
import { withStackedBrand } from '../shared/stacked-brand';
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { PublicFormView, type PublicFormBindings } from '@/features/form/PublicFormView';
import { FormSuccessPageView } from '@/features/form/FormSuccessPageView';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
import type { PublicFormData } from '@/lib/actions/form';
import type { AccessReason } from '@/lib/types/form/model';
export function FormPagePreview({
  surface = 'response',
  reason = 'password_required',
  actionFailed = false,
  scenario = 'standard',
  submitState = 'ready',
}: {
  surface?: 'response' | 'success' | 'access';
  reason?: AccessReason;
  actionFailed?: boolean;
  scenario?: 'standard' | 'all-fields' | 'conditional';
  submitState?: 'ready' | 'pending' | 'fail-once';
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [attempts] = useState(() => ({ count: 0 }));
  const [submitted, setSubmitted] = useState(false);
  const form = useMemo<PublicFormData>(
    () => ({
      id: 'page-preview',
      title: 'Listening Room',
      slug: 'listening-room',
      status: 'published',
      isPublic: true,
      requireAuth: false,
      allowedRoles: [],
      allowDuplicateSubmission: true,
      hasPassword: false,
      schema: {
        id: 'page-preview',
        steps:
          scenario === 'all-fields'
            ? [
                {
                  id: 'all-fields',
                  title: 'Response fields',
                  fields: [
                    { id: 'text', key: 'text', type: 'text', label: 'Text response', description: 'Short answer' },
                    { id: 'email', key: 'email', type: 'email', label: 'Email response' },
                    { id: 'notes', key: 'notes', type: 'textarea', label: 'Long response' },
                    { id: 'number', key: 'number', type: 'number', label: 'Number response' },
                    { id: 'date', key: 'date', type: 'date', label: 'Date response' },
                    { id: 'phone', key: 'phone', type: 'tel', label: 'Phone response' },
                    {
                      id: 'select',
                      key: 'select',
                      type: 'select',
                      label: 'Single response',
                      options: [
                        { label: 'Morning', value: 'morning' },
                        { label: 'Evening', value: 'evening' },
                      ],
                    },
                    {
                      id: 'multiselect',
                      key: 'multiselect',
                      type: 'multiselect',
                      label: 'Multiple responses',
                      options: [
                        { label: 'Sound', value: 'sound' },
                        { label: 'Image', value: 'image' },
                      ],
                    },
                    {
                      id: 'checkbox',
                      key: 'checkbox',
                      type: 'checkbox',
                      label: 'Consent response',
                      checkboxLabel: 'I agree',
                    },
                    { id: 'switch', key: 'switch', type: 'switch', label: 'Notification response' },
                  ],
                },
              ]
            : scenario === 'conditional'
              ? [
                  {
                    id: 'choices',
                    title: 'Response options',
                    fields: [
                      { id: 'extra', key: 'extra', type: 'checkbox', label: 'Additional response' },
                      {
                        id: 'conditional',
                        key: 'conditional',
                        type: 'text',
                        label: 'Conditional response',
                        condition: { fieldId: 'extra', operator: 'eq', value: true },
                      },
                    ],
                  },
                  {
                    id: 'conditional-step',
                    title: 'Additional details',
                    condition: { fieldId: 'extra', operator: 'eq', value: true },
                    fields: [{ id: 'details', key: 'details', type: 'textarea', label: 'Additional details' }],
                  },
                ]
              : [
                  {
                    id: 'identity',
                    title: t('common.labels.name'),
                    fields: [
                      {
                        id: 'name',
                        name: 'name',
                        type: 'text',
                        label: t('common.labels.name'),
                        validation: { validators: [{ id: 'required', name: 'Required', predicate: 'required' }] },
                      },
                      { id: 'email', name: 'email', type: 'email', label: t('common.labels.email') },
                    ],
                  },
                  {
                    id: 'notes',
                    title: t('common.labels.description'),
                    fields: [{ id: 'notes', name: 'notes', type: 'textarea', label: t('common.labels.description') }],
                  },
                ],
      },
    }),
    [t, scenario],
  );
  const bindings: PublicFormBindings = {
    submitFormAction: async () => {
      if (submitState === 'pending') {
        return new Promise(() => {});
      }
      attempts.count += 1;
      return actionFailed || (submitState === 'fail-once' && attempts.count === 1)
        ? actionFailure('Local submission failed', 'FORM_SUBMIT_FAILED')
        : actionSuccess({ success: true });
    },
  };
  return (
    <QueryClientProvider client={client}>
      {surface === 'success' || submitted ? (
        <FormSuccessPageView />
      ) : (
        <PublicFormView
          slug={form.slug}
          form={surface === 'access' ? null : form}
          accessData={{
            accessible: surface !== 'access',
            reason: surface === 'access' ? reason : undefined,
            form: surface === 'access' ? null : form,
          }}
          requestedLocale={locale}
          bindings={bindings}
          navigate={(href) => (href.includes('/success') ? setSubmitted(true) : navigatePreview(href))}
        />
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Forms/Public Response',
  excludeStories: ['FormPagePreview'],
  component: FormPagePreview,
  args: {
    surface: 'response',
    reason: 'password_required',
    actionFailed: false,
    scenario: 'standard',
    submitState: 'ready',
  },
  render: (args) => (
    <FormPagePreview
      key={`${args.surface}:${args.reason}:${args.actionFailed}:${args.scenario}:${args.submitState}`}
      {...args}
    />
  ),
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/forms/listening-room', query: {} } },
    docs: {
      description: {
        component:
          'Complete actual PublicFormView response/access/header composition and FormSuccessPageView used by the production success route. Real two-step validation and local typed submission/access callbacks. Server metadata, authorization/password persistence, delivery and canonical edit branches remain separate.',
      },
    },
  },
} satisfies Meta<typeof FormPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Response: Story = {};
export const Success: Story = { args: { surface: 'success' } };
/** Rawsector's red label at the size its file authors. */
export const StackedBrand: Story = { decorators: [withStackedBrand] };
export const StackedBrandSuccess: Story = { args: { surface: 'success' }, decorators: [withStackedBrand] };
export const PasswordRequired: Story = { args: { surface: 'access' } };
export const Closed: Story = { args: { surface: 'access', reason: 'closed' } };
export const NotPublic: Story = { args: { surface: 'access', reason: 'not_public' } };
export const SubmitFailed: Story = { args: { actionFailed: true } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const AllFields: Story = {
  args: { scenario: 'all-fields' },
  tags: ['a11y-author'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The phone field loads on demand, so wait for each control.
    for (const name of ['Text response', 'Email response', 'Long response', 'Number response', 'Phone response']) {
      await expect(await canvas.findByRole('textbox', { name })).toBeInTheDocument();
    }
    await expect(canvas.getByLabelText('Date response')).toBeInTheDocument();
    await expect(canvas.getByRole('radiogroup', { name: 'Single response' })).toBeInTheDocument();
    await expect(canvas.getByRole('combobox', { name: 'Multiple responses' })).toBeInTheDocument();
    await expect(canvas.getByRole('checkbox', { name: /Consent response/ })).toBeInTheDocument();
    const toggle = canvas.getByRole('switch', { name: 'Notification response' });
    toggle.focus();
    await userEvent.keyboard(' ');
    await expect(toggle).toBeChecked();
  },
};
export const ConditionalFieldsAndSteps: Story = {
  args: { scenario: 'conditional' },
  tags: ['a11y-author'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('textbox', { name: 'Conditional response' })).not.toBeInTheDocument();
    const checkbox = canvas.getByRole('checkbox', { name: 'Additional response' });
    checkbox.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(canvas.getByRole('textbox', { name: 'Conditional response' })).toBeInTheDocument());
    await expect(canvas.getByRole('progressbar')).toBeInTheDocument();
    await userEvent.keyboard(' ');
    await expect(canvas.queryByRole('textbox', { name: 'Conditional response' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument();
  },
};
export const KeyboardResponse: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement }) => {
    const firstInput = canvasElement.querySelector<HTMLInputElement>('input[type="text"]');
    if (!firstInput) {
      throw new Error('The response name field is missing');
    }
    firstInput.focus();
    await userEvent.keyboard('June Han{Enter}');
    await waitFor(() => expect(canvasElement.querySelector('textarea')).toBeInTheDocument());
    await expect(canvasElement.ownerDocument.activeElement).toHaveAttribute('role', 'group');
    const notes = canvasElement.querySelector<HTMLTextAreaElement>('textarea');
    notes?.focus();
    await userEvent.keyboard('Listening notes{Enter}Second line');
    await expect(notes).toHaveValue('Listening notes\nSecond line');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvasElement.querySelector('textarea')).not.toBeInTheDocument());
  },
};

export const AuthRequired: Story = { args: { surface: 'access', reason: 'auth_required' } };
export const RoleRestricted: Story = { args: { surface: 'access', reason: 'role_not_allowed' } };
export const AlreadySubmitted: Story = { args: { surface: 'access', reason: 'already_submitted' } };
export const OpensLater: Story = { args: { surface: 'access', reason: 'not_yet_open' } };
export const MaximumResponses: Story = { args: { surface: 'access', reason: 'max_submissions_reached' } };
export const Unpublished: Story = { args: { surface: 'access', reason: 'form_not_published' } };
export const Missing: Story = { args: { surface: 'access', reason: 'form_not_found' } };
export const SubmissionPending: Story = {
  args: { scenario: 'all-fields', submitState: 'pending' },
  tags: ['a11y-author'],
  play: async ({ canvasElement }) => {
    const inputs = within(canvasElement).getAllByRole('textbox');
    // Use the field group command, rather than the clear/menu buttons of inputs.
    const command = within(canvasElement)
      .getByRole('group', { name: 'Response fields' })
      .querySelectorAll<HTMLButtonElement>('button[data-control-kind="button"]')
      .item(0);
    if (!command) {
      throw new Error('The response submit command is missing');
    }
    await waitFor(() => expect(command).toBeEnabled());
    await userEvent.click(command);
    await waitFor(() => expect(inputs[0]).toBeDisabled());
    await expect(command).toBeDisabled();
  },
};
export const SubmissionRecovery: Story = {
  args: { scenario: 'all-fields', submitState: 'fail-once' },
  tags: ['a11y-author'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Text response' });
    await userEvent.type(input, 'Retained response');
    const group = canvas.getByRole('group', { name: 'Response fields' });
    const command = group.querySelectorAll<HTMLButtonElement>('button[data-control-kind="button"]').item(0);
    if (!command) {
      throw new Error('The response submit command is missing');
    }
    await userEvent.click(command);
    await waitFor(() => expect(command).toBeEnabled());
    await expect(input).toHaveValue('Retained response');
    await userEvent.click(command);
    await waitFor(() => expect(canvas.queryByRole('textbox', { name: 'Text response' })).not.toBeInTheDocument());
  },
};
