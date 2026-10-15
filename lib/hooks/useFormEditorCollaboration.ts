'use client';

import { parseServerMessage } from '@echovisionlab/geul-common/collaboration/protocol';
import { formSchemaZod } from '@/lib/types/form/schema';
import { getProviderAccessEnded, getProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { SaveParkedError } from '@/lib/editor/save-failure';
import { createLogger } from '@/lib/utils/logger';
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
  return crypto.randomUUID();
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
      // A room downgraded to view keeps the patch for a page reopened with edit access.
      if (getProviderAccessLevel(providerRef.current) === 'view') {
        throw new SaveParkedError();
      }
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
      const canonicalResponse = await requestFormSchemaPatch(providerRef.current, {
        ...patch,
        previousSchema: currentSchema,
        nextSchema: rebasedNextSchema,
      });
      const canonicalSchema = formSchemaZod.parse(canonicalResponse);
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
    if (!isSynced || !provider || !documentName || provider.configuration.name !== documentName) {
      return;
    }
    // A synced room with edit access takes back a patch parked while it was read-only.
    if (schemaPatchQueue.hasParked() && getProviderAccessLevel(provider) === 'edit') {
      schemaPatchQueue.resumeParked();
    }
    if (!schemaPatchQueue.hasPending()) {
      return;
    }
    void schemaPatchQueue.flush();
  }, [documentName, isSynced, provider, schemaPatchQueue]);

  useEffect(() => {
    if (!provider || !documentName) {
      return;
    }
    const stateless = ({ payload }: { payload: string }) => {
      const parsed = parseServerMessage(payload);
      if (!parsed.ok || parsed.message.kind !== 'form.schema.changed' || parsed.message.documentName !== documentName) {
        return;
      }
      const canonical = formSchemaZod.safeParse(parsed.message.canonicalSchema);
      if (!canonical.success) {
        void createLogger('form-schema').warn('Ignoring invalid canonical form schema');
        return;
      }
      // The server also projects this state through Yjs. Retain a local queued
      // intent; it will rebase over that projection when the queue next flushes.
      // A pending or parked local intent keeps its draft; it rebases over this projection later.
      if (schemaPatchQueue.hasPending() || schemaPatchQueue.hasParked()) {
        return;
      }
      const draft = {
        documentName,
        schema: canonical.data,
        patchPreviousSchema: canonical.data,
        localRevision: localSchemaRevisionRef.current,
      };
      schemaDraftRef.current = draft;
      setSchemaDraft(draft);
    };
    provider.on('stateless', stateless);
    return () => {
      provider.off('stateless', stateless);
    };
  }, [documentName, provider, schemaPatchQueue]);

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
      if (getProviderAccessEnded(providerRef.current)) {
        return;
      }
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
