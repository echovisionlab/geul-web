import type { ReactRenderer } from '@storybook/nextjs';
import type { Args, PartialStoryFn, StoryContext } from 'storybook/internal/types';
import { createTranslator, useLocale, useMessages, type AbstractIntlMessages } from 'next-intl';

type Translate = (key: string, values?: Record<string, string | number>) => string;
type LabelValue =
  | string
  | { key: string; values: Record<string, string | number> }
  | ((translate: Translate, locale: string) => unknown);

interface FeatureLabelConfig {
  labels?: Record<string, LabelValue>;
  localeProp?: boolean;
  project?: (args: Record<string, unknown>, translate: Translate, locale: string) => Record<string, unknown>;
}

/** Localizes presentation props only. Fixture entity data and callbacks remain with the story. */
export function withFeatureLabels(config: FeatureLabelConfig) {
  return function LocalizedFeatureStory<TArgs extends Args>(
    Story: PartialStoryFn<ReactRenderer, TArgs>,
    context: StoryContext<ReactRenderer, TArgs>,
  ) {
    const locale = useLocale();
    const messages: AbstractIntlMessages = useMessages();
    const translate = createTranslator({ locale, messages }) as unknown as Translate;
    const labels = Object.fromEntries(
      Object.entries(config.labels ?? {}).map(([field, value]) => [
        field,
        typeof value === 'string'
          ? translate(value)
          : typeof value === 'function'
            ? value(translate, locale)
            : translate(value.key, value.values),
      ]),
    );
    return (
      <Story
        args={{
          ...context.args,
          ...(config.labels
            ? {
                labels: {
                  ...(context.args.labels && typeof context.args.labels === 'object' ? context.args.labels : {}),
                  ...labels,
                },
              }
            : {}),
          ...(config.localeProp ? { locale } : {}),
          ...config.project?.(context.args, translate, locale),
        }}
      />
    );
  };
}
