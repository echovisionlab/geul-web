'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Modal, ScrollArea } from '@mantine/core';
import { Tabs } from '@/components/core/Tabs';
import { parseImmersiveSceneConfig, type ImmersiveSceneProps } from './schema';
import { ImmersiveSceneRenderer } from './SceneRenderer';
import { ImmersiveSceneSettingsForm, type ImmersiveSceneUploadControls } from './SettingsForm';
import styles from './Workspace.module.css';

interface ImmersiveSceneWorkspaceContentProps {
  sectionId: string;
  pageId: string;
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
    <Box className={styles.container} data-testid="immersive-scene-workspace-container">
      <Box className={styles.workspace} data-testid="immersive-scene-workspace">
        <Box className={styles.preview} data-testid="immersive-scene-workspace-preview">
          <ImmersiveSceneRenderer config={config} preview progress={previewProgress} />
        </Box>

        <Box className={styles.inspector}>
          <Tabs
            value={activePanel}
            onChange={(value) => setActivePanel((value as typeof activePanel | null) ?? 'unit')}
            keepMounted={false}
            style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column' }}
          >
            <Tabs.List grow px="md" pt="sm">
              <Tabs.Tab value="unit">{t('blockEditor.sections.sceneUnits')}</Tabs.Tab>
              <Tabs.Tab value="scene">{t('blockEditor.sections.sceneSettings')}</Tabs.Tab>
              {sectionSettings ? <Tabs.Tab value="section">{t('sectionItem.settings.tabs.section')}</Tabs.Tab> : null}
            </Tabs.List>

            <ScrollArea style={{ minHeight: 0, flex: 1 }} type="auto">
              <Tabs.Panel value="unit" p="md">
                <ImmersiveSceneSettingsForm
                  sectionId={sectionId}
                  pageId={pageId}
                  props={props}
                  updateSharedProps={updateSharedProps}
                  updateLocalizedProps={updateLocalizedProps}
                  uploadControls={uploadControls}
                  panel="unit"
                  selectedUnitId={expandedUnitId}
                  onSelectedUnitChange={selectEditorUnit}
                />
              </Tabs.Panel>
              <Tabs.Panel value="scene" p="md">
                <ImmersiveSceneSettingsForm
                  sectionId={sectionId}
                  pageId={pageId}
                  props={props}
                  updateSharedProps={updateSharedProps}
                  updateLocalizedProps={updateLocalizedProps}
                  uploadControls={uploadControls}
                  panel="scene"
                />
              </Tabs.Panel>
              {sectionSettings ? (
                <Tabs.Panel value="section" p="md">
                  {sectionSettings}
                </Tabs.Panel>
              ) : null}
            </ScrollArea>
          </Tabs>
        </Box>
      </Box>
    </Box>
  );
}

export function ImmersiveSceneWorkspace({ opened, title, onClose, ...contentProps }: ImmersiveSceneWorkspaceProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      fullScreen
      padding={0}
      styles={{
        header: { padding: '12px 16px' },
        body: { height: 'calc(100dvh - 60px)', padding: 0 },
      }}
    >
      <ImmersiveSceneWorkspaceContent {...contentProps} />
    </Modal>
  );
}
