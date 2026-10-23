import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSlugManagementStore,
  DEFAULT_SLUG_DEBOUNCE_MS,
  deriveSlugStatus,
  isSettledInput,
  sanitizeSlugForEntity,
  slugDocumentKey,
  writeSlug,
  type SlugCheckResult,
  type SlugManagementPorts,
  type SlugManagementProps,
  type SlugManagementStore,
} from './slug-management-store';

const idle: SlugCheckResult = { data: undefined, isFetching: false, isError: false };
const available: SlugCheckResult = { data: { available: true }, isFetching: false, isError: false };
const failed: SlugCheckResult = { data: undefined, isFetching: false, isError: true };
const started: SlugManagementStore[] = [];

afterEach(() => {
  for (const store of started.splice(0)) {
    store.stop();
  }
  vi.useRealTimers();
});

/** A slug field whose view renders back the slug it is given, as the editors do (unless `controlled: false`). */
function mountSlugField(
  initial: Partial<SlugManagementProps> = {},
  { controlled = true, hasSaveHandler = true }: { controlled?: boolean; hasSaveHandler?: boolean } = {},
) {
  let props: SlugManagementProps = { entityType: 'page', entityId: 'page-1', slug: '', debounceMs: 300, ...initial };
  const enqueueSave = vi.fn<(slug: string) => void>();
  const flushSave = vi.fn<() => void>();
  const checkAvailability = vi.fn<SlugManagementPorts['checkAvailability']>(async () => ({ available: true }));
  const ports: SlugManagementPorts = {
    onSlugChange: (slug) => {
      if (controlled) {
        render({ slug });
      }
    },
    hasSaveHandler: () => hasSaveHandler,
    enqueueSave,
    flushSave,
    checkAvailability,
  };
  const store = createSlugManagementStore(props, () => ports);
  store.start();
  started.push(store);

  function render(next: Partial<SlugManagementProps>) {
    props = { ...props, ...next };
    store.sync(props);
  }
  function status(check: SlugCheckResult = idle) {
    const document = slugDocumentKey(props.entityType, props.entityId);
    return deriveSlugStatus(
      props.entityType,
      props.slug,
      isSettledInput(store.api.getState(), document, props.slug),
      check,
    );
  }
  return {
    store,
    render,
    status,
    slug: () => props.slug,
    debouncedSlug: () => store.api.getState().settled.slug,
    blur: () => store.blur({ debouncedSlug: store.api.getState().settled.slug, isAvailable: status().isAvailable }),
    enqueueSave,
    flushSave,
    checkAvailability,
  };
}

describe('slug rules', () => {
  it('registers Series slugs under the post_series document key', () => {
    expect(slugDocumentKey('series', 'series-1')).toBe('post_series:series-1');
    expect(slugDocumentKey('page', 'page-1')).toBe('page:page-1');
  });

  it('keeps the interior slash of a Page path slug only', () => {
    expect(sanitizeSlugForEntity('page', 'a/b')).toBe('a/b');
    expect(sanitizeSlugForEntity('post', 'a/b')).toBe('a-b');
  });

  it('reports a failed check instead of a duplicate slug', () => {
    expect(deriveSlugStatus('page', 'new-slug', true, failed)).toMatchObject({
      isAvailable: undefined,
      errorReason: 'checkFailed',
      error: 'Could not check slug availability',
    });
  });

  it('hides a previous rejection until the current slug settles, but not local Page validation', () => {
    const rejected: SlugCheckResult = {
      data: { available: false, reason: 'alreadyExists' },
      isFetching: false,
      isError: false,
    };
    expect(deriveSlugStatus('page', 'taken', true, rejected).errorReason).toBe('alreadyExists');
    expect(deriveSlugStatus('page', 'new-slug', false, rejected)).toMatchObject({
      isChecking: true,
      isAvailable: undefined,
      errorReason: undefined,
    });
    expect(deriveSlugStatus('page', 'admin', false, rejected).errorReason).toBe('reservedRoute');
  });

  it('hides a cached rejection while the current slug refetches', () => {
    const refetching: SlugCheckResult = {
      data: { available: false, reason: 'alreadyExists' },
      isFetching: true,
      isError: false,
    };
    expect(deriveSlugStatus('page', 'cached', true, refetching)).toMatchObject({
      isChecking: true,
      isAvailable: undefined,
      errorReason: undefined,
    });
    expect(deriveSlugStatus('page', 'cached', true, available).isAvailable).toBe(true);
  });

  it('exposes the Page rejection reason without a duplicate message', () => {
    const reserved: SlugCheckResult = {
      data: { available: false, reason: 'reservedRoute' },
      isFetching: false,
      isError: false,
    };
    expect(deriveSlugStatus('page', 'admin/team', true, reserved)).toMatchObject({
      isAvailable: false,
      errorReason: 'reservedRoute',
      error: undefined,
    });
  });

  it('names a duplicate for other entities and treats an empty slug as available without a check', () => {
    const taken: SlugCheckResult = { data: { available: false }, isFetching: false, isError: false };
    expect(deriveSlugStatus('post', 'taken', true, taken)).toMatchObject({
      error: 'Slug already exists',
      errorReason: undefined,
    });
    expect(deriveSlugStatus('page', '', true, idle)).toMatchObject({
      checkEnabled: false,
      isChecking: false,
      isAvailable: true,
    });
  });

  it('fails a slug write that has no handler or that the handler reports as failed', async () => {
    await expect(writeSlug(undefined, 'a')).rejects.toThrow('Slug save handler is unavailable.');
    await expect(writeSlug(async () => ({ error: 'Slug taken' }), 'a')).rejects.toThrow('Slug taken');
    await expect(writeSlug(async () => ({ error: true }), 'a')).rejects.toThrow('Slug save failed.');
    await expect(writeSlug(async () => ({ ok: true }), 'a')).resolves.toBeUndefined();
  });
});

describe('slug management store', () => {
  it('checks only after the default delay and shows checking until the result arrives', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ debounceMs: DEFAULT_SLUG_DEBOUNCE_MS });
    field.render({ slug: 'new-slug' });
    expect(field.status()).toMatchObject({ checkEnabled: false, isChecking: true, isAvailable: undefined });
    vi.advanceTimersByTime(999);
    expect(field.status()).toMatchObject({ checkEnabled: false, isChecking: true });
    vi.advanceTimersByTime(1);
    expect(field.debouncedSlug()).toBe('new-slug');
    expect(field.status({ data: undefined, isFetching: true, isError: false })).toMatchObject({
      checkEnabled: true,
      isChecking: true,
      isAvailable: undefined,
    });
    expect(field.status(available)).toMatchObject({ isChecking: false, isAvailable: true });
  });

  it.each(['custom', ''])('stops title autofill after a manual edit to %j', (manualSlug) => {
    const field = mountSlugField();
    field.store.updateFromTitle('First Title');
    expect(field.slug()).toBe('first-title');
    field.store.handleChange(manualSlug);
    field.store.updateFromTitle('Second Title');
    expect(field.slug()).toBe(manualSlug);
  });

  it('preserves an existing slug when its title changes', () => {
    const field = mountSlugField({ slug: 'existing' });
    field.store.updateFromTitle('Changed Title');
    expect(field.slug()).toBe('existing');
  });

  it('stops title autofill after a collaborative slug change', () => {
    const field = mountSlugField();
    field.store.updateFromTitle('First Title');
    field.render({ slug: 'collaborator-slug' });
    field.store.updateFromTitle('Second Title');
    expect(field.slug()).toBe('collaborator-slug');
  });

  it('does not save after a failed check', () => {
    vi.useFakeTimers();
    const field = mountSlugField();
    field.render({ slug: 'new-slug' });
    vi.advanceTimersByTime(300);
    field.store.considerSave(field.status(failed).isAvailable);
    expect(field.enqueueSave).not.toHaveBeenCalled();
  });

  it('resets autofill and never checks or saves the previous entity debounced slug', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ slug: 'old' });
    field.store.handleChange('manual');
    vi.advanceTimersByTime(50);
    field.render({ entityId: 'page-2', slug: '' });
    field.store.updateFromTitle('New Title');
    expect(field.slug()).toBe('new-title');
    expect(field.status().checkEnabled).toBe(false);
    vi.advanceTimersByTime(299);
    expect(field.status().checkEnabled).toBe(false);
    field.store.considerSave(true);
    expect(field.enqueueSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(field.store.api.getState().settled).toMatchObject({ document: 'page:page-2', slug: 'new-title' });
    expect(field.status().checkEnabled).toBe(true);
    field.store.considerSave(field.status(available).isAvailable);
    expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('new-title');
  });

  it('restarts the delay when input returns to the last checked slug', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ slug: 'first' });
    field.render({ slug: 'second' });
    vi.advanceTimersByTime(50);
    field.render({ slug: 'first' });
    expect(field.status(available)).toMatchObject({ isChecking: true, isAvailable: undefined });
    vi.advanceTimersByTime(299);
    expect(field.status().checkEnabled).toBe(false);
    vi.advanceTimersByTime(1);
    expect(field.status().checkEnabled).toBe(true);
    expect(field.debouncedSlug()).toBe('first');
  });

  it('ignores a result for the previous entity and saves the new one after its delay', () => {
    vi.useFakeTimers();
    const field = mountSlugField();
    field.render({ slug: 'old-pending' });
    vi.advanceTimersByTime(300);
    field.render({ entityId: 'page-2', slug: '' });
    field.store.updateFromTitle('New Title');
    const late: SlugCheckResult = {
      data: { available: false, reason: 'alreadyExists' },
      isFetching: false,
      isError: false,
    };
    expect(field.status(late)).toMatchObject({ errorReason: undefined, isChecking: true });
    field.store.considerSave(field.status(late).isAvailable);
    expect(field.enqueueSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    field.store.considerSave(field.status(available).isAvailable);
    expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('new-title');
  });

  it('does not save a checked prefix after the user has continued typing', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ debounceMs: 250 });
    field.render({ slug: 'dyn' });
    vi.advanceTimersByTime(250);
    field.store.handleChange('dynamic-gpgpu-particles-tutorial');
    field.store.considerSave(true);
    expect(field.enqueueSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    field.store.considerSave(field.status(available).isAvailable);
    expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('dynamic-gpgpu-particles-tutorial');
  });

  it('does not save the checked slug while a typed slug has not been rendered', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ debounceMs: 250 }, { controlled: false });
    field.render({ slug: 'dyn' });
    vi.advanceTimersByTime(250);
    field.store.handleChange('dynamic');
    field.store.considerSave(true);
    expect(field.enqueueSave).not.toHaveBeenCalled();
  });

  it('saves each settled available slug in order', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ debounceMs: 250 });
    field.render({ slug: 'dyn' });
    vi.advanceTimersByTime(250);
    field.store.considerSave(field.status(available).isAvailable);
    field.store.handleChange('dynamic-gpgpu');
    vi.advanceTimersByTime(250);
    field.store.considerSave(field.status(available).isAvailable);
    expect(field.enqueueSave.mock.calls).toEqual([['dyn'], ['dynamic-gpgpu']]);
  });

  it('saves an empty slug immediately on blur without checking availability', () => {
    const field = mountSlugField({ slug: 'existing-slug', debounceMs: 1_000 });
    field.store.handleChange('');
    field.blur();
    expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('');
    expect(field.flushSave).toHaveBeenCalledOnce();
    expect(field.checkAvailability).not.toHaveBeenCalled();
  });

  it('saves an empty slug when it settles, without a check', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ slug: 'existing-slug', debounceMs: 250 });
    field.store.handleChange('');
    vi.advanceTimersByTime(250);
    const status = field.status();
    expect(status.checkEnabled).toBe(false);
    field.store.considerSave(status.isAvailable);
    expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('');
  });

  it('does not save a slug the Page check rejected', () => {
    vi.useFakeTimers();
    const field = mountSlugField({ debounceMs: 1 });
    field.store.handleChange('admin/team');
    vi.advanceTimersByTime(1);
    const reserved: SlugCheckResult = {
      data: { available: false, reason: 'reservedRoute' },
      isFetching: false,
      isError: false,
    };
    field.store.considerSave(field.status(reserved).isAvailable);
    expect(field.enqueueSave).not.toHaveBeenCalled();
  });

  it('does not re-save the mounted slug, or save without a handler', () => {
    vi.useFakeTimers();
    const mounted = mountSlugField({ slug: 'existing' });
    mounted.store.considerSave(true);
    expect(mounted.enqueueSave).not.toHaveBeenCalled();
    const withoutHandler = mountSlugField({}, { hasSaveHandler: false });
    withoutHandler.render({ slug: 'new-slug' });
    vi.advanceTimersByTime(300);
    withoutHandler.store.considerSave(true);
    expect(withoutHandler.enqueueSave).not.toHaveBeenCalled();
  });

  it('checks and saves the typed slug on blur', async () => {
    const check = Promise.withResolvers<{ available: boolean }>();
    const field = mountSlugField({ slug: 'old-slug', debounceMs: 1_000 });
    field.checkAvailability.mockReturnValueOnce(check.promise);
    field.store.handleChange('new-slug');
    field.blur();
    expect(field.checkAvailability).toHaveBeenCalledExactlyOnceWith('new-slug', 'page-1');
    check.resolve({ available: true });
    await check.promise;
    expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('new-slug');
    expect(field.flushSave).toHaveBeenCalledOnce();
  });

  it('ignores a blur check that finishes after the entity changed', async () => {
    const check = Promise.withResolvers<{ available: boolean }>();
    const field = mountSlugField({ slug: 'old-slug', debounceMs: 1_000 });
    field.checkAvailability.mockReturnValueOnce(check.promise);
    field.store.handleChange('new-slug');
    field.blur();
    field.render({ entityId: 'page-2' });
    check.resolve({ available: true });
    await check.promise;
    expect(field.enqueueSave).not.toHaveBeenCalled();
  });
  it('leaves the slug unsaved when the blur check fails', async () => {
    const field = mountSlugField({ slug: 'old-slug', debounceMs: 1_000 });
    const check = Promise.withResolvers<{ available: boolean }>();
    field.checkAvailability.mockReturnValueOnce(check.promise);
    field.store.handleChange('new-slug');
    field.blur();
    check.reject(new Error('offline'));
    await check.promise.catch(() => undefined);
    await Promise.resolve();
    expect(field.enqueueSave).not.toHaveBeenCalled();

    field.checkAvailability.mockResolvedValueOnce({ available: true });
    field.blur();
    await vi.waitFor(() => expect(field.enqueueSave).toHaveBeenCalledExactlyOnceWith('new-slug'));
  });
});
