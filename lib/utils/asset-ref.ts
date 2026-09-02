type AssetURLRef = {
  url?: string;
};

export function assetRefUrl(asset?: AssetURLRef | null): string | null {
  const url = asset?.url?.trim();
  return url || null;
}

export function themedAssetRefUrl(light?: AssetURLRef | null, dark?: AssetURLRef | null): string | null {
  return assetRefUrl(light) ?? assetRefUrl(dark);
}
