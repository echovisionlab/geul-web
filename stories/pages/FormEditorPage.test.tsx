// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { within } from 'storybook/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import meta from './FormEditorPage.stories';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams('edit=true&lang=ko'),
  usePathname: () => '/forms/local-form',
}));
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
const Preview = meta.component;
async function render(tab: 'builder' | 'settings' | 'translations' | 'submissions', detail = false) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <TestProviders>
        <Preview tab={tab} detail={detail} />
      </TestProviders>,
    );
  });
}
describe('complete form editing surfaces', () => {
  it.each(['builder', 'settings', 'translations', 'submissions'] as const)(
    'connects %s to its selected named tabpanel',
    async (tab) => {
      await render(tab);
      const canvas = within(host);
      const panel = await vi.waitFor(() => canvas.getByRole('tabpanel'));
      const selected = canvas.getAllByRole('tab').find((item) => item.getAttribute('aria-selected') === 'true');
      expect(selected).toBeTruthy();
      expect(panel.getAttribute('aria-labelledby')).toBe(selected?.id);
      expect(selected?.getAttribute('aria-controls')).toBe(panel.id);
      // Inactive remote-route tabs have no rendered panel. The active surface
      // supplies the relationship and inactive controls cannot leak into its tree.
      expect(canvas.getAllByRole('tabpanel')).toHaveLength(1);
    },
  );

  // Response order and rendering are covered in features/form/SubmissionDetail.test.tsx.
  it('renders submission details inside the actual editor tab', async () => {
    await render('submissions', true);
    await vi.waitFor(() => expect(host.textContent).toContain('June Han'));
    expect(host.textContent).toContain('Metadata');
  });
});
