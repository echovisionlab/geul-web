'use client';

import { Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { MaterializedEmailLayoutUnit } from '@echovisionlab/geul-common/collaboration/email-layout';
import { Textarea } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';

interface EmailLayoutTargetEditorProps {
  units: readonly MaterializedEmailLayoutUnit[];
  editable?: boolean;
  onChange: (handle: string, value: string) => void;
  onUseSource: (handle: string) => void;
}

function unitLabel(unit: MaterializedEmailLayoutUnit, textLabel: string): string {
  return unit.kind === 'text' ? textLabel : `${unit.element}[${unit.attribute}]`;
}

export function EmailLayoutTargetEditor({
  units,
  editable = true,
  onChange,
  onUseSource,
}: EmailLayoutTargetEditorProps) {
  const t = useTranslations('adminList.emailLayouts.detail.targetEditor');

  return (
    <ScrollArea h="100%" type="auto">
      <Stack gap="sm" p="sm">
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {t('title')}
          </Text>
          <Text size="xs" c="dimmed">
            {t('description')}
          </Text>
        </Stack>

        {units.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('empty')}
          </Text>
        ) : null}

        {units.map((unit) => (
          <Paper key={unit.handle} withBorder p="sm">
            <Stack gap="xs">
              <Textarea
                label={unitLabel(unit, t('textUnit'))}
                description={t('sourceValue', { value: unit.sourceValue })}
                value={unit.value}
                onChange={(event) => onChange(unit.handle, event.currentTarget.value)}
                disabled={!editable}
                autosize
                minRows={unit.kind === 'text' ? 2 : 1}
                data-email-layout-unit={unit.handle}
              />
              <Group justify="space-between" gap="xs">
                <Text size="xs" c="dimmed">
                  {unit.localeValuePresent ? t('translatedValue') : t('sourceFallback')}
                </Text>
                <TextButton
                  appearance="muted"
                  size="xs"
                  disabled={!editable || !unit.localeValuePresent}
                  onClick={() => onUseSource(unit.handle)}
                >
                  {t('useSource')}
                </TextButton>
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </ScrollArea>
  );
}
