// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { DateInput, DateRangeInput, DateTimePicker, MonthPickerInput, TimePicker } from './DateInputs';
import { Select } from './Select';
import { useInputCombobox } from './useInputCombobox';
import { ColorInput } from './ColorInput';
import { TextInput } from './TextInput';
import { Checkbox } from './Checkbox';
import classes from './Input.module.css';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function render(node: React.ReactNode) {
  act(() => root.render(<I18nProvider locale="en-US">{node}</I18nProvider>));
}
function increase(type: string, selector = '') {
  const segment = container.querySelector<HTMLElement>(`${selector}[data-type="${type}"]`)!;
  act(() => {
    segment.focus();
    segment.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  });
}
describe('closed React Aria input behavior', () => {
  it('content-fitted selects preserve clear actions and read-only protection', async () => {
    const changed = vi.fn();
    const options = [{ value: 'editor', label: 'Shared editing and publishing permissions' }];
    render(<Select label="Role" width="content" data={options} defaultValue="editor" onChange={changed} clearable />);
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe(options[0].label);
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Clear all"]')!.click());
    expect(changed).toHaveBeenCalledWith(null, { value: '', label: '' });
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('');
    changed.mockClear();
    render(<Select label="Role" width="content" data={options} value="editor" onChange={changed} clearable readOnly />);
    const clear = container.querySelector<HTMLButtonElement>('button[aria-label="Clear all"]')!;
    expect(clear.disabled).toBe(true);
    await act(async () => clear.click());
    expect(changed).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe(options[0].label);
  });
  it('names the Select clear command for its effect when the caller supplies clearLabel', async () => {
    const options = [{ value: 'a', label: 'Autumn series' }];
    render(<Select label="Series" data={options} defaultValue="a" clearable clearLabel="Remove post from series" />);
    expect(container.querySelector('button[aria-label="Remove post from series"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Clear all"]')).toBeNull();
  });

  it('preserves mixed semantics and prevents changes to disabled and read-only checkboxes', async () => {
    const changed = vi.fn();
    render(
      <>
        <Checkbox label="Mixed choice" checked indeterminate />
        <Checkbox label="Read-only choice" checked readOnly onChange={changed} />
        <Checkbox label="Disabled choice" disabled onChange={changed} />
      </>,
    );
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(inputs[0].indeterminate).toBe(true);
    expect(inputs[0].closest('label')?.textContent).toBe('Mixed choice');
    await act(async () => {
      inputs[1].closest('label')!.click();
      inputs[2].closest('label')!.click();
    });
    expect(inputs[1].checked).toBe(true);
    expect(inputs[2].checked).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });

  it('changes grouped checkbox values through the native input', async () => {
    const changed = vi.fn();
    render(
      <Checkbox.Group label="Notifications" defaultValue={['first']} onChange={changed}>
        <Checkbox value="first" label="First choice" />
        <Checkbox value="second" label="Second choice" />
      </Checkbox.Group>,
    );
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    await act(async () => inputs[1].click());
    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(true);
    expect(changed).toHaveBeenLastCalledWith(['first', 'second']);
  });

  it('forwards a native checkbox click with functioning propagation methods and the actual input target', async () => {
    const parentClick = vi.fn();
    const changed = vi.fn();
    const inputClick = vi.fn((event: React.MouseEvent<HTMLInputElement>) => {
      expect(event.currentTarget.tagName).toBe('INPUT');
      event.stopPropagation();
    });
    render(
      // Parent listener verifies bubbling, without adding a second interactive target.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={parentClick}>
        <Checkbox label="Choose" onClick={inputClick} onChange={changed} />
      </div>,
    );
    await act(async () => container.querySelector<HTMLInputElement>('input')!.click());
    expect(inputClick).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledOnce();
    expect(container.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
  });

  it('opens an RGBA picker and updates hue without losing the alpha channel', async () => {
    const onChange = vi.fn();
    render(<ColorInput label="Color" defaultValue="rgba(20, 40, 60, 0.5)" format="rgba" onChange={onChange} />);
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const hue = document.querySelector<HTMLInputElement>('input[type="range"][max="360"]')!;
    expect(hue).not.toBeNull();
    expect(document.getElementById(hue.getAttribute('aria-labelledby')!)?.textContent).toBe('Hue');
    await act(async () => {
      hue.focus();
      hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0]).toMatch(/^rgba\(/);
    expect(onChange.mock.lastCall?.[0]).toContain('0.5');
  });
  it('keeps grouped source and translation options in the actual collection', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Language"
        data={[
          { group: 'Source', items: [{ value: 'en', label: 'English' }] },
          { group: 'Translations', items: [{ value: 'ko', label: 'Korean' }] },
        ]}
        onChange={onChange}
      />,
    );
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(document.body.textContent).toContain('Source');
    expect(document.body.textContent).toContain('Translations');
    const korean = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (option) => option.textContent === 'Korean',
    )!;
    await act(async () => korean.click());
    expect(onChange).toHaveBeenCalledWith('ko', { value: 'ko', label: 'Korean' });
  });
  it('does not reopen from a caller-controlled search value after selection or restoration', async () => {
    const onDropdownOpen = vi.fn();
    let setRestoredValue: ((value: string) => void) | undefined;
    const options = [
      { value: 'old', label: 'Old series' },
      { value: 'next', label: 'Next series' },
    ];
    function ControlledSearch() {
      const combobox = useInputCombobox();
      const [value, setValue] = useState<string | null>('old');
      const [search, setSearch] = useState('');
      setRestoredValue = setValue;
      const selected = options.find((option) => option.value === value);
      return (
        <Select
          label="Series"
          searchable
          data={options}
          value={value}
          searchValue={combobox.dropdownOpened ? search : (selected?.label ?? '')}
          onSearchChange={setSearch}
          dropdownOpened={combobox.dropdownOpened}
          onDropdownOpen={() => {
            onDropdownOpen();
            combobox.openDropdown();
          }}
          onDropdownClose={combobox.closeDropdown}
          onChange={(next) => {
            setValue(next);
            setSearch('');
            combobox.closeDropdown();
          }}
        />
      );
    }
    render(<ControlledSearch />);
    const input = container.querySelector<HTMLInputElement>('input')!;
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
    expect(onDropdownOpen).toHaveBeenCalledTimes(1);
    const next = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (option) => option.textContent === 'Next series',
    )!;
    await act(async () => next.click());
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Next series');
    expect(input.getAttribute('aria-expanded')).not.toBe('true');
    expect(document.querySelector('[role="option"]')).toBeNull();
    expect(onDropdownOpen).toHaveBeenCalledTimes(1);

    // A rejected server assignment restores the previous value while focus stays in the field.
    await act(async () => setRestoredValue?.('old'));
    expect(input.value).toBe('Old series');
    expect(input.getAttribute('aria-expanded')).not.toBe('true');
    expect(document.querySelector('[role="option"]')).toBeNull();
    expect(onDropdownOpen).toHaveBeenCalledTimes(1);
  });
  it('still opens a focused searchable select when the user types after a selection', async () => {
    const onDropdownOpen = vi.fn();
    render(
      <Select
        label="Series"
        searchable
        data={[
          { value: 'old', label: 'Old series' },
          { value: 'next', label: 'Next series' },
        ]}
        onDropdownOpen={onDropdownOpen}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input')!;
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
    const next = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (option) => option.textContent === 'Next series',
    )!;
    await act(async () => next.click());
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-expanded')).not.toBe('true');
    onDropdownOpen.mockClear();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Old');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onDropdownOpen).toHaveBeenCalledTimes(1);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(document.querySelectorAll('[role="option"]')).map((option) => option.textContent)).toEqual([
      'Old series',
    ]);
  });
  it('keeps keyboard focus and associated error available when motion is disabled', () => {
    render(<TextInput label="Name" animate={false} error="Name required" />);
    const input = container.querySelector<HTMLInputElement>('input')!;
    act(() => input.focus());
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      input
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' '),
    ).toContain('Name required');
    expect(container.querySelector(`.${classes.root}`)?.getAttribute('data-geul-input-animate')).toBe('false');
    expect(container.querySelector(`.${classes.wrapper}`)).not.toBeNull();
  });
  it('projects JS attributes without allowing consumer skins or reserved state overrides', () => {
    const bypass = {
      style: { color: 'red' },
      className: 'replacement',
      classNames: () => ({ input: 'replacement' }),
      'data-geul-input-size': 'xl',
      'data-core-input-size': 'xl',
      'data-view': 'test',
    };
    render(<TextInput {...(bypass as Record<string, unknown>)} label="Name" size="sm" />);
    expect(container.querySelector('[style]')).toBeNull();
    expect(container.querySelector('.replacement')).toBeNull();
    expect(container.querySelector('[data-geul-input-size]')?.getAttribute('data-geul-input-size')).toBe('sm');
    expect(container.querySelector('[data-view="test"]')).not.toBeNull();
    expect(container.querySelector('[data-core-input-size]')).toBeNull();
  });
  it('edits calendar days and clears uncontrolled selections through real pressables', () => {
    const onChange = vi.fn();
    render(<DateInput label="Date" defaultValue="2026-10-10" onChange={onChange} clearable />);
    increase('day');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-11');
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Clear all"]')!.click());
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(container.querySelector('[data-type="day"]')?.getAttribute('aria-valuenow')).toBeNull();
  });
  it('preserves timezone-free date-time and month domain strings', () => {
    const onChange = vi.fn();
    render(<DateTimePicker label="Moment" value="2026-10-10 12:30:00" onChange={onChange} />);
    increase('hour');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-10 13:30:00');
    render(<MonthPickerInput label="Month" value="2026-10-01" onChange={onChange} />);
    expect(container.querySelector('[data-type="day"]')).toBeNull();
    increase('month');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-01');
  });
  it('updates range endpoints and seconds without vendor callback shapes', () => {
    const onRange = vi.fn();
    render(<DateRangeInput label="Range" value={['2026-10-10', '2026-10-12']} onChange={onRange} />);
    increase('day');
    expect(onRange).toHaveBeenLastCalledWith(['2026-10-11', '2026-10-12']);
    const onTime = vi.fn();
    render(<TimePicker label="Duration" value="01:02:03" onChange={onTime} withSeconds />);
    increase('second');
    expect(onTime).toHaveBeenLastCalledWith('01:02:04');
  });
  it('prevents readonly calendar changes and clearing', () => {
    const onChange = vi.fn();
    render(<DateInput label="Date" value="2026-10-10" onChange={onChange} readOnly clearable />);
    increase('day');
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Clear all"]')?.disabled).toBe(true);
  });
});
