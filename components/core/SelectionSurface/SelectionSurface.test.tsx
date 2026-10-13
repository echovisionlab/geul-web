// @vitest-environment jsdom
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SelectionGrid,
  SelectionSurface,
  SelectionThumbnail,
  SelectionRow,
  SelectionPath,
  SelectionMarquee,
  type SelectionSurfaceProps,
} from './SelectionSurface';
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
describe('shared selection surface contracts', () => {
  it('describes unavailable selection without disabling independent preview or losing an existing description', () => {
    const preview = vi.fn();
    act(() =>
      root.render(
        <SelectionGrid label="Files" selectionStyle="grid">
          <span id="existing-description">Library file</span>
          <SelectionSurface
            label="Poster.png"
            selectionStyle="grid"
            selectionUnavailable
            selectionUnavailableDescription="Cannot add this file. Enter previews it."
            aria-describedby="existing-description"
            preview={null}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                preview();
              }
            }}
          />
        </SelectionGrid>,
      ),
    );
    const row = container.querySelector<HTMLElement>('[role="row"]')!;
    expect(row.hasAttribute('aria-disabled')).toBe(false);
    expect(row.dataset.unavailable).toBe('true');
    expect(row.getAttribute('aria-selected')).toBe('false');
    expect(row.getAttribute('aria-describedby')?.split(' ')).toContain('existing-description');
    expect(row).toHaveAccessibleDescription('Library file Cannot add this file. Enter previews it.');
    act(() => row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(preview).toHaveBeenCalledOnce();
  });

  it('rejects unexplained or contradictory selection eligibility at runtime', () => {
    for (const availability of [
      { selectionUnavailable: true, selectionUnavailableDescription: '' },
      { selectionUnavailable: true, selectionUnavailableDescription: 'Preview only', selected: true },
      { selectionUnavailable: true, selectionUnavailableDescription: 'Preview only', unavailable: true },
    ]) {
      expect(() =>
        renderToStaticMarkup(
          <SelectionSurface {...({ label: 'File', preview: null, ...availability } as SelectionSurfaceProps)} />,
        ),
      ).toThrow(TypeError);
    }
  });

  it('supports selectable grid rows with independent interactive actions in cells', () => {
    const action = vi.fn();
    const select = vi.fn();
    act(() =>
      root.render(
        <SelectionGrid label="Files" selectionStyle="grid" multiSelect>
          <SelectionSurface
            label="Recording.wav"
            selected
            selectionStyle="grid"
            preview={<span>Waveform</span>}
            actions={
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  action();
                }}
              >
                More
              </button>
            }
            onClick={select}
          />
        </SelectionGrid>,
      ),
    );
    const grid = container.querySelector('[role="grid"]')!;
    const row = grid.querySelector('[role="row"]') as HTMLElement;
    expect(grid.getAttribute('aria-multiselectable')).toBe('true');
    expect(row.getAttribute('aria-label')).toBe('Recording.wav');
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.tabIndex).toBe(0);
    expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(2);
    expect(row.querySelector('button')?.closest('[role="gridcell"]')).not.toBeNull();
    expect(container.querySelector('[role="listbox"], [role="option"]')).toBeNull();
    act(() => row.querySelector('button')!.click());
    expect(action).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
    act(() => row.click());
    expect(select).toHaveBeenCalledOnce();
  });

  it('rejects unsupported column counts and breakpoint names at runtime', () => {
    expect(() => renderToStaticMarkup(<SelectionGrid label="Files" columns={13 as 3} />)).toThrow(RangeError);
    expect(() => renderToStaticMarkup(<SelectionGrid label="Files" columns={{ phone: 3 } as unknown as 3} />)).toThrow(
      RangeError,
    );
  });
  it('rejects arbitrary icon sizing, spacing and appearance at runtime', () => {
    expect(() => renderToStaticMarkup(<SelectionGrid label="Files" iconSize={64 as unknown as 'medium'} />)).toThrow(
      RangeError,
    );
    expect(() => renderToStaticMarkup(<SelectionGrid label="Files" spacing={'wide' as 'compact'} />)).toThrow(
      RangeError,
    );
    expect(() =>
      renderToStaticMarkup(<SelectionSurface label="File" preview={null} appearance={'custom' as 'file'} />),
    ).toThrow(RangeError);
  });
  it('keeps the complete filename intact and selected file icons free of checkbox badges', () => {
    act(() =>
      root.render(<SelectionSurface label="field-recording-02.wav" preview={null} appearance="file" selected />),
    );
    const name = container.querySelector('[title="field-recording-02.wav"]');
    expect(name?.textContent).toBe('field-recording-02.wav');
    expect(name?.childElementCount).toBe(0);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(container.querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('retains controller events and option identity while owning selected, unavailable and density state', () => {
    const click = vi.fn();
    const key = vi.fn();
    act(() =>
      root.render(
        <SelectionGrid label="Files" density="workspace" multiSelect>
          <SelectionSurface
            label="Recording"
            selected
            unavailable
            density="workspace"
            preview={<SelectionThumbnail icon={<svg />} />}
            data-file-viewer-item="one"
            onClick={click}
            onKeyDown={key}
          />
        </SelectionGrid>,
      ),
    );
    const option = container.querySelector('[role="option"]') as HTMLElement;
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(option.getAttribute('aria-disabled')).toBe('true');
    expect(option.dataset.fileViewerItem).toBe('one');
    expect(option.tabIndex).toBe(0);
    expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe('true');
    expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe('Files');
    act(() => {
      option.click();
      option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(click).toHaveBeenCalledOnce();
    expect(key).toHaveBeenCalledOnce();
  });
  it('rejects consumer CSS and owner state across runtime casts', () => {
    const props = {
      label: 'File',
      preview: null,
      style: { color: 'red' },
      className: 'local',
      'data-selected': true,
      'data-density': 'workspace',
    } as unknown as SelectionSurfaceProps;
    act(() => root.render(<SelectionSurface {...props} />));
    const option = container.querySelector('[role="option"]') as HTMLElement;
    expect(option.style.color).toBe('');
    expect(option.className).not.toContain('local');
    expect(option.hasAttribute('data-selected')).toBe(false);
    expect(option.dataset.density).toBe('compact');
  });
  it('uses a native action beside independent checkbox/menu controls and locks the action when disabled', () => {
    const action = vi.fn();
    act(() =>
      root.render(
        <SelectionRow
          density="compact"
          selected
          onAction={action}
          leading={<input type="checkbox" aria-label="Active" />}
          trailing={<button type="button">Direction</button>}
        >
          Field
        </SelectionRow>,
      ),
    );
    expect(container.querySelector('[role="group"]')?.getAttribute('data-density')).toBe('compact');
    expect(container.querySelector('button button, button input')).toBeNull();
    const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Field')!;
    act(() => button.click());
    expect(action).toHaveBeenCalledOnce();
    act(() => container.querySelector('input')!.click());
    expect(action).toHaveBeenCalledOnce();
    act(() =>
      root.render(
        <SelectionRow disabled onAction={action}>
          Field
        </SelectionRow>,
      ),
    );
    expect(container.querySelector('button')?.disabled).toBe(true);
    act(() => container.querySelector('button')!.click());
    expect(action).toHaveBeenCalledOnce();
  });
  it('falls back after authored thumbnail failure and recovers when the source changes', () => {
    act(() => root.render(<SelectionThumbnail src="/broken.png" icon={<svg data-fallback />} />));
    act(() => container.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(container.querySelector('[data-fallback]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    act(() => root.render(<SelectionThumbnail src="/new.png" />));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/new.png');
  });
  it('shows parent navigation only below the accessible root', () => {
    const open = vi.fn();
    act(() =>
      root.render(<SelectionPath items={[{ id: 'scope', name: 'Library' }]} parentLabel="Back" onOpen={open} />),
    );
    expect(container.querySelector('button')).toBeNull();
    act(() =>
      root.render(
        <SelectionPath
          items={[
            { id: 'scope', name: 'Library' },
            { id: 'child', name: 'Recordings' },
          ]}
          parentLabel="Back"
          onOpen={open}
        />,
      ),
    );
    const parent = container.querySelector<HTMLButtonElement>('button[aria-label="Back"]');
    expect(parent?.getAttribute('data-control-size')).toBe('xs');
    expect(parent?.querySelector('.tabler-icon-corner-left-up')).not.toBeNull();
    act(() => parent?.click());
    expect(open).toHaveBeenCalledWith(0);
  });
  it('preserves breadcrumb navigation and explicit runtime marquee coordinates', () => {
    const open = vi.fn();
    act(() =>
      root.render(
        <>
          <SelectionPath items={[{ name: 'Root' }, { id: 'a', name: 'Folder' }]} label="Location" onOpen={open} />
          <SelectionMarquee rect={{ left: 12, top: 18, width: 24, height: 30 }} />
        </>,
      ),
    );
    act(() => container.querySelector('button')!.click());
    expect(open).toHaveBeenCalledExactlyOnceWith(0);
    expect(container.querySelector('[aria-current="location"]')?.textContent).toBe('Folder');
    expect(container.querySelector('nav')?.getAttribute('title')).toBe('Root / Folder');
    const marquee = container.querySelector('[aria-hidden="true"][style]') as HTMLElement;
    expect(marquee.style.left).toBe('12px');
    expect(marquee.style.width).toBe('24px');
  });
});
