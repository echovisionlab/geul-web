// @vitest-environment jsdom

import { act, useEffect, type PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemDocs } from './DesignSystemDocs';

const fixture = vi.hoisted(() => ({ title: '', theme: 'ocean-light', mounted: vi.fn(), unmounted: vi.fn() }));

vi.mock('@storybook/addon-docs/blocks', async () => {
  const { createContext } = await import('react');
  return {
    DocsContext: createContext({
      componentStories: () => [{ id: 'example--default', name: 'Default', moduleExport: {} }],
    }),
    useOf: () => ({ preparedMeta: { title: fixture.title } }),
    Title: () => <h1>{fixture.title}</h1>,
    Description: () => null,
    Canvas: () => {
      useEffect(() => {
        fixture.mounted();
        return () => fixture.unmounted();
      }, []);
      return <div data-testid="live-canvas">{fixture.theme}</div>;
    },
    Controls: () => <div data-testid="live-controls">Controls</div>,
  };
});
vi.mock('../stories/design-system/components/component-docs.generated.json', () => ({ default: { components: [] } }));
vi.mock('../stories/design-system/pages/PageDocumentation', () => ({ PageContractDocumentation: () => null }));
vi.mock('../components/core/Display', () => ({
  ScrollArea: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

const trigger = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[data-accordion-control]')!;
const clickTrigger = (host: HTMLElement) => act(() => trigger(host).click());
const canvas = (host: HTMLElement) => host.querySelector('[data-testid="live-canvas"]');
const controls = (host: HTMLElement) => host.querySelector('[data-testid="live-controls"]');
let unmount = () => {};

function renderDocument(theme: string, title: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  const rerender = (nextTheme: string, nextTitle: string) => {
    act(() => root.render(<Document theme={nextTheme} title={nextTitle} />));
  };
  rerender(theme, title);
  return { host, rerender };
}

function Document({ theme, title }: { theme: string; title: string }) {
  fixture.title = title;
  fixture.theme = theme;
  return (
    <section key={theme} data-theme={theme}>
      <DesignSystemDocs />
    </section>
  );
}

beforeEach(() => {
  fixture.mounted.mockClear();
  fixture.unmounted.mockClear();
});
afterEach(() => unmount());

describe('live documentation preview expansion', () => {
  it('retains an open Canvas and Controls after the Docs tree actually remounts for a theme change', () => {
    const title = 'Core/Review/Open across themes';
    const view = renderDocument('ocean-light', title);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'false');
    expect(canvas(view.host)).not.toBeInTheDocument();
    clickTrigger(view.host);
    expect(canvas(view.host)).toHaveTextContent('ocean-light');
    expect(controls(view.host)).toBeInTheDocument();

    view.rerender('ocean-dark', title);
    expect(fixture.unmounted).toHaveBeenCalledTimes(1);
    expect(fixture.mounted).toHaveBeenCalledTimes(2);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'true');
    expect(canvas(view.host)).toHaveTextContent('ocean-dark');
    expect(controls(view.host)).toBeInTheDocument();
  });

  it('retains an explicit close through later remounts', () => {
    const title = 'Core/Review/Close across themes';
    const view = renderDocument('ocean-light', title);
    clickTrigger(view.host);
    clickTrigger(view.host);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'false');
    view.rerender('ocean-dark', title);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'false');
    expect(canvas(view.host)).not.toBeInTheDocument();
    expect(controls(view.host)).not.toBeInTheDocument();
    expect(fixture.mounted).toHaveBeenCalledTimes(1);
  });

  it('keeps different Core titles independent, including navigation without a remount', () => {
    const first = 'Core/Review/Independent first';
    const second = 'Core/Review/Independent second';
    const view = renderDocument('ocean-light', first);
    clickTrigger(view.host);
    view.rerender('ocean-light', second);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'false');
    expect(canvas(view.host)).not.toBeInTheDocument();
    clickTrigger(view.host);
    clickTrigger(view.host);

    view.rerender('ocean-dark', first);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'true');
    expect(controls(view.host)).toBeInTheDocument();
    view.rerender('ocean-dark', second);
    expect(trigger(view.host)).toHaveAttribute('aria-expanded', 'false');
    expect(controls(view.host)).not.toBeInTheDocument();
  });
});
