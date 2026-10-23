import { createStore, type StoreApi } from 'zustand/vanilla';
import type { PageSlugAvailabilityReason, PageSlugAvailabilityResult } from '@/lib/queries/page-browser';
import { getPageSlugValidationReason } from '@/lib/utils/page-route';
import { generateSlug, sanitizePageSlugInput, sanitizeSlugInput } from '@/lib/utils/slug';

export type SlugEntityType = 'post' | 'page' | 'form' | 'work' | 'label' | 'artist' | 'series' | 'release';
export type SlugAvailabilityCheck = (slug: string, excludeId?: string) => Promise<PageSlugAvailabilityResult>;
export type SlugSaveHandler = (slug: string) => void | Promise<unknown>;

/** Pause between the last slug edit and its availability check. */
export const DEFAULT_SLUG_DEBOUNCE_MS = 1000;

/** The editor-save document a slug write belongs to; Series slugs are saved with their post_series document. */
export function slugDocumentKey(entityType: SlugEntityType, entityId: string): string {
  return `${entityType === 'series' ? 'post_series' : entityType}:${entityId}`;
}

/** Page slugs are paths and keep their interior slashes. */
export function sanitizeSlugForEntity(entityType: SlugEntityType, value: string): string {
  return entityType === 'page' ? sanitizePageSlugInput(value) : sanitizeSlugInput(value);
}

/** The availability query as the view received it. */
export interface SlugCheckResult {
  data: PageSlugAvailabilityResult | undefined;
  isFetching: boolean;
  isError: boolean;
}

export interface SlugStatus {
  /** The settled, non-empty slug may be checked. */
  checkEnabled: boolean;
  isChecking: boolean;
  /** An empty slug is available; undefined while checking or after a failed check. */
  isAvailable: boolean | undefined;
  error: string | undefined;
  /** Page only: local path validation first, then the server's reason. */
  errorReason: PageSlugAvailabilityReason | undefined;
}

/**
 * What the slug field shows. `settled` means the debounced input is the current input, so a check result
 * belongs to this slug; until then no earlier result is shown.
 */
export function deriveSlugStatus(
  entityType: SlugEntityType,
  slug: string,
  settled: boolean,
  { data, isFetching, isError }: SlugCheckResult,
): SlugStatus {
  const isSlugEmpty = slug.length === 0;
  const isChecking = !isSlugEmpty && (!settled || isFetching);
  const isAvailable = isSlugEmpty ? true : isChecking || isError ? undefined : data?.available;
  const error =
    !isSlugEmpty && isError
      ? 'Could not check slug availability'
      : entityType !== 'page' && !isSlugEmpty && isAvailable === false
        ? 'Slug already exists'
        : undefined;
  const localPageSlugReason = entityType === 'page' ? getPageSlugValidationReason(slug) : undefined;
  const errorReason =
    entityType === 'page' && !isSlugEmpty
      ? (localPageSlugReason ??
        (isError ? 'checkFailed' : isAvailable === false ? (data?.reason ?? 'alreadyExists') : undefined))
      : undefined;
  return { checkEnabled: !isSlugEmpty && settled, isChecking, isAvailable, error, errorReason };
}

/** Writes one slug; a missing handler or an error result fails, so the save queue keeps the slug. */
export async function writeSlug(save: SlugSaveHandler | undefined, slug: string): Promise<void> {
  if (!save) {
    throw new Error('Slug save handler is unavailable.');
  }
  const result = await save(slug);
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Slug save failed.');
  }
}

export interface SlugManagementProps {
  entityType: SlugEntityType;
  entityId: string;
  /** The slug the view renders, from local state or the shared document. */
  slug: string;
  debounceMs: number;
}

export interface SlugManagementPorts {
  onSlugChange: (slug: string) => void;
  hasSaveHandler: () => boolean;
  enqueueSave: (slug: string) => void;
  flushSave: () => void;
  checkAvailability: SlugAvailabilityCheck;
}

interface SlugInput {
  readonly document: string;
  readonly slug: string;
  readonly version: number;
}

export interface SlugManagementState {
  /** The latest document and slug the view rendered. */
  input: SlugInput;
  /** That input once it stayed unchanged for the debounce delay. */
  settled: SlugInput;
}

/** The view's current document and slug are the settled input. */
export function isSettledInput(state: SlugManagementState, document: string, slug: string): boolean {
  return (
    state.settled.version === state.input.version && state.input.document === document && state.input.slug === slug
  );
}

export interface SlugManagementStore {
  readonly api: StoreApi<SlugManagementState>;
  /** Adopts the props the view committed; the view calls it after every commit. */
  sync: (props: SlugManagementProps) => void;
  start: () => void;
  stop: () => void;
  handleChange: (value: string) => void;
  updateFromTitle: (title: string) => void;
  /** Saves the settled slug once, when its availability (from the view's latest check) allows it. */
  considerSave: (isAvailable: boolean | undefined) => void;
  /** Saves the current slug now; `view` is what the field showed when it lost focus. */
  blur: (view: { debouncedSlug: string; isAvailable: boolean | undefined }) => void;
}

/**
 * Title-generated and typed slugs, their debounced availability check and when they are saved. The view
 * owns the availability query and the save queue and reaches them through `ports`.
 */
export function createSlugManagementStore(
  initialProps: SlugManagementProps,
  ports: () => SlugManagementPorts,
): SlugManagementStore {
  let props = initialProps;
  let document = slugDocumentKey(props.entityType, props.entityId);
  let version = 0;
  const initialInput: SlugInput = { document, slug: props.slug, version };
  const api = createStore<SlugManagementState>()(() => ({ input: initialInput, settled: initialInput }));

  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // An entity switch invalidates a blur check that is still running.
  let generation = 0;
  // The slug last typed, generated or rendered; a settled result only counts while it is this slug.
  let currentSlug = props.slug;
  // The settled slug already saved or refused, so it is not saved twice. The mounted slug counts as handled.
  let lastHandledSlug = props.slug;
  // Title edits fill an empty slug until it is edited by hand or changed by a collaborator.
  let autoSlug = { enabled: props.slug.length === 0, lastSlug: props.slug };

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const armSettle = () => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      api.setState((state) => ({ settled: state.input }));
    }, props.debounceMs);
  };

  const isPending = () => {
    const { input, settled } = api.getState();
    return input.version !== settled.version;
  };

  const sync = (next: SlugManagementProps) => {
    const nextDocument = slugDocumentKey(next.entityType, next.entityId);
    const delayChanged = next.debounceMs !== props.debounceMs;
    const slugChanged = next.slug !== props.slug;
    if (nextDocument !== document) {
      document = nextDocument;
      generation += 1;
      currentSlug = next.slug;
      lastHandledSlug = next.slug;
      autoSlug = { enabled: next.slug.length === 0, lastSlug: next.slug };
    } else {
      if (autoSlug.enabled && next.slug !== autoSlug.lastSlug) {
        autoSlug.enabled = false;
      }
      if (slugChanged) {
        currentSlug = next.slug;
      }
    }
    props = next;

    const { input } = api.getState();
    if (input.document !== document || input.slug !== next.slug) {
      version += 1;
      api.setState({ input: { document, slug: next.slug, version } });
      if (active) {
        armSettle();
      }
    } else if (delayChanged && active && timer) {
      armSettle();
    }
  };

  const handleChange = (value: string) => {
    autoSlug.enabled = false;
    const sanitized = sanitizeSlugForEntity(props.entityType, value);
    currentSlug = sanitized;
    ports().onSlugChange(sanitized);
  };

  const updateFromTitle = (title: string) => {
    if (!autoSlug.enabled) {
      return;
    }
    const generated = generateSlug(title);
    autoSlug.lastSlug = generated;
    currentSlug = generated;
    ports().onSlugChange(generated);
  };

  const considerSave = (isAvailable: boolean | undefined) => {
    const { input, settled } = api.getState();
    // The check belongs to the settled slug; never persist it after the user typed beyond it.
    if (input.version !== settled.version || currentSlug !== settled.slug) {
      return;
    }
    if (lastHandledSlug === settled.slug) {
      return;
    }
    if (settled.slug.length > 0 && isAvailable === undefined) {
      return;
    }
    const { hasSaveHandler, enqueueSave } = ports();
    if (isAvailable && hasSaveHandler()) {
      enqueueSave(settled.slug);
    }
    lastHandledSlug = settled.slug;
  };

  const blur = ({ debouncedSlug, isAvailable }: { debouncedSlug: string; isAvailable: boolean | undefined }) => {
    const slugAtBlur = currentSlug;
    const documentAtBlur = document;
    const generationAtBlur = generation;
    if (lastHandledSlug === slugAtBlur) {
      return;
    }
    const { checkAvailability } = ports();
    const entityId = props.entityId;
    void (async () => {
      let available: boolean;
      try {
        available =
          slugAtBlur.length === 0
            ? true
            : slugAtBlur === debouncedSlug && isAvailable !== undefined
              ? isAvailable
              : (await checkAvailability(slugAtBlur, entityId)).available;
      } catch {
        // The field already shows the failed check; the slug stays unsaved until the next blur or settle.
        return;
      }
      // Ignore a late result if the entity or the input changed while it was being checked.
      if (document !== documentAtBlur || generation !== generationAtBlur || currentSlug !== slugAtBlur) {
        return;
      }
      const { hasSaveHandler, enqueueSave, flushSave } = ports();
      if (available && hasSaveHandler()) {
        enqueueSave(slugAtBlur);
        flushSave();
      }
      lastHandledSlug = slugAtBlur;
    })();
  };

  return {
    api,
    sync,
    start: () => {
      active = true;
      if (isPending()) {
        armSettle();
      }
    },
    stop: () => {
      active = false;
      clearTimer();
    },
    handleChange,
    updateFromTitle,
    considerSave,
    blur,
  };
}
