// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IconButton, type IconButtonActionProps } from './IconButton';
import { DropdownMenu } from '../DropdownMenu';
import classes from '../Control.module.css';
import { ActionRowSizeProvider, ToolbarDensityProvider } from '../control-context';
import { ReorderRow } from '../Sortable';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function renderIconButton(node: React.ReactNode): HTMLButtonElement {
  act(() => {
    root?.render(<DesignSystemProvider>{node}</DesignSystemProvider>);
  });

  const button = container?.querySelector('button');
  if (!button) {
    throw new Error('Expected IconButton to render a button element.');
  }
  return button;
}

describe('IconButton', () => {
  it('keeps sensor geometry compact across parent sizes and unsafe runtime spreads', () => {
    const unsafe = { size: 'touch' } as unknown as { size?: never };
    const button = renderIconButton(
      <ActionRowSizeProvider size="md">
        <ToolbarDensityProvider density="comfortable">
          <IconButton {...unsafe} interaction="drag-handle" label="Move">
            M
          </IconButton>
        </ToolbarDensityProvider>
      </ActionRowSizeProvider>,
    );
    expect(button.getAttribute('data-control-size')).toBe('compact');
  });
  it('uses the actual native reorder row as the drag image and preserves consumer callbacks', () => {
    const onDragStart = vi.fn();
    const button = renderIconButton(
      <ReorderRow
        handle={
          <IconButton interaction="drag-handle" label="Move" onDragStart={onDragStart}>
            M
          </IconButton>
        }
      >
        Complete input row
      </ReorderRow>,
    );
    const setDragImage = vi.fn();
    const event = new MouseEvent('dragstart', { bubbles: true, clientX: 12, clientY: 15 });
    Object.defineProperty(event, 'dataTransfer', { value: { setDragImage } });
    act(() => button.dispatchEvent(event));
    expect(setDragImage).toHaveBeenCalledWith(button.closest('[data-geul-reorder-row]'), 12, 15);
    expect(onDragStart).toHaveBeenCalledOnce();
  });
  it('lets an active reorder sensor receive the drop key on the document', () => {
    const keyDown = vi.fn();
    document.addEventListener('keydown', keyDown);
    const button = renderIconButton(
      <IconButton label="Move" interaction="drag-handle" draggable={false}>
        M
      </IconButton>,
    );
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    });
    expect(keyDown).toHaveBeenCalledOnce();
    document.removeEventListener('keydown', keyDown);
  });
  it('preserves the actual native drag handle and forwarded ref across updates', () => {
    const ref = { current: null as HTMLButtonElement | null };
    const button = renderIconButton(
      <IconButton label="Move" interaction="drag-handle" ref={ref}>
        M
      </IconButton>,
    );
    expect(button.draggable).toBe(true);
    expect(ref.current).toBe(button);
    renderIconButton(
      <IconButton label="Move" interaction="drag-handle" draggable={false} ref={ref}>
        M
      </IconButton>,
    );
    expect(button.draggable).toBe(false);
    renderIconButton(
      <IconButton label="Move" interaction="action" ref={ref}>
        M
      </IconButton>,
    );
    expect(button.draggable).toBe(false);
  });
  it('preserves an explicit out-of-tab-order handle inside a menu trigger', () => {
    const button = renderIconButton(
      <DropdownMenu>
        <DropdownMenu.Target>
          <IconButton label="Move" interaction="drag-handle" tabIndex={-1}>
            M
          </IconButton>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>Move</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    expect(button.tabIndex).toBe(-1);
    expect(button.draggable).toBe(true);
  });
  it('blocks drag initiation when the sensor handle is unavailable', () => {
    const onDragStart = vi.fn();
    for (const unavailable of [{ disabled: true }, { loading: true }]) {
      const button = renderIconButton(
        <IconButton label="Move row" interaction="drag-handle" {...unavailable} onDragStart={onDragStart}>
          M
        </IconButton>,
      );
      expect(button.disabled).toBe(true);
      expect(button.draggable).toBe(false);
      const drag = new MouseEvent('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(drag, 'dataTransfer', { value: { setDragImage: vi.fn() } });
      act(() => button.dispatchEvent(drag));
      expect(drag.defaultPrevented).toBe(true);
    }
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('matches a text-button control height without changing standalone sizes', () => {
    const aligned = renderIconButton(
      <IconButton label="Remove" size="xs">
        X
      </IconButton>,
    );
    expect(aligned.getAttribute('data-control-size')).toBe('xs');

    const standalone = renderIconButton(
      <IconButton label="Remove" size="lg">
        X
      </IconButton>,
    );
    expect(standalone.getAttribute('data-control-size')).toBe('lg');
  });

  it('owns toggle semantics and the selected appearance from pressed', () => {
    const unsafe = { tone: 'accent', emphasis: 'strong' } as unknown as { tone?: never; emphasis?: never };
    const pressed = renderIconButton(
      <IconButton {...unsafe} label="Bold" pressed>
        B
      </IconButton>,
    );
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
    expect(pressed.dataset.tone).toBe('neutral');
    expect(pressed.dataset.emphasis).toBe('low');
    const resting = renderIconButton(
      <IconButton {...unsafe} label="Bold" pressed={false}>
        B
      </IconButton>,
    );
    expect(resting.getAttribute('aria-pressed')).toBe('false');
    expect(resting.dataset.tone).toBe('neutral');
    const command = renderIconButton(
      <IconButton {...({ 'aria-pressed': true } as unknown as object)} label="Delete" tone="danger">
        D
      </IconButton>,
    );
    expect(command.hasAttribute('aria-pressed')).toBe(false);
    expect(command.dataset.tone).toBe('danger');
  });

  it('renders an accessible icon button', () => {
    const button = renderIconButton(<IconButton label="Edit">E</IconButton>);

    expect(button.getAttribute('aria-label')).toBe('Edit');
  });

  it.each([
    { props: { label: 'Edit record' }, name: 'Edit record' },
    { props: { 'aria-label': 'Edit record' }, name: 'Edit record' },
    { props: { 'aria-labelledby': 'stable-icon-name' }, name: 'Edit record' },
  ])('retains the explicit action name without appending progress to it: $props', ({ props, name }) => {
    const example = (loading: boolean) => (
      <>
        <span id="stable-icon-name">Edit record</span>
        <IconButton {...(props as IconButtonActionProps)} loading={loading}>
          E
        </IconButton>
      </>
    );
    expect(renderIconButton(example(false))).toHaveAccessibleName(name);
    expect(renderIconButton(example(true))).toHaveAccessibleName(name);
    expect(container?.querySelector('[role="progressbar"]')).toHaveAccessibleName(name);
    expect(renderIconButton(example(false))).toHaveAccessibleName(name);
  });

  it.each(['action', 'drag-handle'] as const)(
    'replaces glyph and decorative count with separately named progress while pending: %s',
    (interaction) => {
      const onClick = vi.fn();
      const glyph = (
        <svg aria-hidden data-testid="pending-glyph">
          <path d="M4 12h16" />
        </svg>
      );
      // Each interaction is a distinct closed variant; the toggle state union is not mixed across them.
      const example = (loading: boolean) =>
        interaction === 'action' ? (
          <IconButton label="Save changes" count={9} interaction="action" loading={loading} onClick={onClick}>
            {glyph}
          </IconButton>
        ) : (
          <IconButton label="Save changes" count={9} interaction="drag-handle" loading={loading} onClick={onClick}>
            {glyph}
          </IconButton>
        );
      const initial = renderIconButton(example(false));
      const targetSize = initial.getAttribute('data-control-size');
      expect(initial.querySelector('[data-testid="pending-glyph"]')).not.toBeNull();
      expect(initial.querySelector(`.${classes.counter}`)).toHaveTextContent('9');
      if (interaction === 'action') {
        initial.focus();
      }
      const pending = renderIconButton(example(true));
      expect(pending).toBe(initial);
      expect(pending).toHaveAccessibleName('Save changes');
      expect(pending.getAttribute('data-control-size')).toBe(targetSize);
      expect(pending.querySelector('[data-testid="pending-glyph"]')).toBeNull();
      expect(pending.querySelector(`.${classes.counter}`)).toBeNull();
      expect(pending.querySelector('[role="progressbar"]')).toHaveAccessibleName('Save changes');
      if (interaction === 'action') {
        expect(document.activeElement).toBe(pending);
      }
      act(() => pending.click());
      expect(onClick).not.toHaveBeenCalled();
      const restored = renderIconButton(example(false));
      expect(restored.querySelector('[data-testid="pending-glyph"]')).not.toBeNull();
      expect(restored.querySelector(`.${classes.counter}`)).toHaveTextContent('9');
      expect(restored.querySelector('[role="progressbar"]')).toBeNull();
      act(() => restored.click());
      expect(onClick).toHaveBeenCalledOnce();
    },
  );

  it('uses low-emphasis neutral treatment by default', () => {
    const button = renderIconButton(<IconButton label="Edit">E</IconButton>);

    expect(button.getAttribute('data-control-kind')).toBe('icon');
    expect(button.getAttribute('data-tone')).toBe('neutral');
    expect(button.getAttribute('data-emphasis')).toBe('low');
  });

  it('maps semantic danger tone without exposing raw colors', () => {
    const button = renderIconButton(
      <IconButton label="Delete" tone="danger">
        D
      </IconButton>,
    );

    expect(button.getAttribute('data-tone')).toBe('danger');
  });

  it('preserves aria-labelledby when the label is external', () => {
    const button = renderIconButton(<IconButton aria-labelledby="external-icon-button-label">E</IconButton>);

    expect(button.getAttribute('aria-labelledby')).toBe('external-icon-button-label');
    expect(button.hasAttribute('aria-label')).toBe(false);
  });

  it.each([
    {},
    { label: '' },
    { 'aria-label': '   ' },
    { 'aria-labelledby': '' },
    { label: 'Edit', 'aria-label': 'Edit record' },
  ])('rejects missing, blank, or ambiguous runtime name channels: %j', (props) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderIconButton(<IconButton {...(props as IconButtonActionProps)}>E</IconButton>)).toThrow(
      /exactly one nonempty/,
    );
  });

  it('resolves an external label as an accessible name for both the command and pending progress', () => {
    const button = renderIconButton(
      <>
        <span id="edit-record">Edit record</span>
        <IconButton aria-labelledby="edit-record" loading>
          E
        </IconButton>
      </>,
    );
    expect(button).toHaveAccessibleName(expect.stringContaining('Edit record'));
    expect(container?.querySelector('[role="progressbar"]')).toHaveAccessibleName('Edit record');
  });

  it('keeps the visual count decorative and validates numeric badge input', () => {
    const button = renderIconButton(
      <IconButton label="Open files" count={100}>
        F
      </IconButton>,
    );
    expect(button).toHaveAccessibleName('Open files');
    expect(button.querySelector('[aria-hidden]')).toHaveTextContent('99+');
    renderIconButton(
      <IconButton label="Open files" count={0}>
        F
      </IconButton>,
    );
    expect(button.textContent).toBe('F');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      renderIconButton(
        <IconButton label="Open files" count={-1}>
          F
        </IconButton>,
      ),
    ).toThrow(RangeError);
  });

  it('prevents a pending reset action from performing native form reset', () => {
    const onReset = vi.fn((event: React.FormEvent) => event.preventDefault());
    const button = renderIconButton(
      <form onReset={onReset}>
        <IconButton type="reset" label="Reset form" loading>
          R
        </IconButton>
      </form>,
    );
    expect(button.type).toBe('button');
    act(() => button.click());
    expect(onReset).not.toHaveBeenCalled();
  });

  it('preserves disabled state', () => {
    const button = renderIconButton(
      <IconButton label="Disabled edit" disabled>
        E
      </IconButton>,
    );

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('data-emphasis')).toBe('low');
    expect(button.classList.contains(classes.root)).toBe(true);
  });

  it('keeps accepted native advisory text on a disabled action without changing its name', () => {
    const button = renderIconButton(
      <IconButton label="Cancel" disabled title="Finalizing">
        E
      </IconButton>,
    );

    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Finalizing');
    expect(button.getAttribute('aria-label')).toBe('Cancel');
  });

  it('keeps native advisory text and tab order on command links, including pending links', () => {
    act(() => {
      root?.render(
        <DesignSystemProvider>
          <IconButton label="Open" href="/files" title="Opens the library" tabIndex={-1}>
            O
          </IconButton>
          <IconButton label="Saving" href="/files" title="Saving changes" loading>
            S
          </IconButton>
        </DesignSystemProvider>,
      );
    });
    const link = container!.querySelector('a')!;
    expect(link.title).toBe('Opens the library');
    expect(link.tabIndex).toBe(-1);
    const pending = container!.querySelector<HTMLElement>('[aria-busy="true"]')!;
    expect(pending.tagName).toBe('SPAN');
    expect(pending.title).toBe('Saving changes');
  });

  it('applies the same Core low-emphasis disabled treatment to semantic tones', () => {
    const button = renderIconButton(
      <IconButton label="Disabled delete" tone="danger" emphasis="low" disabled>
        D
      </IconButton>,
    );

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('data-tone')).toBe('danger');
    expect(button.getAttribute('data-emphasis')).toBe('low');
    expect(button.classList.contains(classes.root)).toBe(true);
  });
});
