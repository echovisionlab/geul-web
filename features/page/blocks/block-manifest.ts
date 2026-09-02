import { artistListSchema } from './artist-grid/schema';
import { authorListSchema } from './author-list/schema';
import { clientMarqueeSchema } from './client-marquee/schema';
import { columnsSchema } from './columns/schema';
import { externalVideoSchema } from './external-video/schema';
import { formSchema } from './form/schema';
import { immersiveSceneSchema } from './immersive-scene/schema';
import { labelListSchema } from './label-list/schema';
import { labelMarqueeSchema } from './label-marquee/schema';
import { mapSchema } from './map/schema';
import { postListSchema } from './post-list/schema';
import { postMapSchema } from './post-map/schema';
import { postTableSchema } from './post-table/schema';
import { programEventListSchema } from './program-event-list/schema';
import { releaseListSchema } from './releases-gallery/schema';
import { richTextSchema } from './rich-text/schema';
import { textMarqueeSchema } from './text-marquee/schema';
import { workMapSchema } from './work-map/schema';
import { workTableSchema } from './work-table/schema';
import { workListSchema } from './works-gallery/schema';
import { createPageBlockSectionSchema } from './section-base-schema';

function definePageBlock<TType extends string, TSchema extends z.ZodObject, TAllowNested extends boolean>(
  type: TType,
  schema: TSchema,
  allowNested: TAllowNested,
) {
  return {
    type,
    schema,
    sectionSchema: createPageBlockSectionSchema(type, schema),
    allowNested,
  } as const;
}

export const pageBlockDefinitions = [
  definePageBlock('rich-text', richTextSchema, true),
  definePageBlock('external-video', externalVideoSchema, true),
  definePageBlock('post-list', postListSchema, true),
  definePageBlock('post-table', postTableSchema, true),
  definePageBlock('post-map', postMapSchema, true),
  definePageBlock('work-map', workMapSchema, true),
  definePageBlock('work-table', workTableSchema, true),
  definePageBlock('work-list', workListSchema, true),
  definePageBlock('program-event-list', programEventListSchema, true),
  definePageBlock('release-list', releaseListSchema, true),
  definePageBlock('artist-list', artistListSchema, true),
  definePageBlock('label-list', labelListSchema, true),
  definePageBlock('text-marquee', textMarqueeSchema, true),
  definePageBlock('client-marquee', clientMarqueeSchema, true),
  definePageBlock('label-marquee', labelMarqueeSchema, true),
  definePageBlock('author-list', authorListSchema, true),
  definePageBlock('form', formSchema, true),
  definePageBlock('map', mapSchema, true),
  definePageBlock('immersive-scene', immersiveSceneSchema, false),
  definePageBlock('columns', columnsSchema, false),
] as const;

export type PageBlockDefinition = (typeof pageBlockDefinitions)[number];
export type NestablePageBlockDefinition = Extract<PageBlockDefinition, { allowNested: true }>;
type PageBlockManifest = {
  [TDefinition in PageBlockDefinition as TDefinition['type']]: TDefinition;
};

export const pageBlockManifest = Object.fromEntries(
  pageBlockDefinitions.map((definition) => [definition.type, definition]),
) as PageBlockManifest;

export function isNestablePageBlockDefinition(
  definition: PageBlockDefinition,
): definition is NestablePageBlockDefinition {
  return definition.allowNested;
}

export type PageBlockType = keyof typeof pageBlockManifest;

export function isPageBlockType(value: string): value is PageBlockType {
  return value in pageBlockManifest;
}

export function isPageBlockNestable(type: PageBlockType): boolean {
  return pageBlockManifest[type].allowNested;
}
import type { z } from 'zod';
