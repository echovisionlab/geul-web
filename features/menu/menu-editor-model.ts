import { arrayMove } from '@dnd-kit/sortable';

export type MenuLinkType = 'custom' | 'page' | 'category' | 'tag' | 'series';
export type MenuItemLocalizationMode = 'translated' | 'fixed_locale';

export interface MenuVisibility {
  mode: string;
  roles?: string[];
}

export interface MenuItemBase {
  id: string;
  label: string;
  linkType: string;
  url?: string;
  targetId?: string;
  targetSlug?: string;
  openInNewTab?: boolean;
  localizationMode?: MenuItemLocalizationMode;
  fixedLocale?: string;
  visibility?: MenuVisibility;
}

export interface MenuItem extends MenuItemBase {
  children?: MenuItem[];
}

export interface MenuTarget {
  id: string;
  name: string;
  slug?: string;
}

export function buildTargetSelectData(
  targets: MenuTarget[] | undefined,
  selectedTargetId: string | null,
  selectedTargetSlug?: string,
) {
  const data = (targets ?? []).map((target) => ({ value: target.id, label: target.name }));
  if (selectedTargetId && !data.some((target) => target.value === selectedTargetId)) {
    data.push({ value: selectedTargetId, label: selectedTargetSlug?.trim() || selectedTargetId });
  }
  return data;
}

export function getMenuItemLocalizationMode(item: MenuItemBase): MenuItemLocalizationMode {
  return item.localizationMode ?? (item.fixedLocale ? 'fixed_locale' : 'translated');
}

export function reorderMenuItems(items: MenuItem[], activeId: string, overId: string): MenuItem[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  return from < 0 || to < 0 || from === to ? items : arrayMove(items, from, to);
}

export function removeMenuItem(items: MenuItem[], itemId: string): MenuItem[] {
  return items.filter((item) => item.id !== itemId);
}

export function removeMenuChild(items: MenuItem[], parentId: string, childId: string): MenuItem[] {
  return items.map((item) =>
    item.id === parentId ? { ...item, children: item.children?.filter((child) => child.id !== childId) } : item,
  );
}

export function replaceMenuItem(items: MenuItem[], updated: MenuItem): MenuItem[] {
  return items.map((item) => (item.id === updated.id ? { ...updated, children: item.children } : item));
}

export function replaceMenuChild(items: MenuItem[], parentId: string, updated: MenuItemBase): MenuItem[] {
  return items.map((item) =>
    item.id === parentId
      ? { ...item, children: item.children?.map((child) => (child.id === updated.id ? updated : child)) }
      : item,
  );
}

export function appendMenuItem(items: MenuItem[], item: MenuItem, parentId?: string | null): MenuItem[] {
  if (!parentId) {
    return [...items, item];
  }
  return items.map((current) =>
    current.id === parentId ? { ...current, children: [...(current.children ?? []), item] } : current,
  );
}
