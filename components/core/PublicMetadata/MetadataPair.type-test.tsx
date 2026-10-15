import { MetadataPair, PublicMetadataRow } from './index';

<MetadataPair label="Visibility">Private</MetadataPair>;
<MetadataPair label="Endpoint" layout="stacked" size="xs">
  https://example.com
</MetadataPair>;
<PublicMetadataRow label="Email" size="xs">
  person@example.com
</PublicMetadataRow>;
const splitScale = { label: 'Email', labelSize: 'xs' as const, children: 'person@example.com' };
// @ts-expect-error variable spreads cannot set a separate label size either
<PublicMetadataRow {...splitScale} />;
// @ts-expect-error metadata owns its label/value scale
<MetadataPair label="Visibility" style={{ fontSize: 32 }}>
  Private
</MetadataPair>;
// @ts-expect-error independent label sizing breaks the shared scale
<PublicMetadataRow label="Email" labelSize="xs">
  person@example.com
</PublicMetadataRow>;
// @ts-expect-error sizes are finite token roles
<MetadataPair label="Visibility" size={28}>
  Private
</MetadataPair>;
