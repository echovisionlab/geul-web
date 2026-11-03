// @vitest-environment jsdom

import { act, renderHook } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emailLayoutLocaleValuesMap,
  hydrateEmailLayoutCanonicalRoom,
  type EmailLayoutUnit,
} from '@echovisionlab/geul-common/collaboration/email-layout';
import * as Y from 'yjs';
import { useEmailLayoutCollaboration } from './useSourceDocumentCollaboration';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { announceSignOut, resetActiveMemberForTests, syncActiveMember } from '@/lib/auth/active-member';

const { provider, transport } = vi.hoisted(() => ({ provider: {}, transport: { isSynced: true } }));

const layoutId = '11111111-1111-4111-8111-111111111111';
const unit: EmailLayoutUnit = {
  handle: 'unit:22222222-2222-4222-8222-222222222222:text',
  kind: 'text',
  element: '',
  attribute: '',
  order: 0,
  sourceValue: 'Source value',
};
let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof useEmailLayoutCollaboration> | null = null;
let view: ReturnType<typeof renderSession> | null = null;

vi.mock('@/lib/hooks/useHocuspocusConnection', () => ({
  useHocuspocusConnection: () => ({
    provider,
    doc: mockDoc,
    isConnected: true,
    isSynced: transport.isSynced,
  }),
}));

function renderSession(locale: string) {
  return renderHook(({ locale, id }) => useEmailLayoutCollaboration(id, locale), {
    initialProps: { locale, id: layoutId },
  });
}
function renderHookSession(locale: string) {
  view = renderSession(locale);
  latestHook = view.result.current;
}

async function flush() {
  await act(async () => Promise.resolve());
}

function hook() {
  expect(latestHook).not.toBeNull();
  return view!.result.current;
}

beforeEach(() => {
  resetActiveMemberForTests();
  syncActiveMember('member-1');
  setProviderAccessLevel(provider, 'edit');
  mockDoc = hydrateEmailLayoutCanonicalRoom({
    sourceLocale: 'en',
    locale: 'ko',
    localeExists: true,
    contentHtml: '',
    units: [unit],
  });
  latestHook = null;
  transport.isSynced = true;
});

afterEach(() => {
  view?.unmount();
  view = null;
  resetActiveMemberForTests();
  mockDoc.destroy();
});

describe('useEmailLayoutCollaboration', () => {
  it('retains admitted target values on reconnect but gates an unsynced replacement document', () => {
    renderHookSession('ko');
    act(() => hook().setTargetValue(unit.handle, 'Kept target'));
    transport.isSynced = false;
    view!.rerender({ locale: 'ko', id: layoutId });
    expect(hook().targetUnits[0]?.value).toBe('Kept target');
    act(() => hook().setTargetValue(unit.handle, 'Offline write refused'));
    expect(hook().targetUnits[0]?.value).toBe('Kept target');
    const oldDoc = mockDoc;
    mockDoc = new Y.Doc();
    view!.rerender({ locale: 'ko', id: layoutId });
    expect(hook().targetUnits).toEqual([]);
    expect(hook().isDocumentReady).toBe(false);
    oldDoc.destroy();
  });

  it.each(['locale', 'target', 'member'])('does not reuse admission after the %s identity changes', (identity) => {
    renderHookSession('ko');
    const oldSetter = hook().setTargetValue;
    expect(hook().isDocumentReady).toBe(true);
    transport.isSynced = false;
    if (identity === 'member') {
      act(() => {
        announceSignOut();
      });
    } else {
      view!.rerender({
        locale: identity === 'locale' ? 'ja' : 'ko',
        id: identity === 'target' ? '33333333-3333-4333-8333-333333333333' : layoutId,
      });
    }
    expect(hook().isDocumentReady).toBe(false);
    expect(hook().targetUnits).toEqual([]);
    act(() => oldSetter(unit.handle, 'Stale editor write'));
    expect(emailLayoutLocaleValuesMap(mockDoc).has(unit.handle)).toBe(false);
  });

  it('upgrades and downgrades retained target setters on the same room', () => {
    setProviderAccessLevel(provider, 'view');
    renderHookSession('ko');
    const setTarget = hook().setTargetValue;
    const fallback = hook().useSourceFallback;
    act(() => setTarget(unit.handle, 'Denied'));
    expect(hook().targetUnits[0].value).toBe('Source value');
    act(() => {
      setProviderAccessLevel(provider, 'edit');
      setTarget(unit.handle, 'Editable');
    });
    expect(hook().targetUnits[0].value).toBe('Editable');
    act(() => {
      setProviderAccessLevel(provider, 'view');
      setTarget(unit.handle, 'Denied again');
      fallback(unit.handle);
    });
    expect(hook().targetUnits[0].value).toBe('Editable');
    expect(hook().doc).toBe(mockDoc);
    expect(hook().setTargetValue).toBe(setTarget);
  });
  it('edits sparse target values and restores source fallback through the canonical map', async () => {
    renderHookSession('ko');
    await flush();

    expect(hook().targetUnits[0]).toMatchObject({ value: 'Source value', localeValuePresent: false });
    act(() => hook().setTargetValue(unit.handle, ''));
    await flush();
    expect(emailLayoutLocaleValuesMap(mockDoc).get(unit.handle)).toBe('');
    expect(hook().targetUnits[0]).toMatchObject({ value: '', localeValuePresent: true });

    act(() => hook().useSourceFallback(unit.handle));
    await flush();
    expect(emailLayoutLocaleValuesMap(mockDoc).has(unit.handle)).toBe(false);
    expect(hook().targetUnits[0]).toMatchObject({ value: 'Source value', localeValuePresent: false });
  });

  it('does not expose target fields in the source raw-HTML room', async () => {
    mockDoc.destroy();
    mockDoc = hydrateEmailLayoutCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      localeExists: true,
      contentHtml: '<main>Source</main>',
      units: [unit],
    });
    renderHookSession('en');
    await flush();
    expect(hook().targetUnits).toEqual([]);
  });
});
