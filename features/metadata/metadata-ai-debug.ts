'use client';

export type MetadataEntityType = 'post' | 'page' | 'work' | 'artist' | 'label' | 'release' | 'program_event';

export type MetadataAIDebugEvent = {
  at: string;
  entityType: MetadataEntityType;
  entityId: string;
  phase: string;
  detail?: Record<string, unknown>;
};

export function recordMetadataAIDebugEvent(
  entityType: MetadataEntityType,
  entityId: string,
  phase: string,
  detail?: Record<string, unknown>,
) {
  if (typeof window === 'undefined') {
    return;
  }

  const targetWindow = window as Window & {
    __GEUL_METADATA_AI_EVENTS__?: MetadataAIDebugEvent[];
  };
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const event: MetadataAIDebugEvent = {
    at: new Date().toISOString(),
    entityType,
    entityId,
    phase,
    ...(detail ? { detail } : {}),
  };

  const existing = Array.isArray(targetWindow.__GEUL_METADATA_AI_EVENTS__)
    ? targetWindow.__GEUL_METADATA_AI_EVENTS__
    : [];
  targetWindow.__GEUL_METADATA_AI_EVENTS__ = [...existing.slice(-99), event];
}
