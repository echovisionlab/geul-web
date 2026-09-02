export interface MapFeatureBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapFeatureViewportRequest {
  bounds: MapFeatureBounds;
  zoom: number;
  widthPx: number;
  heightPx: number;
  clusterRadiusPx: number;
  minClusterPoints: number;
}

export interface PostMapFeatureCluster {
  id: string;
  lat: number;
  lng: number;
  placeCount: number;
  postCount: number;
  bounds: MapFeatureBounds;
  minBreakoutZoom?: number | null;
}

export interface PostMapFeatureItem {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  postCount: number;
  primaryPostId: string;
  primaryPostSlug: string | null;
  primaryPostTitle: string;
}

export interface PostMapFeatureResponse {
  clusters: PostMapFeatureCluster[];
  items: PostMapFeatureItem[];
}

export interface WorkMapFeatureCluster {
  id: string;
  lat: number;
  lng: number;
  placeCount: number;
  workCount: number;
  bounds: MapFeatureBounds;
  minBreakoutZoom?: number | null;
}

export interface WorkMapFeatureItem {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  workCount: number;
  primaryWorkId: string;
  primaryWorkSlug: string | null;
  primaryWorkTitle: string;
}

export interface WorkMapFeatureResponse {
  clusters: WorkMapFeatureCluster[];
  items: WorkMapFeatureItem[];
}
