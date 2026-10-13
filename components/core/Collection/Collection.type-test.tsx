import { Collection, CollectionMedia } from './Collection';

const supported = (
  <Collection size="s">
    <CollectionMedia aspectRatio="1:1" width="thumbnail" backdrop="transparent" />
  </Collection>
);
// @ts-expect-error Collection has a closed S/M/L contract.
const arbitrarySize = <Collection size="xl" />;
// @ts-expect-error Consumers cannot override collection geometry.
const customStyle = <Collection style={{ gap: 999 }} />;
// @ts-expect-error Consumers cannot override media geometry.
const customClass = <CollectionMedia className="my-media" />;
// @ts-expect-error Arbitrary ratios do not belong to the closed media contract.
const customRatio = <CollectionMedia aspectRatio="9:17" />;
// @ts-expect-error Reserved state attributes are owned by Core.
const reserved = <Collection data-core-collection-size="l" />;
void [supported, arbitrarySize, customStyle, customClass, customRatio, reserved];
