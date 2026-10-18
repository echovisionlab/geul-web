// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemProvider } from '../lib/providers/DesignSystemProvider';
import { NextIntlClientProvider } from 'next-intl';
import { Button } from '../components/core/Button';
import { PageHeader } from '../components/core/PageHeader';
import { TextInput } from '../components/core/Input';
import koMessages from '../messages/ko.json';
import { createStorybookText, localizeFixtureArgs, localizeFixtureTree } from './fixture-i18n';
import { coreFixtureAliases } from './core-fixture-aliases';
import { kitFixtureMessages } from './kit-fixture-messages';
import { SUPPORTED_LOCALES } from '../lib/i18n/locale';
import { PreviewFrame } from '../stories/shared/PreviewFrame';

const korean = createStorybookText('ko', koMessages);
const saved = koMessages.common.actions.save;
const opened = koMessages.common.actions.open;
let cleanup = () => {};
afterEach(() => {
  cleanup();
  cleanup = () => {};
});

describe('Storybook fixture localization', () => {
  it('keeps review instructions English while relocalizing the live specimen', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    cleanup = () => {
      act(() => root.unmount());
      host.remove();
    };
    const fixture = localizeFixtureTree(
      <PreviewFrame title="Save" description="Name">
        <Button>Save</Button>
      </PreviewFrame>,
      korean,
    );
    act(() =>
      root.render(
        <NextIntlClientProvider locale="ko" messages={koMessages}>
          <DesignSystemProvider locale="ko" forceTheme="ocean-dark">
            {fixture}
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      ),
    );
    expect(host.querySelector('main')?.lang).toBe('en');
    expect(host.querySelector('h1')?.textContent).toBe('Save');
    expect(host.querySelector('button')?.textContent).toBe(saved);
    expect(host.querySelector('button')?.closest('[lang]')?.getAttribute('lang')).toBe('ko');
    expect(document.documentElement.dataset.geulThemeId).toBe('ocean-dark');
  });
  it('keeps fixture vocabulary and production alias coverage complete for every toolbar locale', () => {
    const catalogs = import.meta.glob('../messages/*.json', { eager: true, import: 'default' });
    for (const locale of SUPPORTED_LOCALES) {
      const words = kitFixtureMessages[locale];
      expect(Object.keys(words).sort()).toEqual(Object.keys(kitFixtureMessages.en).sort());
      for (const [key, value] of Object.entries(words)) {
        expect(value, `${locale}: ${key}`).toBeTruthy();
        expect(value.match(/\{\w+\}/g)?.sort()).toEqual(key.match(/\{\w+\}/g)?.sort());
      }
      const catalog = catalogs[`../messages/${locale}.json`] as Record<string, unknown>;
      for (const path of Object.values(coreFixtureAliases)) {
        const value = path
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalog);
        expect(typeof value, `${locale}: ${path}`).toBe('string');
      }
    }
  });
  it('translates label callbacks and nested UI without changing authored values or event handlers', () => {
    const onChange = vi.fn();
    const input = (
      <TextInput
        id="fixture-field"
        name="fixtureName"
        value="Save"
        label="Name"
        onChange={onChange}
        aria-label="Save"
      />
    );
    const output = localizeFixtureTree(input, korean) as ReactElement<typeof input.props>;
    expect(output.props.label).toBe(koMessages.common.labels.name);
    expect(output.props['aria-label']).toBe(saved);
    expect(output.props.value).toBe('Save');
    expect(output.props.name).toBe('fixtureName');
    expect(output.props.id).toBe('fixture-field');
    expect(output.props.onChange).toBe(onChange);
    const args = localizeFixtureArgs({ labels: { action: () => 'Save' }, href: '/Save', value: 'Name' }, korean);
    expect(args.labels.action()).toBe(saved);
    expect(args.href).toBe('/Save');
    expect(args.value).toBe('Name');
  });

  it('applies the same table localization to args and JSX while retaining row data', () => {
    const row = { id: 'record-one', name: 'Name' };
    const args = {
      rows: [row],
      columns: [
        { key: 'name', header: 'Name', renderCell: (item: typeof row) => item.name },
        { key: 'action', header: 'Actions', renderCell: () => <Button>Open</Button> },
      ],
      emptyMessage: 'No records found.',
    };
    const output = localizeFixtureArgs(args, korean);
    expect(output.rows).toBe(args.rows);
    expect(output.columns[0].key).toBe('name');
    expect(output.columns[0].header).toBe(koMessages.common.labels.name);
    expect(output.columns[0].renderCell(row)).toBe('Name');
    const cell = output.columns[1].renderCell(row) as ReactElement<{ children: string }>;
    expect(cell.props.children).toBe(opened);
  });

  it('localizes React action slots and arrays without changing their click handlers', () => {
    const onClick = vi.fn();
    const button = <Button onClick={onClick}>New post</Button>;
    const header = <PageHeader title="Posts" actions={<>{button}</>} />;
    const output = localizeFixtureTree(header, korean) as ReactElement<typeof header.props>;
    const actions = output.props.actions as ReactElement<{ children: ReactElement<typeof button.props> }>;
    expect(actions.props.children.props.children).toBe(koMessages.posts.createTooltip);
    expect(actions.props.children.props.onClick).toBe(onClick);
    const args = localizeFixtureArgs({ actions: [button, { label: 'Save', onClick }] }, korean);
    const action = args.actions[0] as ReactElement<typeof button.props>;
    expect(action.props.children).toBe(koMessages.posts.createTooltip);
    expect(action.props.onClick).toBe(onClick);
    expect(args.actions[1]).toEqual({ label: saved, onClick });
  });
});
