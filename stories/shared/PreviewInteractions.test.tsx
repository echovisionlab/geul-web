// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DesignSystemProvider } from '../../lib/providers/DesignSystemProvider';
import { createStorybookText } from '../../.storybook/fixture-i18n';
import { SUPPORTED_LOCALES } from '../../lib/i18n/locale';
import { kitFixtureMessages } from '../../.storybook/kit-fixture-messages';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import enMessages from '../../messages/en.json';
import koMessages from '../../messages/ko.json';
import { AccountPreview } from './AccountPreview';
import { CollectionFormPreview, CollectionTablePreview } from './CompositionPreviews';
import { ShareAccessPreview } from './PublicPreview';
import { VerificationPreview } from './VerificationPreview';
import { RouteCoveragePreview } from './RouteCoveragePreview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(node: ReactNode, locale: 'en' | 'ko' = 'en') {
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ko' ? koMessages : enMessages}>
        <DesignSystemProvider locale={locale}>{node}</DesignSystemProvider>
      </NextIntlClientProvider>,
    ),
  );
}
function input(selector: string, value: string) {
  const element = host.querySelector<HTMLInputElement>(selector);
  expect(element).not.toBeNull();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element!.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function click(text: string) {
  const button = Array.from(host.querySelectorAll<HTMLElement>('button, [role="tab"]')).find(
    (element) => element.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  act(() => button!.click());
}
function submit() {
  act(() => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

describe('Interactive UI kit adapters', () => {
  it('translates fixture controls for every toolbar locale while preserving authored values', () => {
    const catalogs = import.meta.glob('../../messages/*.json', { eager: true, import: 'default' });
    for (const locale of SUPPORTED_LOCALES) {
      const messages = catalogs[`../../messages/${locale}.json`] as AbstractIntlMessages;
      const text = createStorybookText(locale, messages);
      expect(text('Save')).toBe((messages.common as { actions: { save: string } }).actions.save);
      expect(text('Visibility')).toBe(kitFixtureMessages[locale].Visibility);
      expect(text('{count} selected · {shown} shown', { count: 2, shown: 3 })).not.toContain('{');
      expect(text('Field recordings')).toBe('Field recordings');
    }
  });
  it('relocalizes a mounted production form without discarding its draft or callback behavior', () => {
    render(<CollectionFormPreview />);
    input('input', 'Archive');
    render(<CollectionFormPreview />, 'ko');
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('Archive');
    expect(host.textContent).toContain(koMessages.common.labels.name);
    expect(host.textContent).toContain('공개 범위');
    submit();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Archive 생성됨');
    render(<CollectionFormPreview />);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Created Archive');
  });

  it('filters route coverage without converting uncovered routes into page previews', () => {
    render(
      <RouteCoveragePreview
        initialRecords={[
          {
            route: '/verify',
            family: 'Auth',
            source: 'app/verify/page.tsx',
            previews: [
              {
                storyTitle: 'Pages/Auth/Verification',
                variant: 'Flow',
                storyId: 'pages-auth-verification--flow',
                scope: 'Local verification view only',
              },
            ],
          },
          { route: '/admin/pages', family: 'Admin', source: 'app/admin/pages/page.tsx', previews: [] },
        ]}
      />,
      'ko',
    );
    expect(host.textContent).toContain('Find a page source');
    expect(host.querySelector('table')?.getAttribute('aria-label')).toBe('Route source mappings');
    expect(host.querySelector('[lang="en"]')).not.toBeNull();
    expect(host.textContent).toContain('2 sources · 1 static view/section mappings · 2 matching');
    input('input', 'ADMIN');
    expect(host.querySelectorAll('[data-datatable-desktop-row]')).toHaveLength(1);
    expect(host.textContent).toContain('No mapped page composition preview');
    expect(host.textContent).not.toContain('Local verification view only');
  });
  it('keeps invalid form drafts and submits only a valid local collection', () => {
    render(<CollectionFormPreview />);
    submit();
    expect(host.textContent).toContain('Enter a name.');
    expect(host.textContent).not.toContain('Created');
    input('input', 'Archive');
    submit();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Created Archive');
    click('Reset');
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('');
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('applies real table sort and selection callbacks while filtering preserves selection', () => {
    render(<CollectionTablePreview />);
    const firstRow = () =>
      host.querySelector('[data-datatable-desktop-row]')?.getAttribute('data-datatable-desktop-row');
    expect(firstRow()).toBe('field');
    const sortButton = host.querySelector<HTMLButtonElement>('[aria-label="Sort by Name"]')!;
    act(() => sortButton.click());
    expect(firstRow()).toBe('work');
    const selectAll = host.querySelector<HTMLInputElement>('[aria-label="Select all"]')!;
    act(() => selectAll.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe('3 selected · 3 shown');
    input('input:not([type="checkbox"])', 'Studio');
    expect(host.querySelectorAll('[data-datatable-desktop-row]')).toHaveLength(1);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('3 selected · 1 shown');
  });

  it('saves a production profile view and toggles the production subscription view', () => {
    render(<AccountPreview />);
    input('#profile-nickname', 'Mina');
    submit();
    expect(host.textContent).toContain('Profile saved: Mina');
    click('Email preferences');
    expect(host.querySelector('[data-subscription-state]')?.getAttribute('data-subscription-state')).toBe('subscribed');
    click('Unsubscribe from emails');
    expect(host.querySelector('[data-subscription-state]')?.getAttribute('data-subscription-state')).toBe(
      'unsubscribed',
    );
    expect(host.textContent).toContain('Email preference saved.');
  });

  it('commits table dialog edits only after submit and discards cancelled edits', () => {
    render(<CollectionTablePreview />);
    const openFirst = () =>
      act(() => host.querySelector<HTMLButtonElement>('[data-datatable-row-action-control="field"]')!.click());
    openFirst();
    const editName = (value: string) => {
      const field = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    editName('Cancelled edit');
    const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
      (button) => button.textContent === 'Cancel',
    )!;
    act(() => cancel.click());
    expect(host.textContent).toContain('Field recordings');
    expect(host.textContent).not.toContain('Cancelled edit');
    openFirst();
    editName('New recordings');
    act(() =>
      document
        .querySelector('[role="dialog"] form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    expect(host.textContent).toContain('New recordings');
    expect(host.querySelector('[data-datatable-row-action-control="field"]')?.textContent).toBe('Open New recordings');
  });

  it('keeps newsletter state when the fixture service reports an error', () => {
    render(<AccountPreview initialTab="newsletter" state="error" />);
    click('Unsubscribe from emails');
    expect(host.querySelector('[data-subscription-state]')?.getAttribute('data-subscription-state')).toBe('subscribed');
    expect(host.textContent).toContain('Preferences could not be saved.');
    expect(host.textContent).not.toContain('Email preference saved.');
  });

  it('drives the real verification view to code entry and back through its callbacks', () => {
    render(<VerificationPreview />);
    submit();
    expect(host.textContent).toContain('Check your email');
    expect(host.querySelector('[data-testid="verification-code-pin"]')).not.toBeNull();
    click('Start over');
    expect(host.textContent).toContain('Verify email');
    expect(host.querySelector('[data-testid="verification-code-pin"]')).toBeNull();
  });

  it('keeps the share gate closed for an incorrect password and unlocks the fixture with the right one', () => {
    render(<ShareAccessPreview />);
    input('input[name="password"]', 'wrong');
    submit();
    expect(host.textContent).toContain('Incorrect password.');
    input('input[name="password"]', 'preview');
    submit();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Preview access granted.');
    expect(host.querySelector('form')).toBeNull();
  });
});
