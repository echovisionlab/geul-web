'use client';

import { saveFailureFromAction } from '@/lib/editor/save-failure';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import {
  getPageNeutralConfigurationAction,
  updatePageAccessPolicyAction,
  updatePageShowTitleAction,
} from '@/lib/actions/page';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import type { PageAccessPolicyValue } from '@/lib/types/page-access';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';

export interface PageNeutralConfiguration {
  slug: string | null;
  showTitle: boolean;
  status: 'draft' | 'published';
  accessPolicy: PageAccessPolicyValue;
}

export type PageNeutralConfigurationField = keyof PageNeutralConfiguration;

interface PageNeutralWrite<K extends PageNeutralConfigurationField> {
  origin: string;
  acknowledge: (value: PageNeutralConfiguration[K]) => void;
  fail: (refresh?: boolean) => void;
}

export interface UsePageNeutralConfigurationOptions {
  pageId: string;
  initialConfiguration: PageNeutralConfiguration;
  provider?: HocuspocusProvider | null;
  loadConfiguration?: typeof getPageNeutralConfigurationAction;
  saveShowTitle?: typeof updatePageShowTitleAction;
  saveAccessPolicy?: typeof updatePageAccessPolicyAction;
  onShowTitleSaveError?: (message: string) => void;
  delay?: number;
}

export function usePageNeutralConfiguration({
  pageId,
  initialConfiguration,
  provider,
  loadConfiguration = getPageNeutralConfigurationAction,
  saveShowTitle = updatePageShowTitleAction,
  saveAccessPolicy = updatePageAccessPolicyAction,
  onShowTitleSaveError,
  delay = 500,
}: UsePageNeutralConfigurationOptions) {
  const document = `page:${pageId}`;
  const controller = useAuthoritativeConfiguration({ document, initialConfiguration });
  const activeController = useRef<typeof controller | null>(controller);
  activeController.current = controller;
  const scope = useMemo(() => ({ pageId, showTitleFailureReported: false }), [pageId]);
  const configuration = controller.getConfiguration();

  const refresh = useCallback(async () => {
    if (activeController.current !== controller) {
      return;
    }
    const read = controller.beginRead();
    try {
      const result = await loadConfiguration(pageId);
      if (result.ok && activeController.current === controller) {
        controller.adoptRead(read, {
          slug: result.slug,
          showTitle: result.showTitle,
          status: result.status,
          accessPolicy: result.accessPolicy,
        });
      }
    } catch {
      // A later exact-identity hint can retry this authorized read.
    }
  }, [controller, loadConfiguration, pageId]);

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
    <K extends PageNeutralConfigurationField>(field: K, value: PageNeutralConfiguration[K]) => {
      if (activeController.current === controller) {
        controller.setDraft(field, value);
      }
    },
    [controller],
  );

  const isDraft = controller.isDraft;
  const beginFieldWrite = useCallback(
    <K extends PageNeutralConfigurationField>(field: K, value?: PageNeutralConfiguration[K]): PageNeutralWrite<K> => {
      const write = controller.beginWrite(
        value === undefined ? [field] : ({ [field]: value } as Partial<PageNeutralConfiguration>),
      );
      return {
        origin: write.origin,
        acknowledge: (value) => {
          if (!write.acknowledge({ [field]: value } as Partial<PageNeutralConfiguration>)) {
            void refresh();
          }
          publishEditorEntityChange(document, write.origin);
        },
        fail: (shouldRefresh = true) => {
          write.fail();
          if (shouldRefresh) {
            void refresh();
          }
        },
      };
    },
    [controller, document, refresh],
  );

  const saveAccess = useCallback(
    async (value: PageAccessPolicyValue) => {
      const write = beginFieldWrite('accessPolicy', controller.isDraft('accessPolicy') ? value : undefined);
      try {
        const result = await saveAccessPolicy(scope.pageId, value, write.origin);
        if (result.ok) {
          write.acknowledge(result.accessPolicy);
        } else {
          write.fail(false);
        }
        return result;
      } catch (error) {
        write.fail(false);
        throw error;
      }
    },
    [beginFieldWrite, controller, saveAccessPolicy, scope],
  );

  const writeShowTitle = useCallback(
    async ({ value }: { value: boolean }) => {
      const write = beginFieldWrite('showTitle', value);
      try {
        const result = await saveShowTitle(scope.pageId, value, write.origin);
        if (!result.ok) {
          throw saveFailureFromAction(result);
        }
        write.acknowledge(result.showTitle);
        scope.showTitleFailureReported = false;
      } catch (error) {
        write.fail(false);
        if (!scope.showTitleFailureReported) {
          onShowTitleSaveError?.(error instanceof Error ? error.message : 'Failed to update page title visibility');
          scope.showTitleFailureReported = true;
        }
        throw error;
      }
    },
    [beginFieldWrite, onShowTitleSaveError, saveShowTitle, scope],
  );

  const showTitlePatch = useDebouncedPatch({
    document: `page:${scope.pageId}`,
    scope: `page-neutral:${scope.pageId}`,
    recoveryScope: `page:${scope.pageId}`,
    recoveryKey: 'page-show-title',
    delay,
    retry: true,
    write: writeShowTitle,
  });

  return useMemo(
    () => ({
      configuration,
      setDraft,
      isDraft,
      beginFieldWrite,
      saveAccess,
      queueShowTitle: (value: boolean) => showTitlePatch({ value }),
    }),
    [beginFieldWrite, configuration, isDraft, saveAccess, setDraft, showTitlePatch],
  );
}
