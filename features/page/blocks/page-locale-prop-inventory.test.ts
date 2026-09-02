import { PAGE_LOCALE_SECTION_PROP_KEYS } from '@echovisionlab/geul-common/collaboration/page';
import { describe, expect, it } from 'vitest';
import { artistListSchema } from '@/features/page/blocks/artist-grid/schema';
import { authorListSchema } from '@/features/page/blocks/author-list/schema';
import { clientMarqueeSchema } from '@/features/page/blocks/client-marquee/schema';
import { columnsSchema } from '@/features/page/blocks/columns/schema';
import { externalVideoSchema } from '@/features/page/blocks/external-video/schema';
import { formSchema } from '@/features/page/blocks/form/schema';
import { immersiveSceneSchema } from '@/features/page/blocks/immersive-scene/schema';
import { labelListSchema } from '@/features/page/blocks/label-list/schema';
import { labelMarqueeSchema } from '@/features/page/blocks/label-marquee/schema';
import { mapSchema } from '@/features/page/blocks/map/schema';
import { postListSchema } from '@/features/page/blocks/post-list/schema';
import { postMapSchema } from '@/features/page/blocks/post-map/schema';
import { postTableSchema } from '@/features/page/blocks/post-table/schema';
import { programEventListSchema } from '@/features/page/blocks/program-event-list/schema';
import { releaseListSchema } from '@/features/page/blocks/releases-gallery/schema';
import { richTextSchema } from '@/features/page/blocks/rich-text/schema';
import { textMarqueeSchema } from '@/features/page/blocks/text-marquee/schema';
import { workMapSchema } from '@/features/page/blocks/work-map/schema';
import { workTableSchema } from '@/features/page/blocks/work-table/schema';
import { workListSchema } from '@/features/page/blocks/works-gallery/schema';

const SCHEMAS = {
  'artist-list': artistListSchema,
  'author-list': authorListSchema,
  'client-marquee': clientMarqueeSchema,
  'label-list': labelListSchema,
  'label-marquee': labelMarqueeSchema,
  columns: columnsSchema,
  'external-video': externalVideoSchema,
  form: formSchema,
  'immersive-scene': immersiveSceneSchema,
  map: mapSchema,
  'post-list': postListSchema,
  'post-map': postMapSchema,
  'post-table': postTableSchema,
  'program-event-list': programEventListSchema,
  'release-list': releaseListSchema,
  'rich-text': richTextSchema,
  'text-marquee': textMarqueeSchema,
  'work-list': workListSchema,
  'work-map': workMapSchema,
  'work-table': workTableSchema,
} as const;

describe('page shipped block locale prop inventory', () => {
  it('keeps shipped locale-scoped section props aligned with collaboration projection', () => {
    const inventory = Object.entries(SCHEMAS).flatMap(([blockType, schema]) => {
      if (!('shape' in schema)) {
        return [];
      }

      const shape = schema.shape as Record<string, unknown>;
      return PAGE_LOCALE_SECTION_PROP_KEYS.filter((key) => Object.hasOwn(shape, key)).map((key) => ({
        blockType,
        key,
      }));
    });

    expect(inventory).toEqual([
      { blockType: 'external-video', key: 'caption' },
      { blockType: 'immersive-scene', key: 'copyJson' },
      { blockType: 'map', key: 'caption' },
    ]);
  });
});
