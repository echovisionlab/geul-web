'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FormFields } from '@/lib/collab/form-fields';
import { resolveLocaleRoomLocale } from '@/features/translation/locale-document-mode';
import { useActiveEditLocale } from '@/features/translation/useActiveEditLocale';
import { useFormEditorCollaboration, type FormEditorCollaborationResult } from '@/lib/hooks/useFormEditorCollaboration';
import type { OgGenerationLookupSignal } from '@/lib/types/og-generation';

export interface FormEditorContextValue extends FormEditorCollaborationResult {
  activeEditLocale: ReturnType<typeof useActiveEditLocale>;
  ogGenerationLookup: OgGenerationLookupSignal | null;
  notifyOgGenerationLookup: (locale: string) => void;
}

const FormEditorContext = createContext<FormEditorContextValue | null>(null);

interface FormEditorProviderProps {
  formId: string;
  initialFields?: Partial<FormFields>;
  children: ReactNode;
}

export function FormEditorProvider({ formId, initialFields, children }: FormEditorProviderProps) {
  const activeEditLocale = useActiveEditLocale({
    entityType: 'form',
    entityId: formId,
    sourceTitle: initialFields?.title ?? '',
    sourceSummary: '',
  });
  const roomLocale = resolveLocaleRoomLocale({
    activeLocale: activeEditLocale.activeLocale,
    sourceLocale: activeEditLocale.sourceLocale,
    isSourceLocale: activeEditLocale.isSourceLocale,
    hasLiveRow: activeEditLocale.hasLiveRow,
    isSourceLocaleReady: activeEditLocale.isSourceLocaleReady,
  });
  const collaboration = useFormEditorCollaboration(formId, roomLocale, initialFields);
  const [ogGenerationLookup, setOgGenerationLookup] = useState<OgGenerationLookupSignal | null>(null);
  const ogGenerationSequenceRef = useRef(0);
  const notifyOgGenerationLookup = useCallback((locale: string) => {
    const normalizedLocale = locale.trim();
    if (!normalizedLocale) {
      return;
    }
    setOgGenerationLookup({
      locale: normalizedLocale,
      sequence: ++ogGenerationSequenceRef.current,
    });
  }, []);
  const value = useMemo<FormEditorContextValue>(
    () => ({
      ...collaboration,
      activeEditLocale,
      ogGenerationLookup,
      notifyOgGenerationLookup,
    }),
    [activeEditLocale, collaboration, notifyOgGenerationLookup, ogGenerationLookup],
  );

  return <FormEditorContext.Provider value={value}>{children}</FormEditorContext.Provider>;
}

export function useFormEditorContext(): FormEditorContextValue {
  const context = useContext(FormEditorContext);
  if (!context) {
    throw new Error('useFormEditorContext must be used within FormEditorProvider');
  }
  return context;
}
