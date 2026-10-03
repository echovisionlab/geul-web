import { PassThrough } from 'node:stream';
import type { ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import type { DateInputProps } from '@mantine/dates';
import { describe, expect, it, vi } from 'vitest';
import { MultiFilterValueInput } from './MultiFilterValueInput';

const probes = vi.hoisted(() => ({
  datesLoaded: 0,
  inputs: [] as DateInputProps[],
  options: [] as Array<{ ssr?: boolean } | undefined>,
}));

vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return {
    default: (...args: Parameters<typeof dynamic>) => {
      probes.options.push(args[1]);
      return dynamic(...args);
    },
  };
});

vi.mock('@mantine/dates', () => {
  probes.datesLoaded += 1;
  return {
    DateInput: (props: DateInputProps) => {
      probes.inputs.push(props);
      return <input aria-label={String(props.label)} data-date-input="" disabled={props.disabled} />;
    },
  };
});

vi.mock('@mantine/core', () => ({
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/core/Input/TextInput', () => ({
  TextInput: ({ value }: { value: string }) => <input aria-label="Text value" defaultValue={value} />,
}));
vi.mock('@/components/core/Input/NumberInput', () => ({ NumberInput: () => <input aria-label="Number value" /> }));
vi.mock('@/components/core/Input/MultiSelect', () => ({ MultiSelect: () => <input aria-label="Multiple values" /> }));
vi.mock('@/components/core/Input/Radio', () => ({
  Radio: Object.assign(() => <input type="radio" />, {
    Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
}));

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

function renderServer(node: ReactNode) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => {
      html += chunk.toString();
    });
    output.on('end', () => resolve(html));
    output.on('error', reject);
    const stream = renderToPipeableStream(node, {
      onAllReady() {
        stream.pipe(output);
      },
      onError: reject,
    });
  });
}

describe('date filter runtime boundary', () => {
  it('keeps dates unloaded for non-date fields and renders single dates in server HTML with exact props and clearing', async () => {
    expect(probes.datesLoaded).toBe(0);
    expect(probes.options).toHaveLength(1);
    expect(probes.options[0]?.ssr).not.toBe(false);
    await renderServer(
      <MultiFilterValueInput
        field={{ field: 'title', label: 'Title', type: 'string' }}
        state={{ op: 'eq', value: 'Example', negated: false }}
        onChange={vi.fn()}
        labels={labels}
      />,
    );
    await renderServer(
      <MultiFilterValueInput
        field={{ field: 'date', label: 'Date', type: 'date' }}
        state={{ op: 'isNull', value: '', negated: false }}
        onChange={vi.fn()}
        labels={labels}
      />,
    );
    expect(probes.datesLoaded).toBe(0);

    const onChange = vi.fn();
    const state = { op: 'eq' as const, value: '2026-10-03', negated: true };
    const html = await renderServer(
      <MultiFilterValueInput
        field={{ field: 'date', label: 'Date', type: 'date' }}
        state={state}
        onChange={onChange}
        labels={labels}
        disabled
        withinPortal={false}
      />,
    );
    expect(html).toContain('data-date-input=""');
    expect(probes.datesLoaded).toBe(1);
    const input = probes.inputs.at(-1)!;
    expect(input).toMatchObject({
      label: 'Date value',
      size: 'xs',
      valueFormat: 'YYYY-MM-DD',
      value: new Date('2026-10-03'),
      clearable: true,
      popoverProps: { withinPortal: false },
      disabled: true,
    });
    input.onChange?.('2026-10-04');
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: '2026-10-04' });
    input.onChange?.(null);
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: '' });
  });

  it('preserves range pairing when either date changes or clears and renders both endpoints on the server', async () => {
    probes.inputs.length = 0;
    const onChange = vi.fn();
    const state = { op: 'between' as const, value: ['2026-10-01', '2026-10-03'], negated: false };
    const html = await renderServer(
      <MultiFilterValueInput
        field={{ field: 'date', label: 'Date', type: 'date' }}
        state={state}
        onChange={onChange}
        labels={labels}
      />,
    );
    expect(html.match(/data-date-input/g)).toHaveLength(2);
    const [from, to] = probes.inputs;
    expect(from).toMatchObject({
      label: 'From',
      value: new Date('2026-10-01'),
      popoverProps: { withinPortal: true },
      disabled: false,
    });
    expect(to).toMatchObject({
      label: 'To',
      value: new Date('2026-10-03'),
      popoverProps: { withinPortal: true },
      disabled: false,
    });
    from.onChange?.('2026-10-02');
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['2026-10-02', '2026-10-03'] });
    from.onChange?.(null);
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['', '2026-10-03'] });
    to.onChange?.('2026-10-05');
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['2026-10-01', '2026-10-05'] });
    to.onChange?.(null);
    expect(onChange).toHaveBeenLastCalledWith({ ...state, value: ['2026-10-01', ''] });
  });

  it('passes empty single and range values to the runtime as null', async () => {
    probes.inputs.length = 0;
    for (const state of [
      { op: 'eq' as const, value: '', negated: false },
      { op: 'between' as const, value: ['', ''], negated: false },
    ]) {
      await renderServer(
        <MultiFilterValueInput
          field={{ field: 'date', label: 'Date', type: 'date' }}
          state={state}
          onChange={vi.fn()}
          labels={labels}
        />,
      );
    }
    expect(probes.inputs).toHaveLength(3);
    expect(probes.inputs.every((input) => input.value === null)).toBe(true);
  });
});
