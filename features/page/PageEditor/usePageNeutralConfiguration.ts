'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { getPageNeutralConfigurationAction, updatePageShowTitleAction } from '@/lib/actions/page';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';

export interface PageNeutralConfiguration {
  slug: string | null;
  showTitle: boolean;
  status: 'draft' | 'published';
}

export type PageNeutralConfigurationField = keyof PageNeutralConfiguration;

interface PageNeutralScope {
  readonly pageId: string;
  canonical: PageNeutralConfiguration;
  requestGeneration: number;
  drafts: Map<PageNeutralConfigurationField, unknown>;
  draftVersions: Map<PageNeutralConfigurationField, number>;
  pendingWrites: Map<PageNeutralConfigurationField, Set<symbol>>;
  showTitleFailureReported: boolean;
}

interface PageNeutralConfigurationState {
  scope: PageNeutralScope;
  configuration: PageNeutralConfiguration;
}

interface PageNeutralWrite<K extends PageNeutralConfigurationField> {
  acknowledge: (value: PageNeutralConfiguration[K]) => void;
  fail: (refresh?: boolean) => void;
}

export interface UsePageNeutralConfigurationOptions {
  pageId: string;
  initialConfiguration: PageNeutralConfiguration;
  provider?: HocuspocusProvider | null;
  loadConfiguration?: typeof getPageNeutralConfigurationAction;
  saveShowTitle?: typeof updatePageShowTitleAction;
  onShowTitleSaveError?: (message: string) => void;
  delay?: number;
}

const FIELDS: readonly PageNeutralConfigurationField[] = ['slug', 'showTitle', 'status'];

function createPageNeutralScope(pageId: string, initialConfiguration: PageNeutralConfiguration): PageNeutralScope {
  return {
    pageId,
    canonical: initialConfiguration,
    requestGeneration: 0,
    drafts: new Map(),
    draftVersions: new Map(),
    pendingWrites: new Map(),
    showTitleFailureReported: false,
  };
}

export function usePageNeutralConfiguration({
  pageId,
  initialConfiguration,
  provider,
  loadConfiguration = getPageNeutralConfigurationAction,
  saveShowTitle = updatePageShowTitleAction,
  onShowTitleSaveError,
  delay = 500,
}: UsePageNeutralConfigurationOptions) {
  const scope = useMemo(() => createPageNeutralScope(pageId, initialConfiguration), [pageId]);
  const [state, setState] = useState<PageNeutralConfigurationState>({ scope, configuration: initialConfiguration });
  const configuration = state.scope === scope ? state.configuration : initialConfiguration;
  const activeScopeRef = useRef(scope);
  activeScopeRef.current = scope;
  const previousScopeRef = useRef(scope);

  const refresh = useCallback(async () => {
    const requestedScope = scope;
    if (activeScopeRef.current !== requestedScope) {
      return;
    }
    const generation = ++requestedScope.requestGeneration;
    try {
      const result = await loadConfiguration(requestedScope.pageId);
      if (!result.ok || activeScopeRef.current !== requestedScope || requestedScope.requestGeneration !== generation) {
        return;
      }

      const canonical: PageNeutralConfiguration = {
        slug: result.slug,
        showTitle: result.showTitle,
        status: result.status,
      };
      requestedScope.canonical = canonical;
      setState((current) => {
        if (activeScopeRef.current !== requestedScope) {
          return current;
        }
        const local = current.scope === requestedScope ? current.configuration : initialConfiguration;
        let next = { ...local };
        for (const field of FIELDS) {
          const pending = requestedScope.pendingWrites.get(field);
          if (pending?.size) {
            continue;
          }
          if (!requestedScope.drafts.has(field) || Object.is(requestedScope.drafts.get(field), canonical[field])) {
            requestedScope.drafts.delete(field);
            next = { ...next, [field]: canonical[field] };
          }
        }
        return { scope: requestedScope, configuration: next };
      });
    } catch {
      // A later exact-identity hint can retry this authorized read.
    }
  }, [initialConfiguration, loadConfiguration, scope]);

  useEditorEntityChanges(`page:${scope.pageId}`, () => void refresh(), provider);

  useEffect(() => {
    if (previousScopeRef.current !== scope) {
      previousScopeRef.current = scope;
      setState({ scope, configuration: initialConfiguration });
    }

    void refresh();
    return () => {
      if (activeScopeRef.current === scope) {
        scope.requestGeneration += 1;
      }
    };
  }, [initialConfiguration, refresh, scope]);

  const setDraft = useCallback(
    <K extends PageNeutralConfigurationField>(field: K, value: PageNeutralConfiguration[K]) => {
      if (activeScopeRef.current !== scope) {
        return;
      }
      const canonical = scope.canonical;
      if (Object.is(value, canonical[field])) {
        scope.drafts.delete(field);
      } else {
        scope.drafts.set(field, value);
      }
      scope.draftVersions.set(field, (scope.draftVersions.get(field) ?? 0) + 1);
      setState((current) => {
        const local = current.scope === scope ? current.configuration : initialConfiguration;
        return {
          scope,
          configuration: { ...local, [field]: value },
        };
      });
    },
    [initialConfiguration, scope],
  );

  const isDraft = useCallback((field: PageNeutralConfigurationField) => scope.drafts.has(field), [scope]);

  const beginFieldWrite = useCallback(
    <K extends PageNeutralConfigurationField>(field: K): PageNeutralWrite<K> => {
      const requestScope = scope;
      if (activeScopeRef.current !== requestScope) {
        let finished = false;
        return {
          acknowledge: () => {
            if (!finished) {
              finished = true;
              publishEditorEntityChange(`page:${requestScope.pageId}`);
            }
          },
          fail: () => {
            finished = true;
          },
        };
      }
      const token = Symbol(field);
      const draftVersion = requestScope.draftVersions.get(field) ?? 0;
      const requests = requestScope.pendingWrites.get(field) ?? new Set<symbol>();
      requests.add(token);
      requestScope.pendingWrites.set(field, requests);
      let finished = false;

      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        if (activeScopeRef.current !== requestScope) {
          return;
        }
        const activeRequests = requestScope.pendingWrites.get(field);
        activeRequests?.delete(token);
        if (activeRequests?.size === 0) {
          requestScope.pendingWrites.delete(field);
        }
      };

      return {
        acknowledge: (value) => {
          finish();
          if (activeScopeRef.current !== requestScope) {
            publishEditorEntityChange(`page:${requestScope.pageId}`);
            return;
          }
          requestScope.canonical = { ...requestScope.canonical, [field]: value };
          if ((requestScope.draftVersions.get(field) ?? 0) === draftVersion) {
            requestScope.drafts.delete(field);
          }
          setState((current) => {
            if (activeScopeRef.current !== requestScope || current.scope !== requestScope) {
              return current;
            }
            const local = current.configuration;
            const stillPending = Boolean(requestScope.pendingWrites.get(field)?.size);
            const shouldAdopt = !stillPending && !requestScope.drafts.has(field);
            return {
              scope: requestScope,
              configuration: shouldAdopt ? { ...local, [field]: value } : local,
            };
          });
          publishEditorEntityChange(`page:${requestScope.pageId}`);
          void refresh();
        },
        fail: (shouldRefresh = true) => {
          finish();
          if (shouldRefresh && activeScopeRef.current === requestScope) {
            void refresh();
          }
        },
      };
    },
    [refresh, scope],
  );

  const writeShowTitle = useCallback(
    async ({ value }: { value: boolean }) => {
      const write = beginFieldWrite('showTitle');
      try {
        const result = await saveShowTitle(scope.pageId, value);
        if (!result.ok) {
          throw new Error(result.error);
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
      queueShowTitle: (value: boolean) => showTitlePatch({ value }),
    }),
    [beginFieldWrite, configuration, isDraft, setDraft, showTitlePatch],
  );
}
