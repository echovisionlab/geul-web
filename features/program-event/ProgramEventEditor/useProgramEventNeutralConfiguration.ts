'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import {
  getProgramEventNeutralConfigurationAction,
  type ProgramEventNeutralConfiguration,
} from '@/lib/actions/program-event';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import {
  useAuthoritativeConfiguration,
  type AuthoritativeConfiguration,
} from '@/lib/editor/useAuthoritativeConfiguration';
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

interface ProgramEventNeutralWrite {
  origin: string;
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
  const recordingDraft = useRef(false);
  const adoptingController = useRef<AuthoritativeConfiguration<ProgramEventNeutralConfiguration> | null>(null);
  const controller = useAuthoritativeConfiguration({
    document,
    initialConfiguration,
    onAdopt: (patch) => {
      if (recordingDraft.current) {
        return;
      }
      const adopted = { ...patch };
      if (adoptingController.current?.isDraft('typeId')) {
        delete adopted.typeName;
      }
      if (Object.keys(adopted).length) {
        onAdopt(adopted);
      }
    },
  });
  adoptingController.current = controller;
  const activeController = useRef<typeof controller | null>(controller);
  activeController.current = controller;

  const refresh = useCallback(async () => {
    if (activeController.current !== controller) {
      return;
    }
    const read = controller.beginRead();
    try {
      const result = await loadConfiguration(eventId);
      if (result.ok && activeController.current === controller) {
        controller.adoptRead(read, result.configuration);
      }
    } catch {
      // An authorized getter failure leaves local edits intact; a later hint can retry it.
    }
  }, [controller, eventId, loadConfiguration]);

  useEditorEntityChanges(document, () => void refresh(), provider, undefined, controller.captureOwnChange);

  useEffect(() => {
    activeController.current = controller;
    void refresh();
    return () => {
      controller.beginRead();
      if (activeController.current === controller) {
        activeController.current = null;
      }
    };
  }, [controller, refresh]);

  const setDraft = useCallback(
    <K extends ProgramEventNeutralField>(field: K, value: ProgramEventNeutralConfiguration[K]) => {
      if (activeController.current !== controller) {
        return;
      }
      // The display label belongs to the selected type and shares its protection.
      recordingDraft.current = true;
      try {
        controller.edit({
          [field]: value,
          ...(field === 'typeId' ? { typeName: controller.getConfiguration().typeName } : {}),
        });
      } finally {
        recordingDraft.current = false;
      }
    },
    [controller],
  );

  const beginWrite = useCallback(
    (patch: ProgramEventUpdate): ProgramEventNeutralWrite => {
      const requested: Partial<ProgramEventNeutralConfiguration> = {};
      for (const field of FIELDS) {
        if (patch[field] !== undefined) {
          requested[field] = patch[field] as never;
        }
      }
      if (Object.hasOwn(requested, 'typeId')) {
        requested.typeName = controller.getConfiguration().typeName;
      }
      recordingDraft.current = true;
      let write;
      try {
        write = controller.beginWrite(requested);
      } finally {
        recordingDraft.current = false;
      }
      return {
        origin: write.origin,
        acknowledge: (savedPatch) => {
          const snapshot: Partial<ProgramEventNeutralConfiguration> = {};
          for (const field of FIELDS) {
            if (savedPatch[field] !== undefined) {
              snapshot[field] = savedPatch[field] as never;
            }
          }
          write.acknowledge(snapshot, { authoritative: false });
          publishEditorEntityChange(document, write.origin);
          void refresh();
        },
        fail: write.fail,
      };
    },
    [controller, document, refresh],
  );

  return { beginWrite, refresh, setDraft };
}
