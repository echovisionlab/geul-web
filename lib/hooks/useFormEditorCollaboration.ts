'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FORM_CANONICAL_CONTEXT_MAP_NAME,
  FORM_FIELDS_MAP_NAME,
  recordFormLocaleFieldChange,
  type FormCollabFields,
} from '@echovisionlab/geul-common/collaboration/form';
import { applyFormSchemaPatch } from '@echovisionlab/geul-common/collaboration/form-schema-delta';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import { createFormFieldsMap, DEFAULT_FORM_FIELDS, FormFieldsSchema, type FormFields } from '@/lib/collab/form-fields';
import type { TypedMetaMap } from '@/lib/collab/TypedMetaMap';
import { requestFormSchemaPatch, type FormSchemaPatch } from '@/lib/collab/form-schema-protocol';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { useCollaborativeTypedState } from './useCollaborativeTypedState';
import { useHocuspocusConnection } from './useHocuspocusConnection';

export interface FormEditorCollaborationResult {
  provider: ReturnType<typeof useHocuspocusConnection>['provider'];
  doc: ReturnType<typeof useHocuspocusConnection>['doc'];
  formFieldsMap: TypedMetaMap<typeof FormFieldsSchema> | null;
  isConnected: boolean;
  isSynced: boolean;

  // Fixed fields
  fields: FormFields;
  setField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void;
}

interface QueuedFormSchemaPatch extends FormSchemaPatch {
  localRevision: number;
}

interface FormSchemaDraft {
  documentName: string;
  patchPreviousSchema: FormFields['schema'];
  schema: FormFields['schema'];
  localRevision: number;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function createRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `form-schema:${crypto.randomUUID()}`;
    }
  } catch {
    // The timestamp fallback still gives each queued edit a stable retry ID.
  }
  return `form-schema:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function mergeFormSchemaPatches(pending: QueuedFormSchemaPatch, next: QueuedFormSchemaPatch): QueuedFormSchemaPatch {
  return { ...next, previousSchema: pending.previousSchema };
}

export function useFormEditorCollaboration(
  formId: string,
  locale: string | null,
  initialFields?: Partial<FormFields>,
  options?: {
    connectionKey?: string | number | null;
  },
): FormEditorCollaborationResult {
  const documentName = locale ? createDocumentName(CollaborativeDocumentType.FORM, formId, locale) : null;

  const {
    provider,
    doc,
    metaMap,
    isConnected,
    isSynced,
    state,
    setField: setCollaborativeField,
  } = useCollaborativeTypedState({
    documentName,
    connectionKey: options?.connectionKey,
    createMap: createFormFieldsMap,
    defaults: DEFAULT_FORM_FIELDS,
    initialState: initialFields,
    initializeOnSync: false,
  });

  const providerRef = useRef(provider);
  providerRef.current = provider;
  const docRef = useRef(doc);
  docRef.current = doc;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const isSyncedRef = useRef(isSynced);
  isSyncedRef.current = isSynced;
  const schemaDraftRef = useRef<FormSchemaDraft | null>(null);
  const [schemaDraft, setSchemaDraft] = useState<FormSchemaDraft | null>(null);
  const localSchemaRevisionRef = useRef(0);
  const documentKey = `form:${formId}`;
  const schemaPatchQueue = useDebouncedPatch<QueuedFormSchemaPatch>({
    write: async (queuedPatch) => {
      const { localRevision, ...patch } = queuedPatch;
      const activeDoc = docRef.current;
      const activeLocale = localeRef.current;
      const canonicalContext = activeDoc?.getMap<string>(FORM_CANONICAL_CONTEXT_MAP_NAME);
      const sourceLocale = canonicalContext?.get('sourceLocale');
      const roomLocale = canonicalContext?.get('locale');
      const serializedSchema = activeDoc?.getMap<unknown>(FORM_FIELDS_MAP_NAME).get('schema');
      if (
        !isSyncedRef.current ||
        !activeDoc ||
        !activeLocale ||
        !sourceLocale ||
        roomLocale !== activeLocale ||
        typeof serializedSchema !== 'string'
      ) {
        throw new Error('canonical form schema is unavailable for patch rebase');
      }
      const currentSchema = JSON.parse(serializedSchema) as FormFields['schema'];
      const rebasedNextSchema = applyFormSchemaPatch(
        currentSchema,
        patch.previousSchema,
        patch.nextSchema,
        roomLocale === sourceLocale ? 'source' : 'target',
      ) as FormFields['schema'];
      const canonicalSchema = await requestFormSchemaPatch(providerRef.current, {
        ...patch,
        previousSchema: currentSchema,
        nextSchema: rebasedNextSchema,
      });
      if (schemaDraftRef.current?.localRevision === localRevision) {
        const canonicalDraft = {
          documentName: patch.documentName,
          patchPreviousSchema: canonicalSchema as FormFields['schema'],
          schema: canonicalSchema as FormFields['schema'],
          localRevision,
        };
        schemaDraftRef.current = canonicalDraft;
        setSchemaDraft(canonicalDraft);
      }
    },
    delay: 250,
    scope: documentName ?? `form:${formId}:unselected`,
    document: documentKey,
    recoveryScope: documentName,
    recoveryKey: 'form-schema',
    merge: mergeFormSchemaPatches,
    retry: true,
  });

  useEffect(() => {
    if (
      !isSynced ||
      !provider ||
      !documentName ||
      provider.configuration.name !== documentName ||
      !schemaPatchQueue.hasPending()
    ) {
      return;
    }
    void schemaPatchQueue.flush();
  }, [documentName, isSynced, provider, schemaPatchQueue]);

  const activeSchemaDraft = schemaDraft?.documentName === documentName ? schemaDraft : null;
  const fields = activeSchemaDraft ? { ...state, schema: activeSchemaDraft.schema } : state;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  useEffect(() => {
    if (!schemaDraft) {
      return;
    }
    if (schemaDraft.documentName !== documentName) {
      schemaDraftRef.current = null;
      setSchemaDraft(null);
      return;
    }
    if (stableJson(state.schema) !== stableJson(schemaDraft.schema)) {
      return;
    }
    schemaDraftRef.current = null;
    setSchemaDraft(null);
  }, [documentName, schemaDraft, state.schema]);

  const setField = useCallback(
    <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
      const previous = fieldsRef.current;
      const next = { ...previous, [key]: value };
      if (key === 'schema') {
        if (!isSynced || !doc || !documentName) {
          return;
        }
        const currentSchema = previous.schema;
        const nextSchema = value as FormFields['schema'];
        if (!currentSchema || !nextSchema) {
          return;
        }
        const activeDraft = schemaDraftRef.current?.documentName === documentName ? schemaDraftRef.current : null;
        const localRevision = ++localSchemaRevisionRef.current;
        const draft: FormSchemaDraft = {
          documentName,
          patchPreviousSchema: activeDraft?.patchPreviousSchema ?? currentSchema,
          schema: nextSchema,
          localRevision,
        };
        schemaDraftRef.current = draft;
        setSchemaDraft(draft);
        schemaPatchQueue({
          requestId: createRequestId(),
          documentName,
          previousSchema: draft.patchPreviousSchema,
          nextSchema,
          localRevision,
        });
        return;
      }
      if (doc) {
        recordFormLocaleFieldChange(doc, previous as FormCollabFields, next as FormCollabFields);
      }
      fieldsRef.current = next;
      setCollaborativeField(key, value);
    },
    [doc, documentName, isSynced, schemaPatchQueue, setCollaborativeField],
  );

  return {
    provider,
    doc,
    formFieldsMap: metaMap,
    isConnected,
    isSynced,
    fields,
    setField,
  };
}
