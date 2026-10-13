// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { ToolbarLayout, type ToolbarLayoutProps } from './ToolbarLayout';
import { TextInput, Select } from '../Input';
import { Button } from '../Button';

describe('ToolbarLayout', () => {
  it('shares compact density with search, filters and commands and retains native cursor keys', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <I18nProvider locale="en">
          <ToolbarLayout
            arrangement="actions-end"
            search={<TextInput aria-label="Search" />}
            filters={<Select aria-label="Type" data={['All']} defaultValue="All" />}
            actions={<Button>Export</Button>}
          />
        </I18nProvider>,
      ),
    );
    expect(
      [...host.querySelectorAll('[data-geul-input]')].every(
        (field) => field.getAttribute('data-geul-input-density') === 'compact',
      ),
    ).toBe(true);
    expect(host.querySelector('button[data-control-size]')?.getAttribute('data-control-size')).toBe('compact');
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search"]')!;
    search.focus();
    const key = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    await act(async () => search.dispatchEvent(key));
    expect(key.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(search);
    expect(host.querySelector('[role="toolbar"]')).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
  it('projects hostile presentation attributes and rejects unknown variants', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const hostile = { className: 'foreign', style: { padding: 900 }, 'data-density': 'comfortable' };
    await act(async () =>
      root.render(
        <ToolbarLayout {...(hostile as unknown as ToolbarLayoutProps)}>
          <Button>Go</Button>
        </ToolbarLayout>,
      ),
    );
    const layout = host.querySelector<HTMLElement>('[data-arrangement="flow"]')!;
    expect(layout.style.padding).toBe('');
    expect(layout.classList.contains('foreign')).toBe(false);
    expect(layout.dataset.density).toBe('compact');
    await act(async () => root.unmount());
    expect(() => ToolbarLayout({ arrangement: 'custom' as 'flow' })).toThrow('Invalid toolbar layout presentation');
  });
});
