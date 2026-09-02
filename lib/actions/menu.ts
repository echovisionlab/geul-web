'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import {
  MenuItemLocalizationMode,
  MenuLinkType,
  MenuVisibilityMode,
  type MenuItem as ProtoMenuItem,
} from '@echovisionlab/geul-proto/secure/menu_pb.ts';
import { listCategoriesAdminAction } from '@/lib/actions/category';
import { listTagsAdminAction } from '@/lib/actions/tag';
import { createMenuClient } from '@/lib/api/server-client';
import { listPagesAdmin } from '@/lib/queries/page';
import { listSeriesAdmin } from '@/lib/queries/series';
import { normalizeMenuVisibilityRole } from '@/lib/types/menu/visibility';

function normalizeVisibilityRoles(roles?: string[]): string[] {
  if (!roles || roles.length === 0) {
    return [];
  }

  return roles.map((role) => normalizeMenuVisibilityRole(role)).filter((role): role is string => role.length > 0);
}

// Convert local MenuItem to proto format
function toProtoMenuItem(item: MenuItem): ProtoMenuItem {
  return {
    $typeName: 'api.manage.v1.MenuItem',
    id: item.id,
    label: item.label,
    linkType: stringToProtoLinkType(item.linkType),
    url: item.url,
    targetId: item.targetId,
    targetSlug: item.targetSlug,
    openInNewTab: item.openInNewTab,
    localizationMode: stringToProtoLocalizationMode(item.localizationMode),
    fixedLocale: item.fixedLocale,
    visibility: item.visibility
      ? {
          $typeName: 'api.manage.v1.MenuVisibility',
          mode: stringToProtoVisibilityMode(item.visibility.mode),
          roles: normalizeVisibilityRoles(item.visibility.roles),
        }
      : undefined,
    children: item.children?.map(toProtoMenuItem) ?? [],
  };
}

function stringToProtoLocalizationMode(mode?: string): MenuItemLocalizationMode {
  switch (mode) {
    case 'fixed_locale':
      return MenuItemLocalizationMode.FIXED_LOCALE;
    case 'translated':
      return MenuItemLocalizationMode.TRANSLATED;
    default:
      return MenuItemLocalizationMode.UNSPECIFIED;
  }
}

function stringToProtoLinkType(type: string): MenuLinkType {
  switch (type) {
    case 'custom':
      return MenuLinkType.CUSTOM;
    case 'page':
      return MenuLinkType.PAGE;
    case 'category':
      return MenuLinkType.CATEGORY;
    case 'tag':
      return MenuLinkType.TAG;
    case 'series':
      return MenuLinkType.SERIES;
    default:
      return MenuLinkType.CUSTOM;
  }
}

function stringToProtoVisibilityMode(mode: string): MenuVisibilityMode {
  switch (mode) {
    case 'all':
      return MenuVisibilityMode.ALL;
    case 'authenticated':
      return MenuVisibilityMode.AUTHENTICATED;
    case 'guest':
      return MenuVisibilityMode.GUEST;
    case 'roles':
      return MenuVisibilityMode.ROLES;
    default:
      return MenuVisibilityMode.ALL;
  }
}

interface MenuItem {
  id: string;
  label: string;
  linkType: string;
  url?: string;
  targetId?: string;
  targetSlug?: string;
  openInNewTab?: boolean;
  localizationMode?: 'translated' | 'fixed_locale';
  fixedLocale?: string;
  visibility?: {
    mode: string;
    roles?: string[];
  };
  children?: MenuItem[];
}

interface UpdateMenuInput {
  name?: string;
  items?: MenuItem[];
}

interface MenuTarget {
  id: string;
  name: string;
  slug?: string;
}

function formatTargetName(name: string, slug?: string | null, fallback = 'Untitled'): string {
  const normalizedName = name.trim();
  const normalizedSlug = slug?.trim();

  if (normalizedName && normalizedSlug) {
    return `${normalizedName} (${normalizedSlug})`;
  }
  if (normalizedName) {
    return normalizedName;
  }
  if (normalizedSlug) {
    return normalizedSlug;
  }
  return fallback;
}

export async function updateMenuAction(
  id: string,
  data: UpdateMenuInput,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createMenuClient();
    await client.updateMenu({
      id,
      name: data.name,
      items: data.items
        ? {
            $typeName: 'api.manage.v1.MenuItemsUpdate',
            items: data.items.map(toProtoMenuItem),
          }
        : undefined,
    });
    revalidatePath('/admin/menus');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update menu' };
  }
}

export async function createMenuAction(name: string): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createMenuClient();
    const menu = await client.createMenu({
      name,
      items: [],
    });
    revalidatePath('/admin/menus');
    return { data: { id: menu.id } };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create menu' };
  }
}

export async function deleteMenuAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createMenuClient();
    await client.deleteMenu({ id });
    revalidatePath('/admin/menus');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete menu' };
  }
}

export async function getMenuAvailableTargetsAction(type: string): Promise<MenuTarget[]> {
  try {
    switch (type) {
      case 'page': {
        const pages = await listPagesAdmin({
          page: 1,
          pageSize: 1000,
          sort: [{ field: 'title', order: 'asc' }],
        });
        return pages.data.map((p) => ({
          id: p.id,
          name: formatTargetName(p.title, p.slug, 'Untitled page'),
          slug: p.slug ?? undefined,
        }));
      }
      case 'category': {
        const categories = await listCategoriesAdminAction({
          page: 1,
          pageSize: 1000,
          sort: [{ field: 'name', order: 'asc' }],
        });
        return categories.data.map((c) => ({
          id: c.id,
          name: formatTargetName(c.name, c.slug, 'Untitled category'),
          slug: c.slug ?? undefined,
        }));
      }
      case 'tag': {
        const tags = await listTagsAdminAction({
          page: 1,
          pageSize: 1000,
          sort: [{ field: 'name', order: 'asc' }],
        });
        return tags.data.map((t) => ({
          id: t.id,
          name: formatTargetName(t.name, t.slug, 'Untitled tag'),
          slug: t.slug ?? undefined,
        }));
      }
      case 'series': {
        const series = await listSeriesAdmin({
          page: 1,
          pageSize: 1000,
          sort: [{ field: 'title', order: 'asc' }],
        });
        return series.data.map((s) => ({
          id: s.id,
          name: formatTargetName(s.title, s.slug, 'Untitled series'),
          slug: s.slug ?? undefined,
        }));
      }
      default:
        return [];
    }
  } catch (err) {
    void err;
    return [];
  }
}
