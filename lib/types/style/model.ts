export interface StyleSelect {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
}

export interface StyleWithReleaseCount extends StyleSelect {
  releaseCount: number;
  createdAt: Date | null;
}
