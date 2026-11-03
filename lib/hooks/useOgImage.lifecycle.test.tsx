// @vitest-environment jsdom
import { act, renderHook } from '@/test/render';
import { expect, it, vi } from 'vitest';
import { useOgImage, type OgImageReadBindings } from './useOgImage';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

it('rejects latest discovery after unmount and refuses detached tracking commands', async () => {
  const lookup = Promise.withResolvers<Awaited<ReturnType<OgImageReadBindings['latest']>>>();
  const latest = vi.fn<OgImageReadBindings['latest']>(() => lookup.promise);
  const generation = vi.fn<OgImageReadBindings['generation']>();
  const readBindings = { latest, generation };
  const { result, unmount } = renderHook(() =>
    useOgImage({ entityType: 'post', entityId: 'post-1', locale: 'ko', provider: null, readBindings }),
  );
  const controller = result.current;
  let completion!: Promise<boolean>;
  act(() => {
    completion = controller.trackLatest();
  });
  unmount();
  let accepted!: boolean;
  await act(async () => {
    lookup.resolve({ ok: true, generation: { generationId: 'detached', runId: 'run-detached', status: 'processing' } });
    accepted = await completion;
  });
  expect(accepted).toBe(false);
  const calls = latest.mock.calls.length;
  expect(await controller.trackLatest()).toBe(false);
  expect(controller.trackGeneration('detached')).toBe(false);
  expect(controller.trackRequestedGeneration(null, controller.targetKey)).toBe(false);
  expect(latest).toHaveBeenCalledTimes(calls);
  expect(generation).not.toHaveBeenCalled();
});
