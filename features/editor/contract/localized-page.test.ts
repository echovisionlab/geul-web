import { fromJson } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { materializeLocalizedPageSections } from './localized-page';

const sectionId = '2f42ef7b-0220-5b4c-ad59-d6c6e4712b4d';
const unitId = '38ad7de4-2ac6-5b73-b31a-a0d416f2d0c5';
const sourceFileId = '1620bf08-8b57-41f3-a071-abe628f7ff6a';
const optimizedFileId = '60d8271d-c047-46e2-a85f-e7f54bc2e03c';

describe('materializeLocalizedPageSections', () => {
  it('flattens typed immersive unit props and active File identities for the legacy renderer', () => {
    const document = fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'en',
      base: {
        nodes: [
          {
            section: {
              id: sectionId,
              immersiveScene: {
                props: { playback: 'PLAYBACK_AUTOPLAY', backgroundEnabled: false },
                units: [
                  {
                    id: unitId,
                    props: {
                      mesh: 'MESH_CONE',
                      meshSource: 'MESH_SOURCE_FILE',
                      meshFile: { activeFileId: sourceFileId },
                      meshOptimizationSourceFile: { activeFileId: sourceFileId },
                      meshOptimizationFile: { activeFileId: optimizedFileId },
                      scale: 0.3,
                      color: '#000000',
                      textureSource: 'TEXTURE_SOURCE_IMAGE',
                    },
                  },
                ],
              },
            },
            placement: { index: 0 },
          },
        ],
      },
      localeOverlay: {
        locale: 'en',
        sections: [
          {
            sectionId,
            immersiveScene: {
              props: {},
              units: [
                {
                  unitId,
                  props: { title: 'Symbols', text: 'This is an immersive scene.' },
                },
              ],
            },
          },
        ],
      },
    });

    const [section] = materializeLocalizedPageSections(document);
    const units = JSON.parse(String(section.props.unitsJson)) as Array<Record<string, unknown>>;
    const copy = JSON.parse(String(section.props.copyJson)) as Array<Record<string, unknown>>;

    expect(section).toMatchObject({ id: sectionId, kind: 'immersive-scene' });
    expect(units).toEqual([
      {
        id: unitId,
        mesh: 'cone',
        meshSource: 'file',
        meshFileId: sourceFileId,
        meshOptimizationSourceFileId: sourceFileId,
        meshOptimizationFileId: optimizedFileId,
        scale: '0.3',
        color: '#000000',
        textureSource: 'image',
      },
    ]);
    expect(copy).toEqual([{ id: unitId, title: 'Symbols', text: 'This is an immersive scene.' }]);
  });
});
