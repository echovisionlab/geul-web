// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { TestProviders } from '@/test/TestProviders';
import { PageBlockSettingsSurface } from './PageBlockSettingsSurface';
import { usePageSectionTypeLabels } from './usePageSectionTypeLabels';

const screen = vi.hoisted(() => ({ mobile: false }));
vi.mock('@mantine/hooks', () => ({ useMediaQuery: () => screen.mobile }));
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

function Harness({ onClose }: { onClose: () => void }) {
  const sectionLabels = usePageSectionTypeLabels();
  return (
    <PageBlockSettingsSurface
      opened
      onClose={onClose}
      title={sectionLabels['rich-text']}
      blockSettings={<input aria-label="Block setting" defaultValue="Existing value" />}
      sectionSettings={<input aria-label="Section setting" defaultValue="Existing section" />}
    />
  );
}

describe('PageBlockSettingsSurface', () => {
  it.each([
    ['en', enMessages, false],
    ['ko', koMessages, false],
    ['en', enMessages, true],
    ['ko', koMessages, true],
  ] as const)('names its tablist from the existing %s section title in layout case %#', (locale, messages, mobile) => {
    screen.mobile = mobile;
    const onClose = vi.fn();
    act(() =>
      root.render(
        <TestProviders locale={locale} messages={messages}>
          <Harness onClose={onClose} />
        </TestProviders>,
      ),
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    const title = messages.pageEditor.sectionTypes.richText;
    expect(dialog).toHaveAccessibleName(title);
    const list = dialog?.querySelector('[role="tablist"]');
    expect(list).toHaveAccessibleName(title);
    const tabs = dialog!.querySelectorAll<HTMLElement>('[role="tab"]');
    expect(tabs[0]).toHaveAccessibleName(messages.pageEditor.sectionItem.settings.tabs.block);
    expect(tabs[1]).toHaveAccessibleName(messages.pageEditor.sectionItem.settings.tabs.section);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(dialog?.querySelector('input[aria-label="Block setting"]')).not.toBeNull();
    act(() => tabs[1].click());
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    const panel = document.getElementById(tabs[1].getAttribute('aria-controls')!);
    expect(panel).toHaveAccessibleName(messages.pageEditor.sectionItem.settings.tabs.section);
    expect(panel?.querySelector('input[aria-label="Section setting"]')).not.toBeNull();
    expect(dialog?.querySelector('input[aria-label="Block setting"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
