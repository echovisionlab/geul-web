import { isConnectError } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  MenuItemLocalizationMode,
  MenuLinkType,
  MenuVisibilityMode,
  type MenuItem as ProtoMenuItem,
} from '@echovisionlab/geul-proto/secure/menu_pb.ts';
import { createMenuClient } from '@/lib/api/browser-client';
import { normalizeMenuVisibilityRole } from '@/lib/types/menu/visibility';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('menu-browser');

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

function protoLocalizationModeToString(mode: MenuItemLocalizationMode): 'translated' | 'fixed_locale' | undefined {
  switch (mode) {
    case MenuItemLocalizationMode.FIXED_LOCALE:
      return 'fixed_locale';
    case MenuItemLocalizationMode.TRANSLATED:
      return 'translated';
    default:
      return undefined;
  }
}

function protoLinkTypeToString(type: MenuLinkType): string {
  switch (type) {
    case MenuLinkType.CUSTOM:
      return 'custom';
    case MenuLinkType.PAGE:
      return 'page';
    case MenuLinkType.CATEGORY:
      return 'category';
    case MenuLinkType.TAG:
      return 'tag';
    case MenuLinkType.SERIES:
      return 'series';
    default:
      return 'custom';
  }
}

function protoVisibilityModeToString(mode: MenuVisibilityMode): string {
  switch (mode) {
    case MenuVisibilityMode.ALL:
      return 'all';
    case MenuVisibilityMode.AUTHENTICATED:
      return 'authenticated';
    case MenuVisibilityMode.GUEST:
      return 'guest';
    case MenuVisibilityMode.ROLES:
      return 'roles';
    default:
      return 'all';
  }
}

function fromProtoMenuItem(item: ProtoMenuItem): MenuItem {
  return {
    id: item.id,
    label: item.label,
    linkType: protoLinkTypeToString(item.linkType),
    url: item.url,
    targetId: item.targetId,
    targetSlug: item.targetSlug,
    openInNewTab: item.openInNewTab,
    localizationMode: protoLocalizationModeToString(item.localizationMode),
    fixedLocale: item.fixedLocale,
    visibility: item.visibility
      ? {
          mode: protoVisibilityModeToString(item.visibility.mode),
          roles: (item.visibility.roles ?? [])
            .map((role) => normalizeMenuVisibilityRole(role))
            .filter((role) => role.length > 0),
        }
      : undefined,
    children: (item.children ?? []).map(fromProtoMenuItem),
  };
}

// Browser: list menus (for Client Component useQuery)
export async function listMenus() {
  try {
    const client = createMenuClient();
    const menus = [];
    const limit = 100;
    let offset = 0;

    while (true) {
      const response = await client.listMenus({
        pagination: { limit, offset },
      });
      menus.push(
        ...(response.menus ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          items: (m.items ?? []).map(fromProtoMenuItem),
          createdAt: m.createdAt ? timestampDate(m.createdAt) : undefined,
          updatedAt: m.updatedAt ? timestampDate(m.updatedAt) : undefined,
        })),
      );

      if (!response.pagination?.hasMore) {
        return menus;
      }
      offset += limit;
    }
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListMenus RPC error', { error: err.message });
    }
    return [];
  }
}

// Browser: get menu by ID (for Client Component useQuery)
export async function getMenuById(id: string) {
  try {
    const client = createMenuClient();
    const menu = await client.getMenuById({ id });
    return {
      id: menu.id,
      name: menu.name,
      items: (menu.items ?? []).map(fromProtoMenuItem),
      createdAt: menu.createdAt ? timestampDate(menu.createdAt) : undefined,
      updatedAt: menu.updatedAt ? timestampDate(menu.updatedAt) : undefined,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.NotFound) {
        return null;
      }
      logger.error('GetMenuById RPC error', { error: err.message });
    }
    return null;
  }
}
