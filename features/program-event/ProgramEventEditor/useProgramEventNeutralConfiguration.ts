'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import {
  getProgramEventNeutralConfigurationAction,
  type ProgramEventNeutralConfiguration,
} from '@/lib/actions/program-event';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import type { ProgramEventUpdate } from './useProgramEventLifecycle';

export type ProgramEventNeutralField = Exclude<keyof ProgramEventNeutralConfiguration, 'typeName'>;

export interface ProgramEventTypeOption {
  id: string;
  name: string;
}

type ProgramEventNeutralPatch = Partial<ProgramEventNeutralConfiguration> & {
  observed?: {
    artists?: ProgramEventNeutralConfiguration['artists'];
    labels?: ProgramEventNeutralConfiguration['labels'];
    clients?: ProgramEventNeutralConfiguration['clients'];
  };
};

interface ConfigurationState {
  eventId: string;
  configuration: ProgramEventNeutralConfiguration;
}

interface ProgramEventNeutralWrite {
  acknowledge: (patch: ProgramEventUpdate) => void;
  fail: () => void;
}

export interface UseProgramEventNeutralConfigurationOptions {
  eventId: string;
  initialConfiguration: ProgramEventNeutralConfiguration;
  provider?: HocuspocusProvider | null;
  loadConfiguration?: typeof getProgramEventNeutralConfigurationAction;
  onAdopt: (configuration: Partial<ProgramEventNeutralConfiguration>) => void;
}

const FIELDS: readonly ProgramEventNeutralField[] = [
  'slug',
  'typeId',
  'seriesId',
  'seriesOrder',
  'startsAt',
  'endsAt',
  'timezone',
  'allDay',
  'locationMode',
  'mapPlaceId',
  'ticketUrl',
  'streamUrl',
  'externalUrl',
  'artists',
  'labels',
  'clients',
];

export function mergeProgramEventTypeOption(
  options: ProgramEventTypeOption[],
  id: string,
  name: string,
): ProgramEventTypeOption[] {
  const index = options.findIndex((option) => option.id === id);
  if (index < 0) {
    return [...options, { id, name }];
  }
  if (options[index].name === name) {
    return options;
  }
  return options.map((option) => (option.id === id ? { id, name } : option));
}

export function resolveProgramEventObservedRelations(
  patch: ProgramEventNeutralPatch,
  currentBaseline: Pick<ProgramEventNeutralConfiguration, 'artists' | 'labels' | 'clients'>,
): NonNullable<ProgramEventUpdate['observed']> {
  return {
    ...(patch.artists === undefined ? {} : { artists: patch.observed?.artists ?? currentBaseline.artists }),
    ...(patch.labels === undefined ? {} : { labels: patch.observed?.labels ?? currentBaseline.labels }),
    ...(patch.clients === undefined ? {} : { clients: patch.observed?.clients ?? currentBaseline.clients }),
  };
}

export function useProgramEventNeutralConfiguration({
  eventId,
  initialConfiguration,
  provider,
  loadConfiguration = getProgramEventNeutralConfigurationAction,
  onAdopt,
}: UseProgramEventNeutralConfigurationOptions) {
  const document = `program_event:${eventId}`;
  const activeScopeRef = useRef({ eventId, generation: 0 });
  const canonicalRef = useRef<ConfigurationState>({ eventId, configuration: initialConfiguration });
  const requestGenerationRef = useRef(0);
  const draftsRef = useRef(new Map<ProgramEventNeutralField, unknown>());
  const draftVersionsRef = useRef(new Map<ProgramEventNeutralField, number>());
  const pendingWritesRef = useRef(new Map<ProgramEventNeutralField, Set<symbol>>());
  const onAdoptRef = useRef(onAdopt);
  if (activeScopeRef.current.eventId !== eventId) {
    activeScopeRef.current = { eventId, generation: activeScopeRef.current.generation + 1 };
    requestGenerationRef.current += 1;
    draftsRef.current.clear();
    draftVersionsRef.current.clear();
    pendingWritesRef.current.clear();
    canonicalRef.current = { eventId, configuration: initialConfiguration };
  }
  const scopeGeneration = activeScopeRef.current.generation;

  useLayoutEffect(() => {
    onAdoptRef.current = onAdopt;
  });

  const refresh = useCallback(async () => {
    if (activeScopeRef.current.eventId !== eventId || activeScopeRef.current.generation !== scopeGeneration) {
      return;
    }
    const requestedEventId = eventId;
    const generation = ++requestGenerationRef.current;
    try {
      const result = await loadConfiguration(requestedEventId);
      if (
        !result.ok ||
        activeScopeRef.current.eventId !== requestedEventId ||
        activeScopeRef.current.generation !== scopeGeneration ||
        requestGenerationRef.current !== generation
      ) {
        return;
      }

      canonicalRef.current = { eventId: requestedEventId, configuration: result.configuration };
      const adopted: Partial<ProgramEventNeutralConfiguration> = {};
      for (const field of FIELDS) {
        if (pendingWritesRef.current.get(field)?.size) {
          continue;
        }
        const draft = draftsRef.current.get(field);
        if (draftsRef.current.has(field) && !sameValue(draft, result.configuration[field])) {
          continue;
        }
        draftsRef.current.delete(field);
        adopted[field] = result.configuration[field] as never;
      }
      const typeIdDraft = draftsRef.current.get('typeId');
      if (
        !pendingWritesRef.current.get('typeId')?.size &&
        (!draftsRef.current.has('typeId') || sameValue(typeIdDraft, result.configuration.typeId))
      ) {
        adopted.typeName = result.configuration.typeName;
      }
      if (Object.keys(adopted).length) {
        onAdoptRef.current(adopted);
      }
    } catch {
      // An authorized getter failure leaves local edits intact; a later hint can retry it.
    }
  }, [eventId, loadConfiguration, scopeGeneration]);

  useEditorEntityChanges(document, () => void refresh(), provider);

  useEffect(() => {
    void refresh();
    return () => {
      if (activeScopeRef.current.eventId === eventId && activeScopeRef.current.generation === scopeGeneration) {
        requestGenerationRef.current += 1;
      }
    };
  }, [eventId, refresh, scopeGeneration]);

  const setDraft = useCallback(
    <K extends ProgramEventNeutralField>(field: K, value: ProgramEventNeutralConfiguration[K]) => {
      if (activeScopeRef.current.eventId !== eventId || activeScopeRef.current.generation !== scopeGeneration) {
        return;
      }
      const canonical =
        canonicalRef.current.eventId === eventId ? canonicalRef.current.configuration : initialConfiguration;
      if (sameValue(value, canonical[field])) {
        draftsRef.current.delete(field);
      } else {
        draftsRef.current.set(field, value);
      }
      draftVersionsRef.current.set(field, (draftVersionsRef.current.get(field) ?? 0) + 1);
    },
    [eventId, initialConfiguration, scopeGeneration],
  );

  const beginWrite = useCallback(
    (patch: ProgramEventUpdate): ProgramEventNeutralWrite => {
      const requestedEventId = eventId;
      const requestedScopeGeneration = scopeGeneration;
      if (
        activeScopeRef.current.eventId !== requestedEventId ||
        activeScopeRef.current.generation !== requestedScopeGeneration
      ) {
        return {
          acknowledge: () => publishEditorEntityChange(`program_event:${requestedEventId}`),
          fail: () => undefined,
        };
      }
      const fields = FIELDS.filter((field) => patch[field] !== undefined);
      const versions = new Map(fields.map((field) => [field, draftVersionsRef.current.get(field) ?? 0]));
      const token = Symbol('program-event-neutral-write');
      for (const field of fields) {
        const requests = pendingWritesRef.current.get(field) ?? new Set<symbol>();
        requests.add(token);
        pendingWritesRef.current.set(field, requests);
      }
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        for (const field of fields) {
          const requests = pendingWritesRef.current.get(field);
          requests?.delete(token);
          if (requests?.size === 0) {
            pendingWritesRef.current.delete(field);
          }
        }
      };

      return {
        acknowledge: (savedPatch) => {
          finish();
          if (
            activeScopeRef.current.eventId !== requestedEventId ||
            activeScopeRef.current.generation !== requestedScopeGeneration
          ) {
            publishEditorEntityChange(`program_event:${requestedEventId}`);
            return;
          }
          const current =
            canonicalRef.current.eventId === requestedEventId
              ? canonicalRef.current.configuration
              : initialConfiguration;
          const canonical = { ...current };
          for (const field of fields) {
            const value = savedPatch[field];
            if (value !== undefined) {
              canonical[field] = value as never;
            }
            if (draftVersionsRef.current.get(field) === versions.get(field)) {
              draftsRef.current.delete(field);
            }
          }
          canonicalRef.current = { eventId: requestedEventId, configuration: canonical };
          publishEditorEntityChange(`program_event:${requestedEventId}`);
          void refresh();
        },
        fail: () => finish(),
      };
    },
    [eventId, initialConfiguration, refresh, scopeGeneration],
  );

  return { beginWrite, refresh, setDraft };
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    return (
      leftKeys.length === Object.keys(right).length &&
      leftKeys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]))
    );
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
