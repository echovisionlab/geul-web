'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  MapThemeDocumentSettingsSchema,
  MapThemeDocumentVariantSchema,
} from '@echovisionlab/geul-common/collaboration/map-theme';
import { createMapThemeClient, createPublicMapThemeClient } from '@/lib/api/server-client';
import type {
  MapTheme,
  MapThemeList,
  ResolvedPublicMapTheme,
  ThemeSettings,
  ThemeVariant,
} from '@/lib/types/map-theme/model';
import { createMapThemeInputSchema } from '@/lib/types/map-theme/schema';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('map-theme-actions');

interface WireVariant {
  id: string;
  backgroundColor: string;
  waterColor: string;
  landColor: string;
  roadColor: string;
  buildingFillColor: string;
  buildingStrokeEnabled: boolean;
  buildingStrokeColor: string;
  calloutLineColor: string;
  calloutTextColor: string;
  calloutBackgroundColor: string;
  calloutDescriptionColor: string;
  attributionColor: string;
  labelTextColor: string;
  clusterColor: string;
  clusterHoverColor: string;
  clusterTextColor: string;
  clusterTextHoverColor: string;
  calloutHoverLineColor: string;
  calloutHoverTextColor: string;
  calloutHoverDescriptionColor: string;
  calloutHoverBackgroundColor: string;
}

interface WireSettings {
  calloutScale: number;
  calloutOffsetX: number;
  calloutOffsetY: number;
  calloutFields: string[];
  attributionFontSize: number;
  showAreaLabels: boolean;
  showPoiLabels: boolean;
}

interface WireTheme {
  id: string;
  name: string;
  settings?: WireSettings;
  lightVariant?: WireVariant;
  darkVariant?: WireVariant;
  revision?: bigint;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function mapSettings(settings: WireSettings | undefined): ThemeSettings {
  if (!settings) {
    throw new Error('Map Theme response is missing settings');
  }

  return MapThemeDocumentSettingsSchema.parse({
    calloutScale: settings.calloutScale,
    calloutOffsetX: settings.calloutOffsetX,
    calloutOffsetY: settings.calloutOffsetY,
    calloutFields: settings.calloutFields,
    attributionFontSize: settings.attributionFontSize,
    showAreaLabels: settings.showAreaLabels,
    showPoiLabels: settings.showPoiLabels,
  }) as ThemeSettings;
}

function mapVariant(variant: WireVariant | undefined, scheme: 'light' | 'dark'): ThemeVariant {
  if (!variant) {
    throw new Error(`Map Theme response is missing its ${scheme} variant`);
  }

  const { id } = variant;
  const parsedVariant = MapThemeDocumentVariantSchema.parse(toVariantInput(variant));

  return {
    id,
    scheme,
    ...parsedVariant,
  };
}

function mapTheme(theme: WireTheme): MapTheme {
  return {
    id: theme.id,
    name: theme.name,
    settings: mapSettings(theme.settings),
    lightVariant: mapVariant(theme.lightVariant, 'light'),
    darkVariant: mapVariant(theme.darkVariant, 'dark'),
    revision: theme.revision,
    createdAt: theme.createdAt ? timestampDate(theme.createdAt) : undefined,
    updatedAt: theme.updatedAt ? timestampDate(theme.updatedAt) : undefined,
  };
}

function mapResolvedVariant(response: {
  themeId: string;
  scheme: string;
  settings?: WireSettings;
  variant?: WireVariant;
}): {
  themeId: string;
  scheme: 'light' | 'dark';
  settings: ThemeSettings;
  variant: ThemeVariant;
} {
  if (response.scheme !== 'light' && response.scheme !== 'dark') {
    throw new Error(`Map Theme response has an invalid scheme: ${response.scheme}`);
  }

  return {
    themeId: response.themeId,
    scheme: response.scheme,
    settings: mapSettings(response.settings),
    variant: mapVariant(response.variant, response.scheme),
  };
}

function toVariantInput(variant: WireVariant | Omit<ThemeVariant, 'id'>) {
  return {
    backgroundColor: variant.backgroundColor,
    waterColor: variant.waterColor,
    landColor: variant.landColor,
    roadColor: variant.roadColor,
    buildingFillColor: variant.buildingFillColor,
    buildingStrokeEnabled: variant.buildingStrokeEnabled,
    buildingStrokeColor: variant.buildingStrokeColor,
    calloutLineColor: variant.calloutLineColor,
    calloutTextColor: variant.calloutTextColor,
    calloutDescriptionColor: variant.calloutDescriptionColor,
    calloutBackgroundColor: variant.calloutBackgroundColor,
    attributionColor: variant.attributionColor,
    labelTextColor: variant.labelTextColor,
    clusterColor: variant.clusterColor,
    clusterHoverColor: variant.clusterHoverColor,
    clusterTextColor: variant.clusterTextColor,
    clusterTextHoverColor: variant.clusterTextHoverColor,
    calloutHoverLineColor: variant.calloutHoverLineColor,
    calloutHoverTextColor: variant.calloutHoverTextColor,
    calloutHoverDescriptionColor: variant.calloutHoverDescriptionColor,
    calloutHoverBackgroundColor: variant.calloutHoverBackgroundColor,
  };
}

export async function listMapThemesAction(): Promise<MapThemeList> {
  try {
    const client = await createMapThemeClient();
    const response = await client.listMapThemes({});
    return {
      themes: response.themes.map(mapTheme),
      defaultMapThemeId: response.defaultMapThemeId,
    };
  } catch (error) {
    logger.error('Failed to list map themes', { error });
    throw error;
  }
}

export async function getMapThemeByIdAction(id: string): Promise<MapTheme | null> {
  try {
    const client = await createMapThemeClient();
    return mapTheme(await client.getMapTheme({ id }));
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound, Code.Unauthenticated)) {
      return null;
    }
    throw error;
  }
}

export async function resolveMapThemeAction(themeId?: string, scheme: 'light' | 'dark' = 'light') {
  const client = await createMapThemeClient();
  return mapResolvedVariant(await client.resolveMapTheme({ themeId, scheme }));
}

export async function resolvePublicMapThemeAction(themeId?: string, scheme: 'light' | 'dark' = 'light') {
  const client = createPublicMapThemeClient();
  return mapResolvedVariant(await client.resolve({ themeId, scheme }));
}

export async function resolvePublicMapThemesByIdsAction(
  requestedThemeIds: string[],
): Promise<ResolvedPublicMapTheme[]> {
  if (requestedThemeIds.length === 0) {
    return [];
  }

  try {
    const client = createPublicMapThemeClient();
    const response = await client.resolveByIds({ requestedThemeIds });
    return response.results.map((result) => {
      if (!result.requestedThemeId || !result.theme) {
        throw new Error('Map Theme batch response is missing its requested ID or resolved Theme');
      }
      return {
        requestedThemeId: result.requestedThemeId,
        theme: mapTheme(result.theme),
      };
    });
  } catch (error) {
    logger.error('Failed to resolve public map themes by IDs', { error });
    throw error;
  }
}

export async function resolvePublicMapThemeByIdAction(id: string): Promise<MapTheme | null> {
  if (!id) {
    return null;
  }

  const [result] = await resolvePublicMapThemesByIdsAction([id]);
  return result?.theme ?? null;
}

export async function copyMapThemeAction(id: string, name: string): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createMapThemeClient();
    const result = await client.copyMapTheme({ id, name });
    revalidatePath('/admin/map/themes');
    return { data: { id: result.id } };
  } catch (error) {
    if (isConnectErrorCode(error, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(error, Code.NotFound)) {
      return { error: 'Theme not found' };
    }
    return { error: error instanceof Error ? error.message : 'Failed to copy theme' };
  }
}

export async function deleteMapThemeAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createMapThemeClient();
    await client.deleteMapTheme({ id });
    revalidatePath('/admin/map/themes');
    return { success: true };
  } catch (error) {
    if (isConnectErrorCode(error, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(error, Code.NotFound)) {
      return { error: 'Theme not found' };
    }
    if (isConnectErrorCode(error, Code.FailedPrecondition)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : 'Failed to delete theme' };
  }
}

export async function setDefaultMapThemeAction(
  themeId: string,
): Promise<{ data?: { defaultMapThemeId: string }; error?: string }> {
  try {
    const client = await createMapThemeClient();
    const result = await client.setDefaultMapTheme({ themeId });
    revalidatePath('/admin/map/themes');
    return { data: { defaultMapThemeId: result.defaultMapThemeId } };
  } catch (error) {
    if (isConnectErrorCode(error, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(error, Code.NotFound)) {
      return { error: 'Theme not found' };
    }
    return { error: error instanceof Error ? error.message : 'Failed to set default theme' };
  }
}

interface CreateMapThemeInput {
  name: string;
  settings: ThemeSettings;
  lightVariant: Omit<ThemeVariant, 'id'>;
  darkVariant: Omit<ThemeVariant, 'id'>;
}

export async function createMapThemeAction(
  input: CreateMapThemeInput,
): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const parsedInput = createMapThemeInputSchema.parse(input);
    const client = await createMapThemeClient();
    const result = await client.createMapTheme({
      name: parsedInput.name,
      settings: parsedInput.settings,
      lightVariant: toVariantInput(parsedInput.lightVariant),
      darkVariant: toVariantInput(parsedInput.darkVariant),
    });
    revalidatePath('/admin/map/themes');
    return { data: { id: result.id } };
  } catch (error) {
    if (isConnectErrorCode(error, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: error instanceof Error ? error.message : 'Failed to create theme' };
  }
}
