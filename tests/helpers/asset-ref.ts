import { create } from '@bufbuild/protobuf';
import { AssetDisposition, AssetRefSchema, type AssetRef } from '@echovisionlab/geul-proto/common/media_pb.ts';

export function assetRefFixture(url: string, overrides: Partial<AssetRef> = {}): AssetRef {
  return create(AssetRefSchema, {
    assetId: '11111111-1111-4111-8111-111111111111',
    url,
    extension: 'webp',
    mimeType: 'image/webp',
    fileSize: BigInt(1),
    sha256: new Uint8Array(32),
    disposition: AssetDisposition.INLINE,
    ...overrides,
  });
}
