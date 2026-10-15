import { Heading as StoryHeading, Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { documentationFrame, localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { getLocaleDirection } from '@/lib/i18n/locale';

/** Preview-only framing. Product UI always comes from Core or an existing Feature view. */
export function PreviewFrame({
  title,
  description,
  children,
  wide = false,
  as: Frame = 'main',
}: {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  as?: 'main' | 'section';
}) {
  const fixtureText = useStorybookText();
  const locale = useLocale();
  return (
    <Frame
      lang="en"
      dir="ltr"
      style={{ maxWidth: wide ? 1120 : 720, marginInline: 'auto', padding: 'var(--geul-spacing-lg)' }}
    >
      <DsLayoutStack gap="lg">
        <DsLayoutStack gap="xs">
          <div style={{ margin: 0 }}>
            <StoryHeading level={1} scale={4}>
              {title}
            </StoryHeading>
          </div>
          <DsText size="sm" tone="secondary">
            {description}
          </DsText>
        </DsLayoutStack>
        <div lang={locale} dir={getLocaleDirection(locale)}>
          {localizeFixtureTree(children, fixtureText)}
        </div>
      </DsLayoutStack>
    </Frame>
  );
}

Object.assign(PreviewFrame, { [documentationFrame]: true });

export type PreviewState = 'ready' | 'pending' | 'error' | 'disabled';

export const previewStateControl = {
  control: 'select' as const,
  options: ['ready', 'pending', 'error', 'disabled'],
  description: 'Deterministic service state supplied by the preview. No network request is sent.',
};
