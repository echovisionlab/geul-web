// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { IconHistory } from '@tabler/icons-react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { EditorHeader } from '.';

vi.mock('@/components/core/DropdownMenu', async () => {
  const React = await import('react');

  const DropdownMenuContext = React.createContext<{
    opened: boolean;
    setOpened: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  function MockDropdownMenu({ children }: { children: ReactNode }) {
    const [opened, setOpened] = React.useState(false);

    return <DropdownMenuContext.Provider value={{ opened, setOpened }}>{children}</DropdownMenuContext.Provider>;
  }

  function MockDropdownMenuTarget({ children }: { children: ReactNode }) {
    const context = React.useContext(DropdownMenuContext);
    const child = children as React.ReactElement<{ onClick?: (event: MouseEvent) => void }>;

    return React.cloneElement(child, {
      onClick: (event: MouseEvent) => {
        child.props.onClick?.(event);
        context?.setOpened((opened) => !opened);
      },
    });
  }

  function MockDropdownMenuDropdown({ children }: { children: ReactNode }) {
    const context = React.useContext(DropdownMenuContext);

    if (!context?.opened) {
      return null;
    }

    return <div data-testid="menu-dropdown">{children}</div>;
  }

  function MockDropdownMenuItem({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) {
    return (
      <button type="button" role="menuitem" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }

  function MockDropdownMenuLabel({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function MockDropdownMenuDivider() {
    return <hr />;
  }

  return {
    DropdownMenu: Object.assign(MockDropdownMenu, {
      Target: MockDropdownMenuTarget,
      Dropdown: MockDropdownMenuDropdown,
      Item: MockDropdownMenuItem,
      Label: MockDropdownMenuLabel,
      Divider: MockDropdownMenuDivider,
    }),
  };
});

vi.mock('@/components/core/Input', () => ({
  TextInput: ({
    onChange,
    value,
    placeholder,
    disabled,
  }: {
    onChange?: (event: { currentTarget: { value: string } }) => void;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange?.({ currentTarget: { value: event.currentTarget.value } })}
    />
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function mockMatchMedia(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  mockMatchMedia(false);
});

function renderEditorHeader(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  expect(element).not.toBeUndefined();

  act(() => {
    element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await flushUpdates();
}

async function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await flushUpdates();
}

describe('EditorHeader', () => {
  it('keeps an empty title as a local draft and only emits non-empty titles', async () => {
    const onTitleChange = vi.fn();

    renderEditorHeader(
      <EditorHeader
        title="Existing title"
        titlePlaceholder="Untitled Page"
        onTitleChange={onTitleChange}
        isConnected
        isSynced
        onBack={vi.fn()}
      />,
    );

    const titleInput = document.querySelector('input[placeholder="Untitled Page"]') as HTMLInputElement;
    await changeInput(titleInput, '');

    expect(titleInput.value).toBe('');
    expect(onTitleChange).not.toHaveBeenCalled();

    await changeInput(titleInput, 'Renamed page');

    expect(onTitleChange).toHaveBeenCalledOnce();
    expect(onTitleChange).toHaveBeenCalledWith('Renamed page');
  });

  it('groups sync state, status actions, and collab actions under the Collab menu', async () => {
    const onBack = vi.fn();
    const onDelete = vi.fn();
    const onStatusChange = vi.fn();
    const onVersionHistory = vi.fn();

    renderEditorHeader(
      <EditorHeader
        title="Hello"
        status="draft"
        statusOptions={[
          { value: 'draft', label: 'Draft', actionLabel: 'Move to Draft', tone: 'neutral' },
          { value: 'published', label: 'Published', actionLabel: 'Publish', tone: 'positive' },
          { value: 'archived', label: 'Archived', actionLabel: 'Archive', tone: 'danger' },
        ]}
        isConnected={false}
        isSynced={false}
        onBack={onBack}
        onDelete={onDelete}
        onTitleChange={vi.fn()}
        onStatusChange={onStatusChange}
        groupStatusWithCollab
        collabActions={[
          {
            label: 'Version History',
            onClick: onVersionHistory,
            icon: <IconHistory size={14} />,
          },
        ]}
      />,
    );

    const backButton = document.querySelector('button');
    const titleInput = document.querySelector('input[placeholder="Untitled"]') as HTMLInputElement | null;
    const collabButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Draft · Collab'),
    );

    await clickElement(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(titleInput).not.toBeNull();

    await clickElement(collabButton);

    expect(document.body.textContent).toContain('Connection');
    expect(document.body.textContent).toContain('Offline');
    expect(collabButton?.textContent).toContain('Draft');
    expect(document.body.textContent).toContain('Status');
    expect(document.body.textContent).toContain('Current');
    expect(document.body.textContent).toContain('Draft');
    expect(document.body.textContent).toContain('Actions');
    expect(document.body.textContent).toContain('Publish');
    expect(document.body.textContent).toContain('Archive');
    expect(document.body.textContent).toContain('Version History');
    expect(document.body.textContent).not.toContain('Change Status');
    expect(document.querySelector('[data-collab-status="offline"]')).not.toBeNull();

    await clickElement(
      Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === 'Publish'),
    );
    await clickElement(
      Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === 'Version History'),
    );
    await clickElement(document.querySelector('[data-editor-delete]'));

    expect(onStatusChange).toHaveBeenCalledWith('published');
    expect(onVersionHistory).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders a single inline status action when only one alternative exists', async () => {
    const onStatusChange = vi.fn();

    renderEditorHeader(
      <EditorHeader
        title="Hello"
        status="published"
        statusOptions={[
          { value: 'draft', label: 'Draft', actionLabel: 'Unpublish', tone: 'neutral' },
          { value: 'published', label: 'Published', actionLabel: 'Publish', tone: 'positive' },
        ]}
        isConnected
        isSynced
        onBack={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    expect(document.querySelector('[data-collab-status="synced"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Published');
    expect(document.body.textContent).toContain('Unpublish');
    expect(document.body.textContent).not.toContain('Change Status');

    await clickElement(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Unpublish')),
    );

    expect(onStatusChange).toHaveBeenCalledWith('draft');
  });

  it('renders a change status menu for multiple alternatives when collab grouping is disabled', async () => {
    const onStatusChange = vi.fn();

    renderEditorHeader(
      <EditorHeader
        title=""
        status="draft"
        statusOptions={[
          { value: 'draft', label: 'Draft', actionLabel: 'Move to Draft', tone: 'neutral' },
          { value: 'published', label: 'Published', actionLabel: 'Publish', tone: 'positive' },
          { value: 'archived', label: 'Archived', actionLabel: 'Archive', tone: 'danger' },
        ]}
        isConnected
        isSynced={false}
        onBack={vi.fn()}
        onStatusChange={onStatusChange}
        actions={<button type="button">Preview</button>}
      />,
    );

    expect(document.body.textContent).toContain('Untitled');
    expect(document.body.textContent).toContain('Preview');
    expect(document.querySelector('[data-collab-status="syncing"]')).not.toBeNull();

    await clickElement(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Change Status')),
    );

    expect(document.body.textContent).toContain('Publish');
    expect(document.body.textContent).toContain('Archive');

    await clickElement(
      Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === 'Archive'),
    );

    expect(onStatusChange).toHaveBeenCalledWith('archived');
  });

  it('renders static titles, inline metadata, controls, and standardized action items', async () => {
    const onPrimaryAction = vi.fn();
    const onIconAction = vi.fn();

    renderEditorHeader(
      <EditorHeader
        title="Contact form"
        status="draft"
        statusOptions={[
          { value: 'draft', label: 'Draft', actionLabel: 'Move to Draft', tone: 'neutral' },
          { value: 'published', label: 'Published', actionLabel: 'Publish', tone: 'positive' },
        ]}
        isConnected
        isSynced
        onBack={vi.fn()}
        controls={<button type="button">Locale control</button>}
        actionItems={[
          {
            key: 'preview',
            label: 'Preview',
            onClick: onPrimaryAction,
          },
          {
            key: 'history',
            label: 'Version history',
            ariaLabel: 'Open version history',
            iconOnly: true,
            icon: <IconHistory size={14} />,
            onClick: onIconAction,
          },
        ]}
      />,
    );

    expect(document.querySelector('h1')?.textContent).toBe('Contact form');
    expect(document.body.textContent).toContain('Draft');
    expect(document.querySelector('[data-collab-status="synced"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Locale control');
    expect(document.body.textContent).toContain('Preview');

    await clickElement(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Preview')),
    );
    await clickElement(document.querySelector('button[aria-label="Open version history"]'));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onIconAction).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="editor-header-collab-button"]')).toBeNull();
    expect(document.querySelector('[data-testid="editor-header-change-status"]')).toBeNull();
  });

  it('moves editor controls into a single mobile action bar', () => {
    mockMatchMedia(true);

    renderEditorHeader(
      <EditorHeader
        title="Mobile post"
        status="draft"
        statusOptions={[
          { value: 'draft', label: 'Draft', actionLabel: 'Move to Draft', tone: 'neutral' },
          { value: 'published', label: 'Published', actionLabel: 'Publish', tone: 'positive' },
        ]}
        isConnected
        isSynced
        onBack={vi.fn()}
        onTitleChange={vi.fn()}
        onStatusChange={vi.fn()}
        groupStatusWithCollab
        controls={<button type="button">Locale control</button>}
        actionItems={[
          {
            key: 'fullscreen',
            label: 'Fullscreen',
            ariaLabel: 'Open fullscreen',
            iconOnly: true,
            icon: <IconHistory size={14} />,
            onClick: vi.fn(),
          },
        ]}
      />,
    );

    const mobileRoot = document.querySelector('[data-testid="editor-header-mobile"]');
    const mobileActionBar = document.querySelector('[data-testid="editor-header-mobile-action-bar"]');

    expect(mobileRoot).not.toBeNull();
    expect(mobileActionBar).not.toBeNull();
    expect(mobileActionBar?.textContent).toContain('Draft · Collab');
    expect(mobileActionBar?.textContent).toContain('Locale control');
    expect(document.querySelector('[data-testid="editor-header"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Open fullscreen"]')).not.toBeNull();
  });

  it('requires confirmation before invoking delete when deleteConfirmation is provided', async () => {
    const onDelete = vi.fn();

    renderEditorHeader(
      <EditorHeader
        title="Hello"
        isConnected
        isSynced
        onBack={vi.fn()}
        onDelete={onDelete}
        deleteConfirmation={{
          title: 'Delete post',
          message: 'Are you sure you want to delete this post?',
        }}
      />,
    );

    await clickElement(document.querySelector('[data-editor-delete]'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Delete post');
    expect(document.body.textContent).toContain('Are you sure you want to delete this post?');

    await clickElement(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Delete'),
    );

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
