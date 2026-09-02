/**
 * Page Block Registry
 *
 * Central registry for all page block types.
 * Each block is a self-contained module with its own schema, editor, and view.
 */

import {
  IconArticle,
  IconBriefcase,
  IconBuildingStore,
  IconCalendarEvent,
  IconColumns,
  IconFileText,
  IconForms,
  IconMap,
  IconMapPin,
  IconSparkles,
  IconTable,
  IconUsers,
  IconVideo,
  IconVinyl,
} from '@tabler/icons-react';
import { ArtistListCanvasPreview, ArtistListEditor, ArtistListSettingsEditor } from './artist-grid/Editor';
import { parseArtistListProps, type ArtistListProps } from './artist-grid/schema';
import { ArtistListView } from './artist-grid/View';
import { AuthorListCanvasPreview, AuthorListEditor, AuthorListSettingsEditor } from './author-list/Editor';
import { parseAuthorListProps, type AuthorListProps } from './author-list/schema';
import { AuthorListView } from './author-list/View';
import { ClientMarqueeCanvasPreview, ClientMarqueeEditor, ClientMarqueeSettingsEditor } from './client-marquee/Editor';
import { parseClientMarqueeProps, type ClientMarqueeProps } from './client-marquee/schema';
import { ClientMarqueeViewServer } from './client-marquee/ViewServer';
import { ColumnsEditor } from './columns/Editor';
import { parseColumnsProps, type ColumnsProps } from './columns/schema';
import { ColumnsView } from './columns/View';
import { FormCanvasPreview, FormEditor, FormSettingsEditor } from './form/Editor';
import { parseFormProps, type FormProps } from './form/schema';
import { FormView } from './form/View';
import { ExternalVideoCanvasPreview } from './external-video/CanvasPreview';
import { ExternalVideoEditor, ExternalVideoSettingsEditor } from './external-video/Editor';
import { parseExternalVideoProps, type ExternalVideoProps } from './external-video/schema';
import { PageExternalVideoView } from './external-video/View';
import {
  ImmersiveSceneCanvasPreview,
  ImmersiveSceneEditor,
  ImmersiveSceneSettingsEditor,
  ImmersiveSceneSettingsSurface,
} from './immersive-scene/Editor';
import { parseImmersiveSceneProps, type ImmersiveSceneProps } from './immersive-scene/schema';
import { ImmersiveSceneView } from './immersive-scene/View';
import { LabelListCanvasPreview, LabelListEditor, LabelListSettingsEditor } from './label-list/Editor';
import { parseLabelListProps, type LabelListProps } from './label-list/schema';
import { LabelListView } from './label-list/View';
import { LabelMarqueeCanvasPreview, LabelMarqueeEditor, LabelMarqueeSettingsEditor } from './label-marquee/Editor';
import { parseLabelMarqueeProps, type LabelMarqueeProps } from './label-marquee/schema';
import { LabelMarqueeViewServer } from './label-marquee/ViewServer';
import { MapCanvasPreview, MapEditor, MapSettingsEditor } from './map/Editor';
import { parseMapProps, type MapProps } from './map/schema';
import { MapView } from './map/View';
import { PostListCanvasPreview, PostListEditor, PostListSettingsEditor } from './post-list/Editor';
import { parsePostListProps, type PostListProps } from './post-list/schema';
import { PostListView } from './post-list/View';
import { PostMapCanvasPreview, PostMapEditor, PostMapSettingsEditor } from './post-map/Editor';
import { parsePostMapProps, type PostMapProps } from './post-map/schema';
import { PostMapView } from './post-map/View';
import { PostTableCanvasPreview, PostTableEditor, PostTableSettingsEditor } from './post-table/Editor';
import { parsePostTableProps, type PostTableProps } from './post-table/schema';
import { PostTableView } from './post-table/View';
import {
  ProgramEventListCanvasPreview,
  ProgramEventListEditor,
  ProgramEventListSettingsEditor,
} from './program-event-list/Editor';
import { parseProgramEventListProps, type ProgramEventListProps } from './program-event-list/schema';
import { ProgramEventListView } from './program-event-list/View';
import { ReleaseListCanvasPreview, ReleaseListEditor, ReleaseListSettingsEditor } from './releases-gallery/Editor';
import { parseReleaseListProps, type ReleaseListProps } from './releases-gallery/schema';
import { ReleaseListView } from './releases-gallery/View';
import { RichTextEditor } from './rich-text/Editor';
import { parseRichTextProps, type RichTextProps } from './rich-text/schema';
import { RichTextView } from './rich-text/View';
import { TextMarqueeCanvasPreview, TextMarqueeEditor, TextMarqueeSettingsEditor } from './text-marquee/Editor';
import { parseTextMarqueeProps, type TextMarqueeProps } from './text-marquee/schema';
import { TextMarqueeView } from './text-marquee/View';
import type { BlockDefinition, BlockRegistry } from './types';
import { WorkMapCanvasPreview, WorkMapEditor, WorkMapSettingsEditor } from './work-map/Editor';
import { parseWorkMapProps, type WorkMapProps } from './work-map/schema';
import { WorkMapView } from './work-map/View';
import { WorkTableCanvasPreview, WorkTableEditor, WorkTableSettingsEditor } from './work-table/Editor';
import { parseWorkTableProps, type WorkTableProps } from './work-table/schema';
import { WorkTableView } from './work-table/View';
import { WorkListCanvasPreview, WorkListEditor, WorkListSettingsEditor } from './works-gallery/Editor';
import { parseWorkListProps, type WorkListProps } from './works-gallery/schema';
import { WorkListView } from './works-gallery/View';
import { isPageBlockNestable, pageBlockManifest } from './block-manifest';

const postListBlock: BlockDefinition<PostListProps> = {
  type: 'post-list',
  label: 'Post List',
  icon: IconArticle,
  category: 'data',
  schema: pageBlockManifest['post-list'].schema,
  parse: parsePostListProps,
  Editor: PostListEditor,
  CanvasPreview: PostListCanvasPreview,
  SettingsEditor: PostListSettingsEditor,
  View: PostListView,
  allowNested: isPageBlockNestable('post-list'),
};

const postMapBlock: BlockDefinition<PostMapProps> = {
  type: 'post-map',
  label: 'Post Map',
  icon: IconMapPin,
  category: 'data',
  schema: pageBlockManifest['post-map'].schema,
  parse: parsePostMapProps,
  Editor: PostMapEditor,
  CanvasPreview: PostMapCanvasPreview,
  SettingsEditor: PostMapSettingsEditor,
  View: PostMapView,
  allowNested: isPageBlockNestable('post-map'),
};

const postTableBlock: BlockDefinition<PostTableProps> = {
  type: 'post-table',
  label: 'Post Table',
  icon: IconTable,
  category: 'data',
  schema: pageBlockManifest['post-table'].schema,
  parse: parsePostTableProps,
  Editor: PostTableEditor,
  CanvasPreview: PostTableCanvasPreview,
  SettingsEditor: PostTableSettingsEditor,
  View: PostTableView,
  allowNested: isPageBlockNestable('post-table'),
};

const workMapBlock: BlockDefinition<WorkMapProps> = {
  type: 'work-map',
  label: 'Work Map',
  icon: IconMapPin,
  category: 'data',
  schema: pageBlockManifest['work-map'].schema,
  parse: parseWorkMapProps,
  Editor: WorkMapEditor,
  CanvasPreview: WorkMapCanvasPreview,
  SettingsEditor: WorkMapSettingsEditor,
  View: WorkMapView,
  allowNested: isPageBlockNestable('work-map'),
};

const workTableBlock: BlockDefinition<WorkTableProps> = {
  type: 'work-table',
  label: 'Work Table',
  icon: IconTable,
  category: 'data',
  schema: pageBlockManifest['work-table'].schema,
  parse: parseWorkTableProps,
  Editor: WorkTableEditor,
  CanvasPreview: WorkTableCanvasPreview,
  SettingsEditor: WorkTableSettingsEditor,
  View: WorkTableView,
  allowNested: isPageBlockNestable('work-table'),
};

const authorListBlock: BlockDefinition<AuthorListProps> = {
  type: 'author-list',
  label: 'Author List',
  icon: IconUsers,
  category: 'data',
  schema: pageBlockManifest['author-list'].schema,
  parse: parseAuthorListProps,
  Editor: AuthorListEditor,
  CanvasPreview: AuthorListCanvasPreview,
  SettingsEditor: AuthorListSettingsEditor,
  View: AuthorListView,
  allowNested: isPageBlockNestable('author-list'),
};

const workListBlock: BlockDefinition<WorkListProps> = {
  type: 'work-list',
  label: 'Work List',
  icon: IconBriefcase,
  category: 'data',
  schema: pageBlockManifest['work-list'].schema,
  parse: parseWorkListProps,
  Editor: WorkListEditor,
  CanvasPreview: WorkListCanvasPreview,
  SettingsEditor: WorkListSettingsEditor,
  View: WorkListView,
  allowNested: isPageBlockNestable('work-list'),
};

const programEventListBlock: BlockDefinition<ProgramEventListProps> = {
  type: 'program-event-list',
  label: 'Event List',
  icon: IconCalendarEvent,
  category: 'data',
  schema: pageBlockManifest['program-event-list'].schema,
  parse: parseProgramEventListProps,
  Editor: ProgramEventListEditor,
  CanvasPreview: ProgramEventListCanvasPreview,
  SettingsEditor: ProgramEventListSettingsEditor,
  View: ProgramEventListView,
  allowNested: isPageBlockNestable('program-event-list'),
};

const releaseListBlock: BlockDefinition<ReleaseListProps> = {
  type: 'release-list',
  label: 'Release List',
  icon: IconVinyl,
  category: 'data',
  schema: pageBlockManifest['release-list'].schema,
  parse: parseReleaseListProps,
  Editor: ReleaseListEditor,
  CanvasPreview: ReleaseListCanvasPreview,
  SettingsEditor: ReleaseListSettingsEditor,
  View: ReleaseListView,
  allowNested: isPageBlockNestable('release-list'),
};

const artistListBlock: BlockDefinition<ArtistListProps> = {
  type: 'artist-list',
  label: 'Artist List',
  icon: IconUsers,
  category: 'data',
  schema: pageBlockManifest['artist-list'].schema,
  parse: parseArtistListProps,
  Editor: ArtistListEditor,
  CanvasPreview: ArtistListCanvasPreview,
  SettingsEditor: ArtistListSettingsEditor,
  View: ArtistListView,
  allowNested: isPageBlockNestable('artist-list'),
};

const labelListBlock: BlockDefinition<LabelListProps> = {
  type: 'label-list',
  label: 'Label List',
  icon: IconBuildingStore,
  category: 'data',
  schema: pageBlockManifest['label-list'].schema,
  parse: parseLabelListProps,
  Editor: LabelListEditor,
  CanvasPreview: LabelListCanvasPreview,
  SettingsEditor: LabelListSettingsEditor,
  View: LabelListView,
  allowNested: isPageBlockNestable('label-list'),
};

const textMarqueeBlock: BlockDefinition<TextMarqueeProps> = {
  type: 'text-marquee',
  label: 'Text Marquee',
  icon: IconFileText,
  category: 'content',
  schema: pageBlockManifest['text-marquee'].schema,
  parse: parseTextMarqueeProps,
  Editor: TextMarqueeEditor,
  CanvasPreview: TextMarqueeCanvasPreview,
  SettingsEditor: TextMarqueeSettingsEditor,
  View: TextMarqueeView,
  allowNested: isPageBlockNestable('text-marquee'),
};

const clientMarqueeBlock: BlockDefinition<ClientMarqueeProps> = {
  type: 'client-marquee',
  label: 'Client Marquee',
  icon: IconBriefcase,
  category: 'data',
  schema: pageBlockManifest['client-marquee'].schema,
  parse: parseClientMarqueeProps,
  Editor: ClientMarqueeEditor,
  CanvasPreview: ClientMarqueeCanvasPreview,
  SettingsEditor: ClientMarqueeSettingsEditor,
  View: ClientMarqueeViewServer,
  allowNested: isPageBlockNestable('client-marquee'),
};

const labelMarqueeBlock: BlockDefinition<LabelMarqueeProps> = {
  type: 'label-marquee',
  label: 'Label Marquee',
  icon: IconBuildingStore,
  category: 'data',
  schema: pageBlockManifest['label-marquee'].schema,
  parse: parseLabelMarqueeProps,
  Editor: LabelMarqueeEditor,
  CanvasPreview: LabelMarqueeCanvasPreview,
  SettingsEditor: LabelMarqueeSettingsEditor,
  View: LabelMarqueeViewServer,
  allowNested: isPageBlockNestable('label-marquee'),
};

const formBlock: BlockDefinition<FormProps> = {
  type: 'form',
  label: 'Form',
  icon: IconForms,
  category: 'data',
  schema: pageBlockManifest.form.schema,
  parse: parseFormProps,
  Editor: FormEditor,
  CanvasPreview: FormCanvasPreview,
  SettingsEditor: FormSettingsEditor,
  View: FormView,
  allowNested: isPageBlockNestable('form'),
};

const richTextBlock: BlockDefinition<RichTextProps> = {
  type: 'rich-text',
  label: 'Rich Text',
  icon: IconFileText,
  category: 'content',
  schema: pageBlockManifest['rich-text'].schema,
  parse: parseRichTextProps,
  Editor: RichTextEditor,
  View: RichTextView,
  allowNested: isPageBlockNestable('rich-text'),
};

const externalVideoBlock: BlockDefinition<ExternalVideoProps> = {
  type: 'external-video',
  label: 'External Video',
  icon: IconVideo,
  category: 'content',
  schema: pageBlockManifest['external-video'].schema,
  parse: parseExternalVideoProps,
  Editor: ExternalVideoEditor,
  CanvasPreview: ExternalVideoCanvasPreview,
  SettingsEditor: ExternalVideoSettingsEditor,
  View: PageExternalVideoView,
  allowNested: isPageBlockNestable('external-video'),
};

const columnsBlock: BlockDefinition<ColumnsProps> = {
  type: 'columns',
  label: 'Columns',
  icon: IconColumns,
  category: 'layout',
  schema: pageBlockManifest.columns.schema,
  parse: parseColumnsProps,
  Editor: ColumnsEditor,
  View: ColumnsView,
  allowNested: isPageBlockNestable('columns'),
};

const mapBlock: BlockDefinition<MapProps> = {
  type: 'map',
  label: 'Map',
  icon: IconMap,
  category: 'content',
  schema: pageBlockManifest.map.schema,
  parse: parseMapProps,
  Editor: MapEditor,
  CanvasPreview: MapCanvasPreview,
  SettingsEditor: MapSettingsEditor,
  View: MapView,
  allowNested: isPageBlockNestable('map'),
};

const immersiveSceneBlock: BlockDefinition<ImmersiveSceneProps> = {
  type: 'immersive-scene',
  label: 'Immersive Scene',
  icon: IconSparkles,
  category: 'content',
  schema: pageBlockManifest['immersive-scene'].schema,
  parse: parseImmersiveSceneProps,
  Editor: ImmersiveSceneEditor,
  CanvasPreview: ImmersiveSceneCanvasPreview,
  SettingsEditor: ImmersiveSceneSettingsEditor,
  SettingsSurface: ImmersiveSceneSettingsSurface,
  View: ImmersiveSceneView,
  allowNested: isPageBlockNestable('immersive-scene'),
};

// ============================================================================
// Block Registry
// ============================================================================

export const pageBlockRegistry: BlockRegistry = {
  'post-list': postListBlock,
  'post-table': postTableBlock,
  'post-map': postMapBlock,
  'work-map': workMapBlock,
  'work-table': workTableBlock,
  'work-list': workListBlock,
  'program-event-list': programEventListBlock,
  'release-list': releaseListBlock,
  'artist-list': artistListBlock,
  'label-list': labelListBlock,
  'text-marquee': textMarqueeBlock,
  'client-marquee': clientMarqueeBlock,
  'label-marquee': labelMarqueeBlock,
  'author-list': authorListBlock,
  form: formBlock,
  'rich-text': richTextBlock,
  'external-video': externalVideoBlock,
  columns: columnsBlock,
  map: mapBlock,
  'immersive-scene': immersiveSceneBlock,
};

// ============================================================================
// Registry Helpers
// ============================================================================

/**
 * Get a block definition by type.
 */
function getBlock(type: string): BlockDefinition<unknown> | undefined {
  return pageBlockRegistry[type];
}

export function getBlockDefinition(type: string): BlockDefinition<unknown> | undefined {
  return getBlock(type);
}

/**
 * Get the Editor component for a block type.
 */
export function getBlockEditor(type: string) {
  return getBlock(type)?.Editor;
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './constants';
