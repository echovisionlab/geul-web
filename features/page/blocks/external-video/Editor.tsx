'use client';

import { useCallback } from 'react';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { ExternalVideoProps } from './schema';
import { ExternalVideoSettingsForm } from './SettingsForm';

export function ExternalVideoEditor({ sectionId, props }: BlockEditorProps<ExternalVideoProps>) {
  const { updateSection, updateLocalizedSectionProps } = usePageEditor();
  const updateSharedProps = useCallback(
    (nextProps: Record<string, unknown>) => updateSection(sectionId, { props: nextProps }),
    [sectionId, updateSection],
  );
  const updateLocalizedProps = useCallback(
    (nextProps: Record<string, unknown>) => updateLocalizedSectionProps(sectionId, nextProps),
    [sectionId, updateLocalizedSectionProps],
  );

  return (
    <ExternalVideoSettingsForm
      props={props}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateLocalizedProps}
    />
  );
}

export function ExternalVideoSettingsEditor({
  props,
  updateSharedProps,
  updateLocalizedProps,
}: BlockSettingsEditorProps<ExternalVideoProps>) {
  return (
    <ExternalVideoSettingsForm
      props={props}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateLocalizedProps}
    />
  );
}
