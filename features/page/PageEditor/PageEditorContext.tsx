'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { notifications } from '@mantine/notifications';
import { parseSectionMeta } from '@/features/page/blocks/section-schema';
import {
  createDefaultSection,
  type SectionMeta,
  type SectionType,
  type SectionUpdates,
} from '@/features/page/PageEditor/types';
import {
  createBlockRoomPageSectionsController,
  type BlockRoomPageSectionsController,
} from './block-room-page-sections';
import type { BlockRoomDurabilityProtocol } from '@/lib/collab/block-room-durability';
import { createCollaborativeDocumentSaveTracker } from '@/lib/editor/collaborative-document-save';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('PageEditorContext');

interface PageEditorContextValue {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  controller: BlockRoomPageSectionsController;
  locale: string;
  sections: readonly SectionMeta[];
  userName: string;
  pageId: string;
  editable: boolean;
  allowStructuralEdits: boolean;
  updateSection: (sectionId: string, updates: SectionUpdates) => void;
  updateLocalizedSectionProps: (sectionId: string, props: Record<string, unknown>) => void;
  deleteSection: (sectionId: string) => void;
  addSection: (type: SectionType, index?: number, initialProps?: Record<string, unknown>) => SectionMeta | null;
  moveSections: (fromIndex: number, toIndex: number) => void;
}

const PageEditorContext = createContext<PageEditorContextValue | null>(null);

interface PageEditorProviderProps {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  protocol: BlockRoomDurabilityProtocol;
  locale: string;
  userName: string;
  pageId: string;
  editable?: boolean;
  allowStructuralEdits?: boolean;
  children: ReactNode;
}

export function PageEditorProvider({
  doc,
  provider,
  protocol,
  locale,
  userName,
  pageId,
  editable = true,
  allowStructuralEdits = false,
  children,
}: PageEditorProviderProps) {
  const controller = useMemo(() => createBlockRoomPageSectionsController(doc, locale), [doc, locale]);
  const durability = useMemo(
    () => createCollaborativeDocumentSaveTracker(provider, { kind: 'block-room', protocol }),
    [doc, pageId, protocol, provider],
  );
  const [sections, setSections] = useState<readonly SectionMeta[]>(() => controller.read());

  useEffect(() => {
    setSections(controller.read());
    return controller.observe(setSections);
  }, [controller]);

  const reportFlushError = useCallback(
    (action: string, error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to persist page changes';
      logger.error('Failed to persist page changes', { pageId, action, error: message });
      notifications.show({ message, color: 'red' });
    },
    [pageId],
  );

  useLayoutEffect(
    () => durability.register(`page:${pageId}`, (error) => reportFlushError('navigation', error)),
    [durability, pageId, reportFlushError],
  );

  const persistStructureChange = useCallback(
    (action: string) => {
      void durability.flush((error) => reportFlushError(action, error));
    },
    [durability, reportFlushError],
  );

  const updateSection = useCallback(
    (sectionId: string, updates: SectionUpdates) => {
      if (!editable || !allowStructuralEdits) {
        return;
      }
      controller.update(sectionId, updates);
      if (updates.columns !== undefined) {
        void persistStructureChange('updateSection.columns');
      }
    },
    [allowStructuralEdits, controller, editable, persistStructureChange],
  );

  const updateLocalizedSectionProps = useCallback(
    (sectionId: string, props: Record<string, unknown>) => {
      if (!editable) {
        return;
      }
      controller.updateLocaleProps(sectionId, props);
    },
    [controller, editable],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (!editable || !allowStructuralEdits) {
        return;
      }
      controller.delete(sectionId);
      void persistStructureChange('deleteSection');
    },
    [allowStructuralEdits, controller, editable, persistStructureChange],
  );

  const addSection = useCallback(
    (type: SectionType, index?: number, initialProps?: Record<string, unknown>) => {
      if (!editable || !allowStructuralEdits) {
        return null;
      }
      const created = createDefaultSection(type);
      const section = initialProps
        ? parseSectionMeta({ ...created, props: { ...created.props, ...initialProps } })
        : created;
      if (type === 'external-video' && !section.props?.url) {
        throw new Error('External video URL is required before insertion.');
      }
      if (type === 'form' && !section.props?.formId) {
        throw new Error('A published Form is required before insertion.');
      }
      controller.insert(section, { index: index ?? sections.length });
      void persistStructureChange('addSection');
      return section;
    },
    [allowStructuralEdits, controller, editable, persistStructureChange, sections.length],
  );

  const moveSections = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!editable || !allowStructuralEdits || fromIndex === toIndex) {
        return;
      }
      const section = sections[fromIndex];
      if (!section || toIndex < 0 || toIndex >= sections.length) {
        return;
      }
      controller.move(section.id, { index: toIndex });
      void persistStructureChange('moveSections');
    },
    [allowStructuralEdits, controller, editable, persistStructureChange, sections],
  );

  const value = useMemo<PageEditorContextValue>(
    () => ({
      doc,
      provider,
      controller,
      locale,
      sections,
      userName,
      pageId,
      editable,
      allowStructuralEdits,
      updateSection,
      updateLocalizedSectionProps,
      deleteSection,
      addSection,
      moveSections,
    }),
    [
      doc,
      provider,
      controller,
      locale,
      sections,
      userName,
      pageId,
      editable,
      allowStructuralEdits,
      updateSection,
      updateLocalizedSectionProps,
      deleteSection,
      addSection,
      moveSections,
    ],
  );

  return <PageEditorContext.Provider value={value}>{children}</PageEditorContext.Provider>;
}

export function usePageEditor(): PageEditorContextValue {
  const context = useContext(PageEditorContext);
  if (!context) {
    throw new Error('usePageEditor must be used within a PageEditorProvider');
  }
  return context;
}
