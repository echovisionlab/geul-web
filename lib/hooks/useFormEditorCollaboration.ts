'use client';

import { useCallback, useRef } from 'react';
import { recordFormLocaleFieldChange, type FormCollabFields } from '@echovisionlab/geul-common/collaboration/form';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import { createFormFieldsMap, DEFAULT_FORM_FIELDS, FormFieldsSchema, type FormFields } from '@/lib/collab/form-fields';
import type { TypedMetaMap } from '@/lib/collab/TypedMetaMap';
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

  const fieldsRef = useRef(state);
  fieldsRef.current = state;

  const setField = useCallback(
    <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
      const previous = fieldsRef.current;
      const next = { ...previous, [key]: value };
      if (doc) {
        recordFormLocaleFieldChange(doc, previous as FormCollabFields, next as FormCollabFields);
      }
      fieldsRef.current = next;
      setCollaborativeField(key, value);
    },
    [doc, setCollaborativeField],
  );

  return {
    provider,
    doc,
    formFieldsMap: metaMap,
    isConnected,
    isSynced,
    fields: state,
    setField,
  };
}
