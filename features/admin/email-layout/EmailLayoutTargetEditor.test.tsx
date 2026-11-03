// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { PageLoader } from '@/features/site/PageLoader';
import type { MaterializedEmailLayoutUnit } from '@echovisionlab/geul-common/collaboration/email-layout';
import enMessages from '@/messages/en.json';
import { EmailLayoutTargetEditor } from './EmailLayoutTargetEditor';

const labels = enMessages.adminList.emailLayouts.detail.targetEditor;
const unit: MaterializedEmailLayoutUnit = {
  handle: 'unit:11111111-1111-4111-8111-111111111111:text',
  kind: 'text',
  element: '',
  attribute: '',
  order: 0,
  sourceValue: 'Source heading',
  value: 'Source heading',
  localeValuePresent: false,
};

it('shows source fallback without turning it into a locale-owned value', async () => {
  const onChange = vi.fn();
  const onUseSource = vi.fn();
  const { user } = render(
    <EmailLayoutTargetEditor
      loadingSurface={<PageLoader placement="flow" />}
      isReady
      units={[unit]}
      onChange={onChange}
      onUseSource={onUseSource}
    />,
  );
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('Source heading');
  expect(screen.getByRole('button', { name: labels.useSource })).toBeDisabled();
  await user.clear(input);
  expect(onChange).toHaveBeenLastCalledWith(unit.handle, '');
  expect(onUseSource).not.toHaveBeenCalled();
});

it('preserves explicit empty and exposes source fallback removal', async () => {
  const attributeUnit: MaterializedEmailLayoutUnit = {
    ...unit,
    handle: 'unit:attribute',
    kind: 'attribute',
    element: 'button',
    attribute: 'aria-label',
    sourceValue: 'Unsubscribe',
    value: '',
    localeValuePresent: true,
  };
  const onUseSource = vi.fn();
  const { user } = render(
    <EmailLayoutTargetEditor
      loadingSurface={<PageLoader placement="flow" />}
      isReady
      units={[attributeUnit]}
      onChange={vi.fn()}
      onUseSource={onUseSource}
    />,
  );
  expect(screen.getByRole('textbox')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: labels.useSource }));
  expect(onUseSource).toHaveBeenCalledWith(attributeUnit.handle);
});

it('does not present unsynchronized units as a resolved empty layout', () => {
  const { rerender } = render(
    <EmailLayoutTargetEditor
      loadingSurface={<PageLoader placement="flow" />}
      isReady={false}
      units={[]}
      onChange={vi.fn()}
      onUseSource={vi.fn()}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(enMessages.common.states.loading);
  expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
  rerender(
    <EmailLayoutTargetEditor
      loadingSurface={<PageLoader placement="flow" />}
      isReady
      units={[]}
      onChange={vi.fn()}
      onUseSource={vi.fn()}
    />,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText(labels.empty)).toBeVisible();
});
