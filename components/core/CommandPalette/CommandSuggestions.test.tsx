// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CommandSuggestions } from './CommandSuggestions';
describe('shared command suggestions', () => {
  it('preserves catalog order across repeated groups, links virtual focus, and executes actual pointer actions', async () => {
    const container = document.createElement('div');
    const input = document.createElement('input');
    document.body.append(input, container);
    const root = createRoot(container);
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <CommandSuggestions
          id="commands"
          density="compact"
          showGroupLabels={false}
          label="Commands"
          inputElement={input}
          position={{ left: 10, top: 20 }}
          activeId="third"
          items={[
            { id: 'first', label: 'First', group: 'Text' },
            { id: 'second', label: 'Second', group: 'Media', disabled: true },
            { id: 'third', label: 'Third', description: 'Additional guidance', group: 'Text' },
          ]}
          onSelect={onSelect}
        />,
      ),
    );
    const options = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual(['First', 'Second', 'Third']);
    expect(options[1]?.getAttribute('aria-disabled')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('commands');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[2]?.id);
    expect(container.querySelector('[data-geul-command-density]')?.getAttribute('data-geul-command-density')).toBe(
      'compact',
    );
    expect(container.querySelector('[slot="description"]')?.textContent).toBe('Additional guidance');
    expect(container.querySelector('[aria-hidden]')?.textContent).toBe('Additional guidance');
    expect(container.querySelector('[role="heading"]')).toBeNull();
    await act(async () => options[0]!.click());
    expect(onSelect).toHaveBeenCalledWith('first');
    await act(async () => root.unmount());
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    input.remove();
    container.remove();
  });
});
