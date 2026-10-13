// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import axe from 'axe-core';
import { PureArgsTable, TextControl, type TextProps } from '@storybook/addon-docs/blocks';
import { ThemeProvider, convert, themes } from 'storybook/theming';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const render = (children: ReactNode) =>
  act(() => root.render(<ThemeProvider theme={convert(themes.light)}>{children}</ThemeProvider>));
const auditNames = async () => {
  const report = await axe.run(host, {
    runOnly: { type: 'rule', values: ['label', 'label-title-only', 'label-content-name-mismatch'] },
  });
  if (host.querySelector('textarea')) {
    expect(report.passes.find(({ id }) => id === 'label')?.nodes.length).toBeGreaterThan(0);
  }
  return report;
};

function EditableTextControl({ onChange, ...props }: TextProps) {
  const [value, setValue] = useState(props.value);
  return (
    <TextControl
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('installed Storybook Docs string controls', () => {
  it('names each textarea by its property while preserving IDs, callbacks, limits and required state', async () => {
    const changed = vi.fn();
    const focused = vi.fn();
    const blurred = vi.fn();
    render(
      <>
        <EditableTextControl
          name="children"
          storyId="core-actions-button--default"
          controlsId="docs-review"
          value="Save"
          maxLength={20}
          required
          onChange={changed}
          onFocus={focused}
          onBlur={blurred}
        />
        <TextControl name="title" value="Preview title" onChange={vi.fn()} argType={{ table: { readonly: true } }} />
      </>,
    );
    const [children, title] = host.querySelectorAll('textarea');
    expect(children).toHaveAccessibleName('children');
    expect(title).toHaveAccessibleName('title');
    expect(children).toHaveAttribute('id', 'control-docs-review-core-actions-button--default-children');
    expect(children).toHaveAttribute('name', 'children');
    expect(children).toHaveAttribute('maxlength', '20');
    expect(children).toHaveAttribute('aria-required', 'true');
    expect(children).toHaveValue('Save');
    expect(title).toBeDisabled();
    await act(async () => {
      children.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(children, 'Publish');
      children.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(changed).toHaveBeenCalledWith('Publish');
    expect(children).toHaveValue('Publish');
    expect(focused).toHaveBeenCalledTimes(1);
    await act(async () => children.blur());
    expect(blurred).toHaveBeenCalledTimes(1);
    expect((await auditNames()).violations).toEqual([]);
  });

  it('distinguishes unset string properties while retaining the visible setter wording and activation', async () => {
    const changed = vi.fn();
    const readOnlyChanged = vi.fn();
    render(
      <>
        <EditableTextControl
          name="children"
          storyId="core-actions-button--default"
          controlsId="docs-review"
          onChange={changed}
        />
        <TextControl name="title" onChange={readOnlyChanged} argType={{ table: { readonly: true } }} />
      </>,
    );
    const [children, title] = host.querySelectorAll('button');
    expect(children).toHaveTextContent('Set string');
    expect(title).toHaveTextContent('Set string');
    expect(children).toHaveAccessibleName('Set string for children');
    expect(title).toHaveAccessibleName('Set string for title');
    expect(children).toHaveAttribute('id', 'set-docs-review-core-actions-button--default-children');
    expect(title).toHaveAttribute('aria-disabled', 'true');
    await act(async () => title.click());
    expect(readOnlyChanged).not.toHaveBeenCalled();
    expect((await auditNames()).violations).toEqual([]);
    await act(async () => children.click());
    expect(changed).toHaveBeenCalledWith('');
    const textarea = host.querySelector('textarea')!;
    expect(textarea).toHaveAccessibleName('children');
    expect(textarea).toHaveValue('');
    expect(document.activeElement).toBe(textarea);
    expect((await auditNames()).violations).toEqual([]);
  });

  it('exposes distinct property names through the public ArgsTable integration', async () => {
    const updated = vi.fn();
    render(
      <PureArgsTable
        rows={{
          children: { name: 'children', control: { type: 'text' } },
          title: { name: 'title', control: { type: 'text' } },
        }}
        args={{ children: 'Save', title: 'Draft title' }}
        storyId="core-actions-button--default"
        controlsId="docs-review"
        updateArgs={updated}
      />,
    );
    const [children, title] = host.querySelectorAll('textarea');
    const audit = await auditNames();
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
    expect(children).toHaveAccessibleName('children');
    expect(title).toHaveAccessibleName('title');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(title, 'Published title');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(updated).toHaveBeenCalledWith({ title: 'Published title' });
  });
});
