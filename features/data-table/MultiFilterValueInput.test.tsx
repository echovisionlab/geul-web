// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestProviders } from '@/test/TestProviders';
import { MultiFilterValueInput } from './MultiFilterValueInput';
const chunk = vi.hoisted(() => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release, loaded: 0 };
});
vi.mock('./DateFilterInputRuntime', async (original) => {
  chunk.loaded += 1;
  await chunk.ready;
  return original();
});
const labels = {
  value: 'Date value',
  values: 'Values',
  from: 'From',
  to: 'To',
  selectValues: 'Select values',
  enterValue: 'Enter value',
  trueValue: 'True',
  falseValue: 'False',
};
beforeAll(async () => {
  await vi.importActual('./DateFilterInputRuntime');
});

const dateField = { field: 'date', label: 'Date', type: 'date' as const };
describe('date filter runtime boundary', () => {
  it('keeps dates unloaded for other field types and no-value operators, then reserves a named busy field for a cold date chunk', async () => {
    const state = { op: 'eq' as const, value: 'Example', negated: false };
    const { rerender } = render(
      <MultiFilterValueInput
        field={{ field: 'title', label: 'Title', type: 'string' }}
        state={state}
        onChange={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Date value' })).toHaveValue('Example');
    expect(chunk.loaded).toBe(0);
    rerender(
      <MultiFilterValueInput
        field={dateField}
        state={{ op: 'isNull', value: '', negated: false }}
        onChange={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(chunk.loaded).toBe(0);
    rerender(
      <MultiFilterValueInput
        field={dateField}
        state={{ op: 'eq', value: '2026-10-03', negated: true }}
        onChange={vi.fn()}
        labels={labels}
        disabled
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Loading...' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('textbox', { name: 'Loading...' })).toBeDisabled();
    await act(async () => chunk.release());
    const segments = await screen.findAllByRole('spinbutton');
    expect(segments).toHaveLength(3);
    expect(segments.every((segment) => segment.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();
  });
  it('keeps the resolved date control and its disabled value in server HTML', () => {
    const html = renderToStaticMarkup(
      <TestProviders>
        <MultiFilterValueInput
          field={dateField}
          state={{ op: 'eq', value: '2026-10-03', negated: true }}
          onChange={vi.fn()}
          labels={labels}
          disabled
        />
      </TestProviders>,
    );
    expect(html).toContain('Date value');
    expect(html.match(/role="spinbutton"/g)).toHaveLength(3);
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-disabled="true"');
  });

  it('preserves the operator and negation when a single date changes or clears', async () => {
    const state = { op: 'eq' as const, value: '2026-10-03', negated: true };
    const onChange = vi.fn();
    const { user } = render(
      <MultiFilterValueInput field={dateField} state={state} onChange={onChange} labels={labels} />,
    );
    const day = await screen.findByRole('spinbutton', { name: /day/i });
    await user.click(day);
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: '2026-10-04' });
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: '' });
  });
  it('preserves the other range endpoint when either date changes or clears', async () => {
    const state = { op: 'between' as const, value: ['2026-10-01', '2026-10-03'], negated: false };
    const onChange = vi.fn();
    const { user } = render(
      <MultiFilterValueInput field={dateField} state={state} onChange={onChange} labels={labels} />,
    );
    const days = await screen.findAllByRole('spinbutton', { name: /day/i });
    await user.click(days[0]);
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['2026-10-02', '2026-10-03'] });
    await user.click(days[1]);
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['2026-10-01', '2026-10-04'] });
    const clear = screen.getAllByRole('button', { name: 'Clear all' });
    await user.click(clear[0]);
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['', '2026-10-03'] });
    await user.click(clear[1]);
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['2026-10-01', ''] });
  });
  it.each(['eq', 'between'] as const)('shows empty date segments for empty %s values', async (op) => {
    render(
      <MultiFilterValueInput
        field={dateField}
        state={{ op, value: op === 'eq' ? '' : ['', ''], negated: false }}
        onChange={vi.fn()}
        labels={labels}
      />,
    );
    const segments = await screen.findAllByRole('spinbutton');
    expect(segments).toHaveLength(op === 'eq' ? 3 : 6);
    await waitFor(() => expect(segments.every((segment) => !segment.hasAttribute('aria-valuenow'))).toBe(true));
  });
});
