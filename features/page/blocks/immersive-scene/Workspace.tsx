'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ScrollArea } from '@/components/core/Display';
import { InputSizeProvider } from '@/components/core/Input';
import { ContentModal } from '@/components/core/Modal';
import { Tabs } from '@/components/core/Tabs';
import { parseImmersiveSceneConfig, type ImmersiveSceneProps } from './schema';
import { ImmersiveSceneRenderer } from './SceneRenderer';
import { ImmersiveSceneSettingsForm, type ImmersiveSceneUploadControls } from './SettingsForm';
import styles from './Workspace.module.css';

interface ImmersiveSceneWorkspaceContentProps {
  sectionId: string;
  pageId: string;
  contentLanguage?: string;
  props: Partial<ImmersiveSceneProps>;
  updateSharedProps: (props: Record<string, unknown>) => void;
  updateLocalizedProps: (props: Record<string, unknown>) => void;
  uploadControls: ImmersiveSceneUploadControls;
  sectionSettings?: ReactNode;
}

export interface ImmersiveSceneWorkspaceProps extends ImmersiveSceneWorkspaceContentProps {
  opened: boolean;
  title: string;
  onClose: () => void;
}

export function ImmersiveSceneWorkspaceContent({
  sectionId,
  pageId,
  contentLanguage,
  props,
  updateSharedProps,
  updateLocalizedProps,
  uploadControls,
  sectionSettings,
}: ImmersiveSceneWorkspaceContentProps) {
  const t = useTranslations('pageEditor');
  const config = useMemo(() => parseImmersiveSceneConfig(props), [props]);
  const [activePanel, setActivePanel] = useState<'unit' | 'scene' | 'section'>('unit');
  const [expandedUnitId, setExpandedUnitId] = useState('');
  const [previewUnitId, setPreviewUnitId] = useState(() => config.units[0]?.id ?? '');
  useEffect(() => {
    if (previewUnitId === '' || config.units.some((unit) => unit.id === previewUnitId)) {
      return;
    }
    setPreviewUnitId(config.units[0]?.id ?? '');
  }, [config.units, previewUnitId]);

  const selectEditorUnit = useCallback((unitId: string) => {
    setExpandedUnitId(unitId);
    if (unitId !== '') {
      setPreviewUnitId(unitId);
    }
  }, []);

  const selectedUnitIndex = Math.max(
    0,
    config.units.findIndex((unit) => unit.id === previewUnitId),
  );
  const previewProgress = config.units.length <= 1 ? 0 : selectedUnitIndex / (config.units.length - 1);

  return (
    <div className={styles.container} data-testid="immersive-scene-workspace-container">
      <div className={styles.workspace} data-testid="immersive-scene-workspace">
        <div className={styles.preview} lang={contentLanguage} data-testid="immersive-scene-workspace-preview">
          <ImmersiveSceneRenderer config={config} preview progress={previewProgress} />
        </div>

        <div className={styles.inspector}>
          <InputSizeProvider size="xs">
            <Tabs
              value={activePanel}
              onChange={(value) => setActivePanel((value as typeof activePanel | null) ?? 'unit')}
              keepMounted={false}
              fill
            >
              <Tabs.List grow inset="md" paddingTop="sm">
                <Tabs.Tab value="unit">{t('blockEditor.sections.sceneUnits')}</Tabs.Tab>
                <Tabs.Tab value="scene">{t('blockEditor.sections.sceneSettings')}</Tabs.Tab>
                {sectionSettings ? <Tabs.Tab value="section">{t('sectionItem.settings.tabs.section')}</Tabs.Tab> : null}
              </Tabs.List>

              <ScrollArea grow>
                <Tabs.Panel value="unit" inset="md">
                  <ImmersiveSceneSettingsForm
                    sectionId={sectionId}
                    pageId={pageId}
                    contentLanguage={contentLanguage}
                    props={props}
                    updateSharedProps={updateSharedProps}
                    updateLocalizedProps={updateLocalizedProps}
                    uploadControls={uploadControls}
                    panel="unit"
                    selectedUnitId={expandedUnitId}
                    onSelectedUnitChange={selectEditorUnit}
                  />
                </Tabs.Panel>
                <Tabs.Panel value="scene" inset="md">
                  <ImmersiveSceneSettingsForm
                    sectionId={sectionId}
                    pageId={pageId}
                    contentLanguage={contentLanguage}
                    props={props}
                    updateSharedProps={updateSharedProps}
                    updateLocalizedProps={updateLocalizedProps}
                    uploadControls={uploadControls}
                    panel="scene"
                  />
                </Tabs.Panel>
                {sectionSettings ? (
                  <Tabs.Panel value="section" inset="md">
                    {sectionSettings}
                  </Tabs.Panel>
                ) : null}
              </ScrollArea>
            </Tabs>
          </InputSizeProvider>
        </div>
      </div>
    </div>
  );
}

export function ImmersiveSceneWorkspace({ opened, title, onClose, ...contentProps }: ImmersiveSceneWorkspaceProps) {
  const tModalActions = useTranslations('common.actions');
  return (
    <ContentModal opened={opened} onClose={onClose} title={title} closeLabel={tModalActions('close')} size="workspace">
      <ImmersiveSceneWorkspaceContent {...contentProps} />
    </ContentModal>
  );
}
