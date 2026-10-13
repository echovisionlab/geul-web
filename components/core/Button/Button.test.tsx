// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageHeader } from '../PageHeader';
import { IconButton } from '../IconButton';
import { TextButton } from '../TextButton';
import { Button, type ButtonActionProps } from './Button';

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

function renderButton(node: React.ReactNode): HTMLButtonElement {
  act(() => {
    root?.render(<DesignSystemProvider>{node}</DesignSystemProvider>);
  });

  const button = container?.querySelector('button');
  if (!button) {
    throw new Error('Expected Button to render a button element.');
  }
  return button;
}

describe('Button', () => {
  it('renders an accessible button with the provided label', () => {
    const button = renderButton(<Button>Save</Button>);

    expect(button.textContent).toBe('Save');
  });

  it('gives pending progress the action name when its visible content is decorative', () => {
    renderButton(
      <Button loading aria-label="Upload recording">
        <span aria-hidden>↑</span>
      </Button>,
    );
    expect(container?.querySelector('[role="progressbar"]')).toHaveAccessibleName('Upload recording');
    expect(container?.querySelector('button')?.textContent).toBe('↑');
  });

  it('retains an external action label for pending progress without requiring duplicate hidden copy', () => {
    renderButton(
      <>
        <span id="submit-label">Submit</span>
        <Button loading aria-labelledby="submit-label">
          ✓
        </Button>
      </>,
    );
    expect(container?.querySelector('[role="progressbar"]')).toHaveAccessibleName('Submit');
  });

  it.each([
    { props: {}, name: 'Save', progress: 'Save' },
    { props: { loadingLabel: 'Saving changes' }, name: 'Save', progress: 'Saving changes' },
    { props: { 'aria-label': 'Save recording' }, name: 'Save recording', progress: 'Save recording' },
    { props: { 'aria-labelledby': 'stable-action-name' }, name: 'Save recording', progress: 'Save recording' },
    {
      props: { 'aria-labelledby': 'stable-action-name', 'aria-label': 'Save' },
      name: 'Save recording',
      progress: 'Save',
    },
  ])('keeps the action name stable while pending: $name / $progress', ({ props, name, progress }) => {
    const example = (loading: boolean) => (
      <>
        <span id="stable-action-name">Save recording</span>
        <Button {...props} loading={loading}>
          Save
        </Button>
      </>
    );
    expect(renderButton(example(false))).toHaveAccessibleName(name);
    const pending = renderButton(example(true));
    expect(pending).toHaveAccessibleName(name);
    expect(container?.querySelector('[role="progressbar"]')).toHaveAccessibleName(progress);
    expect(renderButton(example(false))).toHaveAccessibleName(name);
  });

  it('defaults to a neutral secondary action', () => {
    const button = renderButton(<Button>Save</Button>);
    expect(button.getAttribute('data-tone')).toBe('neutral');
    expect(button.getAttribute('data-emphasis')).toBe('medium');
  });

  it('maps neutral medium emphasis to the quiet visual variant', () => {
    const button = renderButton(
      <Button tone="neutral" emphasis="medium">
        Secondary
      </Button>,
    );

    expect(button.getAttribute('data-control-size')).toBe('sm');
    expect(button.getAttribute('data-control-kind')).toBe('button');
  });

  it('maps danger controls to the filled red treatment', () => {
    const button = renderButton(
      <Button tone="danger" emphasis="strong">
        Delete
      </Button>,
    );

    expect(button.getAttribute('data-emphasis')).toBe('strong');
    expect(button.getAttribute('data-tone')).toBe('danger');
  });

  it('preserves disabled state', () => {
    const button = renderButton(<Button disabled>Disabled</Button>);

    expect(button.disabled).toBe(true);
  });

  it('announces pending while keeping the action focusable and refusing repeated clicks', () => {
    const onClick = vi.fn();
    const button = renderButton(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    expect(button.getAttribute('data-pending')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(container?.querySelector('[role=progressbar]')).not.toBeNull();
    act(() => button.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('runs an ordinary action once and blocks disabled actions', () => {
    const onClick = vi.fn();
    let button = renderButton(<Button onClick={onClick}>Save</Button>);
    act(() => button.click());
    expect(onClick).toHaveBeenCalledOnce();
    button = renderButton(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    act(() => button.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not reset an associated form while pending and restores reset after completion', () => {
    const onReset = vi.fn((event: React.FormEvent) => event.preventDefault());
    const example = (loading: boolean) => (
      <form onReset={onReset}>
        <Button type="reset" loading={loading}>
          Reset
        </Button>
      </form>
    );
    let button = renderButton(example(true));
    act(() => button.click());
    expect(onReset).not.toHaveBeenCalled();
    button = renderButton(example(false));
    expect(button.type).toBe('reset');
    act(() => button.click());
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('submits an associated external form with native submit data and defaults ordinary actions to button', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const button = renderButton(
      <>
        <form id="save-form" onSubmit={onSubmit} />
        <Button type="submit" form="save-form" name="intent" value="save">
          Save
        </Button>
      </>,
    );
    expect(button.form?.id).toBe('save-form');
    expect(button.name).toBe('intent');
    expect(button.value).toBe('save');
    act(() => button.click());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(renderButton(<Button>Cancel</Button>).type).toBe('button');
  });

  it.each(['Button', 'IconButton', 'TextButton'] as const)(
    'activates %s exactly once per Enter and Space without changing an ordinary action to a toggle',
    (kind) => {
      const onClick = vi.fn();
      const button = renderButton(
        kind === 'Button' ? (
          <Button onClick={onClick}>Save</Button>
        ) : kind === 'IconButton' ? (
          <IconButton label="Save" onClick={onClick}>
            S
          </IconButton>
        ) : (
          <TextButton onClick={onClick}>Save</TextButton>
        ),
      );
      expect(button).toHaveAccessibleName('Save');
      expect(button.hasAttribute('aria-pressed')).toBe(false);
      act(() => button.focus());
      for (const key of ['Enter', ' ']) {
        act(() => {
          button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
          button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
        });
      }
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(button);
    },
  );

  it.each(['Button', 'IconButton'] as const)(
    'keeps focused pending %s inactive for keyboard and programmatic click, then restores activation',
    (kind) => {
      const onClick = vi.fn();
      const example = (loading: boolean) =>
        kind === 'Button' ? (
          <Button loading={loading} onClick={onClick}>
            Save
          </Button>
        ) : (
          <IconButton label="Save" loading={loading} onClick={onClick}>
            S
          </IconButton>
        );
      let button = renderButton(example(false));
      act(() => button.focus());
      button = renderButton(example(true));
      expect(document.activeElement).toBe(button);
      expect(button.disabled).toBe(false);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-busy', 'true');
      for (const key of ['Enter', ' ']) {
        act(() => {
          button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
          button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
        });
      }
      act(() => button.click());
      expect(onClick).not.toHaveBeenCalled();
      button = renderButton(example(false));
      act(() => button.click());
      expect(onClick).toHaveBeenCalledOnce();
    },
  );

  it.each(['Button', 'IconButton', 'TextButton'] as const)(
    'preserves %s out-of-tab-order semantics for actions and native links',
    (kind) => {
      const action =
        kind === 'Button' ? (
          <Button tabIndex={-1}>Open</Button>
        ) : kind === 'IconButton' ? (
          <IconButton label="Open" tabIndex={-1}>
            O
          </IconButton>
        ) : (
          <TextButton tabIndex={-1}>Open</TextButton>
        );
      expect(renderButton(action).tabIndex).toBe(-1);
      const link =
        kind === 'Button' ? (
          <Button href="#details" tabIndex={-1}>
            Open
          </Button>
        ) : kind === 'IconButton' ? (
          <IconButton href="#details" label="Open" tabIndex={-1}>
            O
          </IconButton>
        ) : (
          <TextButton href="#details" tabIndex={-1}>
            Open
          </TextButton>
        );
      act(() => root?.render(<DesignSystemProvider>{link}</DesignSystemProvider>));
      const anchor = container?.querySelector('a');
      expect(anchor).toHaveAttribute('href', '#details');
      expect(anchor?.tabIndex).toBe(-1);
      expect(anchor?.hasAttribute('role')).toBe(false);
    },
  );

  it('keeps named slots and trailing indicator in source order without extending the action name', () => {
    const button = renderButton(
      <Button
        leftSection={<span aria-hidden>L</span>}
        rightSection={<span aria-hidden>R</span>}
        indicator="menu"
        aria-haspopup="menu"
        aria-expanded={false}
      >
        Options
      </Button>,
    );
    expect(button).toHaveAccessibleName('Options');
    const parts = button.querySelectorAll('[data-position], [data-control-indicator]');
    expect(
      Array.from(parts).map(
        (part) => part.getAttribute('data-position') ?? part.getAttribute('data-control-indicator'),
      ),
    ).toEqual(['left', 'right', 'menu']);
    expect(button.querySelector('[data-control-indicator]')).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['Button', 'IconButton'] as const)(
    'removes navigation affordances and callbacks from an unavailable %s link',
    (kind) => {
      const onClick = vi.fn();
      const onNavigate = vi.fn();
      for (const unavailable of [{ disabled: true }, { loading: true }]) {
        const link =
          kind === 'Button' ? (
            <Button href="#details" {...unavailable} onClick={onClick} onNavigate={onNavigate}>
              Open
            </Button>
          ) : (
            <IconButton href="#details" label="Open" {...unavailable} onClick={onClick} onNavigate={onNavigate}>
              O
            </IconButton>
          );
        act(() => root?.render(<DesignSystemProvider>{link}</DesignSystemProvider>));
        const inactive = container?.querySelector('[role="link"]') as HTMLElement;
        expect(inactive).toHaveAttribute('aria-disabled', 'true');
        expect(container?.querySelector('a')).toBeNull();
        expect(inactive.hasAttribute('tabindex')).toBe(false);
        act(() => inactive.click());
      }
      expect(onClick).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
    },
  );

  it('projects runtime spread props through the closed owner contract', () => {
    const escape = {
      style: { color: 'magenta' },
      className: 'caller-style',
      color: 'pink',
      radius: 'xl',
      'data-tone': 'danger',
      'data-geul-theme': 'dark',
      'data-core-owner': 'foreign',
      'data-active': 'true',
      'data-testid': 'native-affordance',
    };
    const button = renderButton(<Button {...(escape as unknown as ButtonActionProps)}>Save</Button>);
    expect(button.hasAttribute('style')).toBe(false);
    expect(button.classList.contains('caller-style')).toBe(false);
    expect(button.getAttribute('data-tone')).toBe('neutral');
    expect(button.hasAttribute('radius')).toBe(false);
    expect(button.hasAttribute('data-geul-theme')).toBe(false);
    expect(button.hasAttribute('data-core-owner')).toBe(false);
    expect(button.hasAttribute('data-active')).toBe(false);
    expect(button.getAttribute('data-testid')).toBe('native-affordance');
  });
  it('inherits one header row density across action kinds while leaving inline text geometry intrinsic', () => {
    act(() =>
      root?.render(
        <>
          <PageHeader
            title="Posts"
            actions={
              <>
                <Button>New post</Button>
                <IconButton label="Search">+</IconButton>
                <TextButton>Open</TextButton>
              </>
            }
          />
          <TextButton>Inline details</TextButton>
        </>,
      ),
    );
    const actions = container?.querySelectorAll('[data-control-kind]');
    expect(Array.from(actions ?? []).map((node) => node.getAttribute('data-control-size'))).toEqual([
      'sm',
      'sm',
      'sm',
      null,
    ]);
  });
  it('keeps multiline labels inside a named shared contract', () => {
    const button = renderButton(<Button labelWrap="wrap">Subscribe to newsletter updates</Button>);
    expect(button.getAttribute('data-label-wrap')).toBe('wrap');
    expect(button.textContent).toContain('newsletter updates');
  });
});
