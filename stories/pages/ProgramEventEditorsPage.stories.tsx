import { expect, userEvent, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { useRef, useState } from 'react';
import { createTranslator, useTranslations } from 'next-intl';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import {
  ProgramEventEditorView,
  type ProgramEventEditorViewModel,
} from '@/features/program-event/ProgramEventEditor/ProgramEventEditor';
import {
  ProgramEventSeriesEditorView,
  type ProgramEventSeriesEditorViewModel,
} from '@/features/program-event/ProgramEventSeriesEditor/ProgramEventSeriesEditor';
import { PageLoader } from '@/features/site/PageLoader';
import { DocumentEditorFrame, editorPageParameters, editorStateArgTypes } from './fixtures/DocumentEditorFrame';
import { useDocumentEditor, noop, pending, mutation, type EditorPreviewState } from './fixtures/use-document-editor';
function EventPreview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('program-event', state),
    tProgramEventAdmin = useTranslations('programEventAdmin'),
    tCommonEntities = useTranslations('common.entities');
  const [status, setStatus] = useState<ProgramEventEditorViewModel['status']>('draft');
  const [posterMedia, setPosterMedia] = useState<ProgramEventEditorViewModel['posterMedia']>([]);
  const [typeSearch, setTypeSearch] = useState(''),
    [typeId, setTypeId] = useState('concert'),
    [dropdownOpened, setDropdown] = useState(false);
  const [seriesId, setSeriesId] = useState<string | null>(null),
    [seriesOrder, setSeriesOrder] = useState<number | null>(null);
  const [timezone, setTimezone] = useState('Asia/Seoul'),
    [startsAt, setStartsAt] = useState<Date | null>(new Date('2026-10-11T10:00:00Z')),
    [endsAt, setEndsAt] = useState<Date | null>(new Date('2026-10-11T13:00:00Z')),
    [allDay, setAllDay] = useState(false);
  const [locationMode, setLocationMode] = useState<ProgramEventEditorViewModel['locationMode']>('tba'),
    [mapPlaceId, setMapPlaceId] = useState<string | null>(null),
    [createPlaceInitialName, setCreatePlaceInitialName] = useState('');
  const [ticketUrl, setTicketUrl] = useState(''),
    [streamUrl, setStreamUrl] = useState(''),
    [externalUrl, setExternalUrl] = useState('');
  const [artistIds, setArtistIds] = useState<string[]>([]),
    [labelIds, setLabelIds] = useState<string[]>([]),
    [clientIds, setClientIds] = useState<string[]>([]);
  const relationBaselineRef = useRef<ProgramEventEditorViewModel['relationBaselineRef']['current']>({
    artists: [],
    labels: [],
    clients: [],
  });
  if (!local.room || !local.session) {
    return <PageLoader />;
  }
  const types = [{ id: 'concert', name: 'Concert', requiresPlace: false, requiresStreamUrl: false }];
  const model: ProgramEventEditorViewModel = {
    blockRoom: {
      provider: local.room.provider,
      protocol: null,
      isConnected: local.connected,
      isSynced: local.connected,
      controller: local.room.controller,
    },
    eventId: 'local-program-event',
    displayedTitle: local.title,
    canEditTitle: local.canEdit,
    handleTitleChange: local.setTitle,
    tCommon: local.tCommon,
    status,
    lifecycle: {
      statusOptions: [
        {
          value: 'draft',
          label: local.tCommon('statuses.draft'),
          actionLabel: local.tCommon('actions.unpublish'),
          tone: 'neutral',
        },
        {
          value: 'published',
          label: local.tCommon('statuses.published'),
          actionLabel: local.tCommon('actions.publish'),
          tone: 'positive',
        },
      ],
      canDelete: local.canEdit,
      isStatusChanging: false,
      deleteEvent: pending,
    },
    handleBack: async () => goBackPreview(),
    handleStatusChange: async (value) => setStatus(value),
    handleDelete: local.remove,
    activeEditLocale: local.activeEditLocale,
    posterMedia,
    canEditNeutral: local.canEdit,
    setPosterMedia,
    displayedSummary: local.summary,
    routePath: `/events/${local.slug}`,
    ...local.site,
    primaryPosterUrl: null,
    slug: local.slug,
    setSlug: local.setSlug,
    queueNeutralPatch: noop,
    shouldUseLocaleDocument: true,
    canEditCurrentLocale: local.canEdit,
    canEditTranslationSource: local.canEdit && local.locale === 'ko',
    handleSummaryChange: local.setSummary,
    canEditEvent: local.canEdit,
    tProgramEventAdmin,
    tCommonLabels: local.tCommonLabels,
    typeId,
    typeCombobox: { dropdownOpened, openDropdown: () => setDropdown(true), closeDropdown: () => setDropdown(false) },
    typeSearch,
    selectedType: types.find((type) => type.id === typeId) ?? null,
    setTypeSearch,
    tCommonEntities,
    createType: pending,
    handleTypeSelect: (value) => {
      setTypeId(value);
      setDropdown(false);
    },
    filteredTypes: types.filter((type) => type.name.toLowerCase().includes(typeSearch.toLowerCase())),
    canCreateType: false,
    seriesSelectData: [{ value: 'local-series', label: 'Night Signals' }],
    seriesId,
    setSeriesId,
    seriesOrder,
    setSeriesOrder,
    timezoneSelectData: [
      { value: 'Asia/Seoul', label: 'Asia/Seoul' },
      { value: 'UTC', label: 'UTC' },
    ],
    timezone,
    setTimezone,
    startsAtInput: startsAt?.toISOString() ?? null,
    setStartsAt,
    endsAtInput: endsAt?.toISOString() ?? null,
    setEndsAt,
    allDay,
    setAllDay,
    locationMode,
    setLocationMode,
    showLocationSelector: locationMode === 'map_place' || locationMode === 'hybrid',
    mapPlaceId,
    setMapPlaceId,
    setCreatePlaceInitialName,
    openCreatePlace: () => local.setCreatePlaceOpened(true),
    ticketUrl,
    setTicketUrl,
    streamUrl,
    setStreamUrl,
    externalUrl,
    setExternalUrl,
    artistSelectData: [{ value: 'artist-a', label: 'Night Signals' }],
    artistIds,
    setArtistIds,
    relationBaselineRef,
    labelSelectData: [],
    labelIds,
    setLabelIds,
    clientSelectData: [],
    clientIds,
    setClientIds,
    initialCredits: [],
    editorReady: true,
    roomLocale: local.locale,
    userName: local.identity.userName,
    createPlaceOpened: local.createPlaceOpened,
    closeCreatePlace: () => local.setCreatePlaceOpened(false),
    trackAuxiliaryWrite: noop,
    createPlace: {
      isPending: false,
      mutateAsync: async () => ({ error: 'Place creation requires the application backend' }),
    },
    createPlaceInitialName,
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <ProgramEventEditorView model={model} />
    </DocumentEditorFrame>
  );
}
function SeriesPreview({ state = 'ready' }: { state?: EditorPreviewState }) {
  const local = useDocumentEditor('post', state),
    tCommonEntities = useTranslations('common.entities');
  const [status, setStatus] = useState<ProgramEventSeriesEditorViewModel['status']>('draft'),
    [description, setDescription] = useState('음악과 공간을 이어가는 공연 시리즈'),
    [posterUrl, setPosterUrl] = useState<string | null>(null);
  const model: ProgramEventSeriesEditorViewModel = {
    title: local.title,
    setTitle: local.setTitle,
    debouncedUpdate: noop,
    saveState: local.connected ? 'saved' : 'offline',
    tCommon: local.tCommon,
    status,
    statusOptions: [
      {
        value: 'draft',
        label: local.tCommon('statuses.draft'),
        actionLabel: local.tCommon('actions.unpublish'),
        tone: 'neutral',
      },
      {
        value: 'published',
        label: local.tCommon('statuses.published'),
        actionLabel: local.tCommon('actions.publish'),
        tone: 'positive',
      },
    ],
    handleBack: async () => goBackPreview(),
    handleStatusChange: async (value) => setStatus(value),
    handleDelete: local.remove,
    updateSeriesStatus: pending,
    deleteSeries: pending,
    posterUrl,
    isUploading: false,
    uploadProgress: 0,
    removePoster: { isPending: false, mutate: () => setPosterUrl(null) },
    handleUpload: async (blob) => {
      setPosterUrl(URL.createObjectURL(blob));
    },
    tCommonEntities,
    summary: local.summary,
    routePath: `/event-series/${local.slug}`,
    ...local.site,
    seriesId: 'local-event-series',
    slug: local.slug,
    setSlug: local.setSlug,
    updateSeries: mutation,
    setSummary: local.setSummary,
    description,
    setDescription,
  };
  return (
    <DocumentEditorFrame client={local.client} completed={local.deleted}>
      <ProgramEventSeriesEditorView model={model} />
    </DocumentEditorFrame>
  );
}
const meta = {
  argTypes: editorStateArgTypes,
  title: 'Pages/Editors/Program Events',
  component: EventPreview,
  args: { state: 'ready' },
  parameters: editorPageParameters,
} satisfies Meta<typeof EventPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Event: Story = {};
export const EventDisconnected: Story = { args: { state: 'disconnected' } };
export const EventReadOnly: Story = { args: { state: 'readonly' } };
export const Series: Story = { render: (args) => <SeriesPreview {...args} /> };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardTitleAuthoring: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const canvas = within(canvasElement);
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'common' });
    const title = await canvas.findByRole('textbox', { name: t('labels.title') });
    await step('The named title remains reachable and editable by keyboard', async () => {
      for (let index = 0; index < 60 && canvasElement.ownerDocument.activeElement !== title; index += 1) {
        await userEvent.tab();
      }
      await expect(title).toHaveFocus();
      const before = (title as HTMLInputElement).value;
      await userEvent.keyboard('{End} accessible draft');
      await expect(title).toHaveValue(`${before} accessible draft`);
      await expect(title).toHaveAccessibleName(t('labels.title'));
      await userEvent.tab();
      await expect(title).not.toHaveFocus();
      await userEvent.tab({ shift: true });
      await expect(title).toHaveFocus();
    });
  },
};
