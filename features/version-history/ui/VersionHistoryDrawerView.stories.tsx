import { PageLoader } from '@/features/site/PageLoader';
import { useArgs, useState } from 'storybook/preview-api';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { createTranslator } from 'next-intl';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { formatLocaleCode } from '@/components/core/Typography/locale-code';
import enMessages from '@/messages/en.json';

import {
  VersionHistoryDrawerView,
  type VersionHistoryDrawerViewLabels,
  type VersionHistoryDrawerViewProps,
} from './VersionHistoryDrawerView';

type Translate = (key: string, values?: Record<string, string | number>) => string;
const sourceLocale = 'en';
function historyLabels(t: Translate, version: number): VersionHistoryDrawerViewLabels {
  return {
    title: t('common.labels.versionHistory'),
    close: t('common.actions.close'),
    loading: t('common.states.loading'),
    empty: t('versionHistory.empty'),
    restore: t('versionHistory.restore'),
    restoreTitle: t('versionHistory.restoreTitle'),
    restoreBody: t('versionHistory.restoreSameLocaleBody', { version, locale: formatLocaleCode(sourceLocale) }),
    cancel: t('common.actions.cancel'),
    loadMore: t('common.actions.continue'),
    loadFailed: t('versionHistory.loadFailed'),
    end: t('versionHistory.end'),
    retry: t('common.actions.tryAgain'),
  };
}
const labels = historyLabels(createTranslator({ locale: 'en', messages: enMessages }) as unknown as Translate, 12);

async function playLabels(localeValue: unknown, version: number) {
  const locale = normalizeLocale(typeof localeValue === 'string' ? localeValue : undefined) ?? DEFAULT_LOCALE;
  const messages = await getMessagesForLocale(locale);
  return historyLabels(createTranslator({ locale, messages }) as unknown as Translate, version);
}

const versions = [
  {
    id: 'version-12',
    version: 12,
    versionLabel: 'v12',
    title: 'Revised exhibition notes',
    sourceLocaleLabel: 'English',
    createdAt: '2026-07-20T10:32:00Z',
    createdAtLabel: '8 minutes ago',
    createdAtTooltip: 'July 20, 2026 at 10:32',
    contributorLabel: 'by Mina Park and June Han',
  },
  {
    id: 'version-11',
    version: 11,
    versionLabel: 'v11',
    title: 'Untitled',
    sourceLocaleLabel: 'English',
    createdAt: '2026-07-19T14:10:00Z',
    createdAtLabel: 'yesterday',
    createdAtTooltip: 'July 19, 2026 at 14:10',
    contributorLabel: 'System or earlier version',
  },
];

const longHistory = (start: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    ...versions[0]!,
    id: `version-${start - index}`,
    version: start - index,
    versionLabel: `v${start - index}`,
    title: `Exhibition notes ${start - index}`,
    createdAt: new Date(Date.parse(versions[0]!.createdAt) - (60 - start + index) * 3_600_000).toISOString(),
  }));

function formatFixtureRelativeTime(createdAt: string, locale: string) {
  const minutes = (Date.parse(createdAt) - Date.parse('2026-07-20T10:40:00Z')) / 60_000;
  const unit = Math.abs(minutes) >= 1_440 ? 'day' : Math.abs(minutes) >= 60 ? 'hour' : 'minute';
  const value = Math.trunc(minutes / (unit === 'day' ? 1_440 : unit === 'hour' ? 60 : 1));
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}

const meta = {
  title: 'Feature/Version History/VersionHistoryDrawerView',
  component: VersionHistoryDrawerView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    const [restored, setRestored] = useState('');
    return (
      <>
        <Button onClick={() => updateArgs({ opened: true })}>{args.labels.title}</Button>
        {restored && <TextInput label={args.labels.title} value={restored} readOnly />}
        <VersionHistoryDrawerView
          {...args}
          loadingSurface={<PageLoader placement="flow" />}
          onClose={() => updateArgs({ opened: false })}
          onSelectVersion={(selectedVersionId) => updateArgs({ selectedVersionId, restoreConfirmationOpened: true })}
          onCloseRestoreConfirmation={() => updateArgs({ restoreConfirmationOpened: false })}
          onRestore={() => {
            setRestored(args.versions.find((version) => version.id === args.selectedVersionId)?.title ?? '');
            updateArgs({ restoreConfirmationOpened: false, opened: false });
          }}
          onRetry={async () => updateArgs({ error: null, versions })}
          pagination={{
            ...args.pagination,
            onLoad: async () => {
              await args.pagination.onLoad();
              const lastVersion = args.versions.at(-1)?.version ?? 61;
              updateArgs({
                error: null,
                versions: [...args.versions, ...longHistory(lastVersion - 1, Math.min(20, lastVersion - 1))],
                pagination: {
                  ...args.pagination,
                  error: null,
                  nextPage: lastVersion > 21 ? (args.pagination.nextPage ?? 1) + 1 : null,
                },
              });
            },
          }}
        />
      </>
    );
  },
  decorators: [
    withFeatureLabels({
      project: (args, t, locale) => ({
        labels: historyLabels(
          t,
          (args.versions as typeof versions).find((version) => version.id === args.selectedVersionId)?.version ??
            (args.versions as typeof versions)[0]?.version ??
            12,
        ),
        error: args.error ? t('versionHistory.loadFailed') : null,
        pagination: {
          ...(args.pagination as VersionHistoryDrawerViewProps['pagination']),
          error: (args.pagination as VersionHistoryDrawerViewProps['pagination']).error
            ? t('versionHistory.loadFailed')
            : null,
        },
        versions: (args.versions as typeof versions).map((version, index) => ({
          ...version,
          title: index === 1 ? t('common.states.untitledPlain') : version.title,
          sourceLocaleLabel: `${t('common.labels.locale')}: ${formatLocaleCode(sourceLocale)}`,
          createdAtLabel: formatFixtureRelativeTime(version.createdAt, locale),
          createdAtTooltip: new Intl.DateTimeFormat(locale, {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: 'UTC',
          }).format(new Date(version.createdAt)),
          contributorLabel:
            index === 0
              ? t('versionHistory.by', { contributors: 'Mina Park, June Han' })
              : t('versionHistory.systemOrLegacy'),
        })),
      }),
    }),
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    loadingSurface: <PageLoader placement="flow" />,
    opened: true,
    onClose: () => {},
    versions,
    labels,
    loading: false,
    error: null,
    onRetry: async () => {},
    pagination: {
      contextKey: 'story:history',
      nextPage: null,
      loading: false,
      error: null,
      onLoad: async () => {},
    },
    restoring: false,
    canRestore: true,
    selectedVersionId: null,
    restoreConfirmationOpened: false,
    onSelectVersion: () => {},
    onCloseRestoreConfirmation: () => {},
    onRestore: () => {},
  },
} satisfies Meta<typeof VersionHistoryDrawerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement, args, globals }) => {
    const localized = await playLabels(globals.locale, args.versions[0]!.version);
    const body = within(canvasElement.ownerDocument.body);
    const history = await body.findByRole('dialog', { name: localized.title });
    const rows = within(history).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const restore = within(rows[0]!).getByRole('button', { name: localized.restore });
    expect(rows[0]!.lastElementChild).toBe(restore);
    await userEvent.click(restore);
    const confirmation = await body.findByRole('dialog', { name: localized.restoreTitle });
    expect(confirmation).toHaveTextContent(localized.restoreBody);
    await userEvent.click(within(confirmation).getByRole('button', { name: localized.cancel }));
    await waitFor(() => expect(body.queryByRole('dialog', { name: localized.restoreTitle })).toBeNull());
    await waitFor(() => expect(restore).toHaveFocus());
  },
};

export const Empty: Story = {
  args: { versions: [] },
};

export const Loading: Story = {
  args: { loading: true, versions: [] },
};

export const RestoreLocked: Story = {
  args: { canRestore: false },
};

export const RestoreConfirmation: Story = {
  args: {
    selectedVersionId: 'version-12',
    restoreConfirmationOpened: true,
  },
};

export const Restoring: Story = {
  args: {
    selectedVersionId: 'version-12',
    restoreConfirmationOpened: true,
    restoring: true,
  },
};

export const InitialError: Story = {
  args: { versions: [], error: labels.loadFailed },
};

export const AutomaticContinuation: Story = {
  args: {
    versions: longHistory(60, 20),
    pagination: { contextKey: 'story:automatic', nextPage: 2, loading: false, error: null, onLoad: async () => {} },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Scroll to the end to append the next fixture page through the actual Core loader. The service response is simulated; production uses the numeric 20-row version-history query.',
      },
    },
  },
  play: async ({ canvasElement, args, globals }) => {
    const localized = await playLabels(globals.locale, args.versions[0]!.version);
    const body = within(canvasElement.ownerDocument.body);
    const history = await body.findByRole('dialog', { name: localized.title });
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(20));
    history.querySelector('[data-near-end-loader]')!.scrollIntoView({ block: 'end' });
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(40));
    history.querySelector('[data-near-end-loader]')!.scrollIntoView({ block: 'end' });
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(60));
    expect(within(history).getByText(localized.end)).toBeInTheDocument();
    expect(history.querySelector('[data-near-end-loader] button')).toBeNull();
  },
};

export const LoadingMore: Story = {
  args: {
    versions: longHistory(60, 20),
    pagination: { contextKey: 'story:pending', nextPage: 2, loading: true, error: null, onLoad: async () => {} },
  },
};

export const PageError: Story = {
  args: {
    versions: longHistory(60, 20),
    pagination: {
      contextKey: 'story:error',
      nextPage: 2,
      loading: false,
      error: labels.loadFailed,
      onLoad: async () => {},
    },
  },
};
