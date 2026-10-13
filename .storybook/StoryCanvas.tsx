import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { useColorScheme } from '@/lib/providers/DesignSystemProvider';
import { LayoutInline, LayoutInset } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { getThemeDefinition } from '../lib/theme/themes';
import classes from './StoryCanvas.module.css';

/** Shared theme surface and context; each catalog entry mounts its actual UI owner. */
export function StoryCanvas({
  title,
  name,
  inset,
  embedded = false,
  children,
}: {
  title: string;
  name: string;
  inset: 'none' | 'lg';
  embedded?: boolean;
  children: ReactNode;
}) {
  const locale = useLocale();
  const { themeId } = useColorScheme();
  const selectedTheme = getThemeDefinition(themeId);
  const language = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  return (
    <div className={classes.canvas} data-embedded={embedded || undefined}>
      <div className={classes.header} role="region" aria-label={`${title} · ${name}`}>
        <LayoutInset block="xs" inline="lg">
          <LayoutInline justify="between" gap="xs">
            <Text size="xs" tone="muted">
              {title} · {name}
            </Text>
            <Text size="xs" tone="muted">
              {language} · {selectedTheme.label}
            </Text>
          </LayoutInline>
        </LayoutInset>
      </div>
      <div
        className={
          title === 'Pages/Application/Frames' || title === 'Pages/Admin/Map Places' ? classes.frameSurface : undefined
        }
      >
        <LayoutInset space={inset}>{children}</LayoutInset>
      </div>
    </div>
  );
}
