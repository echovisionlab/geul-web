'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { Checkbox, Select, TextInput } from '@/components/core/Input';
import { isToolModuleUrl, resolveEmbedUrl } from './policy';
import { EMBED_MAX_HEIGHT, EMBED_MIN_HEIGHT, parseEmbedProps, type EmbedProps } from './schema';

interface EmbedSettingsFormProps {
  props: Partial<EmbedProps>;
  allowSharedEdits?: boolean;
  updateSharedProps: (props: Record<string, unknown>) => void;
  updateLocalizedProps: (props: Record<string, unknown>) => void;
}

export function EmbedSettingsForm({
  props,
  allowSharedEdits = true,
  updateSharedProps,
  updateLocalizedProps,
}: EmbedSettingsFormProps) {
  const t = useTranslations('pageEditor.embed');
  const parsed = parseEmbedProps(props);
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  useEffect(() => setParentOrigin(window.location.origin), []);
  const [uri, setUri] = useState(parsed.uri);
  const url = resolveEmbedUrl(uri, parentOrigin);
  const module = url && isToolModuleUrl(url);
  const [height, setHeight] = useState(parsed.height);
  const [persisted, setPersisted] = useState({ uri: parsed.uri, height: parsed.height });
  if (persisted.uri !== parsed.uri || persisted.height !== parsed.height) {
    if (persisted.uri !== parsed.uri) {
      setUri(parsed.uri);
    }
    if (persisted.height !== parsed.height) {
      setHeight(parsed.height);
    }
    setPersisted({ uri: parsed.uri, height: parsed.height });
  }
  const commitUri = () => {
    const url = resolveEmbedUrl(uri, parentOrigin);
    if (allowSharedEdits && url) {
      updateSharedProps({ uri: url.href });
    }
  };
  const commitHeight = () => {
    const valid = /^\d+$/.test(height) && Number(height) >= EMBED_MIN_HEIGHT && Number(height) <= EMBED_MAX_HEIGHT;
    if (allowSharedEdits && valid) {
      updateSharedProps({ height: String(Number(height)) });
    } else {
      setHeight(parsed.height);
    }
  };
  const permissions = [
    ['allowScripts', 'scriptsLabel', 'scriptsDescription'],
    ['allowSameOrigin', 'storageLabel', 'storageDescription'],
    ['allowForms', 'formsLabel', 'formsDescription'],
    ['allowDownloads', 'downloadsLabel', 'downloadsDescription'],
    ['allowPopups', 'popupsLabel', 'popupsDescription'],
    ['allowMicrophone', 'microphoneLabel', 'microphoneDescription'],
    ['allowSpeakerSelection', 'speakerSelectionLabel', 'speakerSelectionDescription'],
    ['allowFullscreen', 'fullscreenLabel', 'fullscreenDescription'],
  ] as const;

  return (
    <Stack gap="sm" data-page-block-editor="embed">
      <TextInput
        label={t('urlLabel')}
        description={t(module ? 'toolDescription' : 'urlDescription')}
        value={uri}
        disabled={!allowSharedEdits}
        error={uri.trim() && !url ? t('invalidUrl') : undefined}
        onChange={(event) => setUri(event.currentTarget.value)}
        onBlur={commitUri}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitUri();
          }
        }}
      />
      <TextInput
        label={t('titleLabel')}
        description={t('titleDescription')}
        value={parsed.title}
        onChange={(event) => updateLocalizedProps({ title: event.currentTarget.value })}
      />
      {!module && (
        <>
          <Select
            label={t('heightModeLabel')}
            value={parsed.heightMode}
            disabled={!allowSharedEdits}
            data={[
              { value: 'fixed', label: t('heightFixed') },
              { value: 'auto', label: t('heightAuto') },
              { value: 'viewport', label: t('heightViewport') },
            ]}
            onChange={(value) => {
              if (allowSharedEdits && value) {
                updateSharedProps({ heightMode: value });
              }
            }}
          />
          {parsed.heightMode !== 'viewport' && (
            <TextInput
              label={t('heightLabel')}
              value={height}
              inputMode="numeric"
              disabled={!allowSharedEdits}
              description={parsed.heightMode === 'auto' ? t('heightAutoDescription') : undefined}
              onChange={(event) => setHeight(event.currentTarget.value)}
              onBlur={commitHeight}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitHeight();
                }
              }}
            />
          )}
          <Text size="sm" fw={500}>
            {t('permissionsLabel')}
          </Text>
          {permissions.map(([key, label, description]) => (
            <Checkbox
              key={key}
              label={t(label)}
              description={t(description)}
              styles={{ labelWrapper: { minWidth: 0 }, description: { overflowWrap: 'anywhere' } }}
              checked={parsed[key] === 'true'}
              disabled={!allowSharedEdits}
              onChange={(event) => {
                if (allowSharedEdits) {
                  updateSharedProps({ [key]: event.currentTarget.checked ? 'true' : 'false' });
                }
              }}
            />
          ))}
        </>
      )}
    </Stack>
  );
}
