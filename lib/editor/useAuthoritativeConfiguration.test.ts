import { describe, expect, it } from 'vitest';
import { AuthoritativeConfiguration } from './useAuthoritativeConfiguration';
import { getEditorWriteOrigin } from './editor-write-origin';

function configuration(entity = crypto.randomUUID()) {
  return new AuthoritativeConfiguration(`post:${entity}`, { slug: 'initial', enabled: true, revision: 'r1' });
}

describe('authoritative editor configuration', () => {
  it('keeps queued and in-flight fields while adopting disjoint peer fields', () => {
    const state = configuration();
    state.edit({ slug: 'local' });
    const write = state.beginWrite({ slug: 'local' });
    const read = state.beginRead();
    state.adoptRead(read, { slug: 'peer', enabled: false, revision: 'r2' });
    expect(state.getConfiguration()).toEqual({ slug: 'local', enabled: false, revision: 'r2' });
    expect(state.getCanonical().slug).toBe('peer');
    write.fail();
    expect(state.getConfiguration().slug).toBe('local');
  });

  it('drops a read started before a newer write and a read started during its request', () => {
    const state = configuration();
    const before = state.beginRead();
    state.edit({ slug: 'saved' });
    const write = state.beginWrite({ slug: 'saved' });
    const during = state.beginRead();
    write.acknowledge({ slug: 'canonical' });
    expect(state.adoptRead(before, { slug: 'old', enabled: false })).toBe(false);
    expect(state.adoptRead(during, { slug: 'old', enabled: false })).toBe(false);
    expect(state.getConfiguration()).toEqual({ slug: 'canonical', enabled: true, revision: 'r1' });
  });

  it('preserves newer local fields against a full canonical write response', () => {
    const state = configuration();
    state.edit({ slug: 'first' });
    const first = state.beginWrite({ slug: 'first' });
    state.edit({ slug: 'second', enabled: false });
    first.acknowledge({ slug: 'first-canonical', enabled: true, revision: 'r2' }, { full: true });
    expect(state.getConfiguration()).toEqual({ slug: 'second', enabled: false, revision: 'r2' });
  });

  it('does not clear newer intent when an older queued value starts later', () => {
    const state = configuration();
    state.edit({ slug: 'latest' });
    const older = state.beginWrite({ slug: 'old' });
    older.acknowledge({ slug: 'old-canonical' });
    expect(state.getConfiguration().slug).toBe('latest');
    expect(state.isDraft('slug')).toBe(true);
  });

  it('keeps key-only in-flight fields and adopts latest overlapping response when all settle', () => {
    const patches: unknown[] = [];
    const state = new AuthoritativeConfiguration(`campaign:${crypto.randomUUID()}`, { target: 'initial' }, (patch) =>
      patches.push(patch),
    );
    const older = state.beginWrite(['target']);
    const newer = state.beginWrite(['target']);
    expect(state.getConfiguration().target).toBe('initial');
    newer.acknowledge({ target: 'newer' });
    older.acknowledge({ target: 'older' });
    expect(state.getConfiguration().target).toBe('newer');
    expect(patches.at(-1)).toEqual({ target: 'newer' });
  });

  it('holds nonoptimistic key-only values during an in-flight authoritative read', () => {
    const state = configuration();
    state.beginWrite(['slug']);
    state.adoptRead(state.beginRead(), { slug: 'peer', enabled: false });
    expect(state.getConfiguration()).toEqual({ slug: 'initial', enabled: false, revision: 'r1' });
    expect(state.getCanonical().slug).toBe('peer');
  });

  it('does not replace a peer snapshot with an earlier full acknowledgement', () => {
    const state = configuration();
    state.edit({ slug: 'local' });
    const write = state.beginWrite({ slug: 'local' });
    state.adoptRead(state.beginRead(), { slug: 'peer', revision: 'r3' });
    expect(write.acknowledge({ slug: 'local', revision: 'r2' }, { full: true })).toBe(false);
    expect(state.getCanonical().revision).toBe('r3');
  });

  it('rejects partial acknowledgement older than an adopted peer read', () => {
    const state = configuration();
    const write = state.beginWrite({ slug: 'local' });
    state.adoptRead(state.beginRead(), { slug: 'newer-peer' });
    expect(state.getConfiguration().slug).toBe('local');
    expect(write.acknowledge({ slug: 'older-local' })).toBe(false);
    expect(state.getConfiguration().slug).toBe('newer-peer');
    expect(state.captureOwnChange(write.origin)()).toBe(false);
  });

  it('preserves fields already acknowledged by a newer write against an older full response', () => {
    const state = configuration();
    const older = state.beginWrite({ slug: 'first' });
    const newer = state.beginWrite({ enabled: false });
    newer.acknowledge({ enabled: false, revision: 'r3', slug: 'peer' }, { full: true });
    expect(older.acknowledge({ slug: 'first', enabled: true, revision: 'r2' }, { full: true })).toBe(false);
    expect(state.getCanonical().revision).toBe('r3');
    expect(state.getCanonical().enabled).toBe(false);
    expect(state.getConfiguration().enabled).toBe(false);
    expect(state.getConfiguration().slug).toBe('peer');
    expect(state.hasPending()).toBe(false);
  });

  it('suppresses only the local origin with all applicable canonical writes adopted', () => {
    const state = configuration();
    const own = state.captureOwnChange(getEditorWriteOrigin());
    const foreign = state.captureOwnChange(crypto.randomUUID());
    expect(own()).toBe(false);
    const write = state.beginWrite({ slug: 'local' });
    expect(own()).toBe(false);
    write.acknowledge({ slug: 'canonical' });
    expect(own()).toBe(true);
    expect(foreign()).toBe(false);
    const second = state.beginWrite({ enabled: false });
    expect(own()).toBe(false);
    second.fail();
    expect(own()).toBe(false);
  });

  it('refetches input-only acknowledgements and writes owned by a different listener slice', () => {
    const id = crypto.randomUUID();
    const state = configuration(id);
    state.beginWrite({ slug: 'input' }).acknowledge({ slug: 'input' }, { authoritative: false });
    expect(state.captureOwnChange(getEditorWriteOrigin())()).toBe(false);
    const other = configuration(id);
    other.beginWrite({ enabled: false }).acknowledge({ enabled: false });
    expect(other.captureOwnChange(getEditorWriteOrigin())()).toBe(false);
  });
});
