'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useMemo, useState } from 'react';
import { SortableSurface, useSortableItem } from '@/components/core/Sortable';
import { IconEdit, IconExternalLink, IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Disclosure } from '@/components/core/Disclosure';
import { LabelBadge } from '@/components/core/Badge';
import { Button, SaveButton } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Checkbox, Select, TextInput } from '@/components/core/Input';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { getMenuAvailableTargetsAction } from '@/lib/actions/menu';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';
import { isMenuItemLabelApplicableToLocale } from '@/features/translation/menu-translation-model';
import {
  buildTargetSelectData,
  getMenuItemLocalizationMode,
  type MenuItem,
  type MenuItemBase,
  type MenuItemLocalizationMode,
  type MenuLinkType,
  type MenuTarget,
  type MenuVisibility,
} from './menu-editor-model';
import { getVisibilityLabel, VisibilityEditor } from './VisibilityEditor';

interface MenuItemLinkDraft {
  linkType: MenuLinkType;
  url: string;
  targetId: string | null;
}

interface MenuItemLocalizationDraft {
  mode: MenuItemLocalizationMode;
  fixedLocale: string | null;
}

interface MenuItemFormDraft {
  label?: string;
  link?: MenuItemLinkDraft;
  openInNewTab?: boolean;
  localization?: MenuItemLocalizationDraft;
  visibility?: MenuVisibility;
}

function MenuItemForm({
  item,
  onSave,
  onCancel,
  editable,
  sourceLocale,
}: {
  item: MenuItem | MenuItemBase;
  onSave: (updated: MenuItem | MenuItemBase) => void;
  onCancel: () => void;
  editable: boolean;
  sourceLocale: string;
}) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.menus');
  const supportedLocaleOptions = getSupportedLocaleOptions();
  const [draft, setDraft] = useState<MenuItemFormDraft>({});
  const label = draft.label ?? item.label;
  const link =
    draft.link ??
    ({
      linkType: item.linkType as MenuLinkType,
      url: item.url || '',
      targetId: item.targetId || null,
    } satisfies MenuItemLinkDraft);
  const openInNewTab = draft.openInNewTab ?? item.openInNewTab ?? false;
  const localization =
    draft.localization ??
    ({
      mode: item.localizationMode ?? (item.fixedLocale ? 'fixed_locale' : 'translated'),
      fixedLocale: item.fixedLocale || null,
    } satisfies MenuItemLocalizationDraft);
  const visibility = draft.visibility ?? item.visibility ?? { mode: 'all' };
  const labelOwnedBySource = isMenuItemLabelApplicableToLocale(
    {
      ...item,
      label,
      localizationMode: localization.mode,
      fixedLocale: localization.fixedLocale ?? undefined,
    },
    sourceLocale,
  );

  const targetsQuery = useQuery({
    queryKey: ['menu', 'targets', link.linkType],
    queryFn: async (): Promise<MenuTarget[]> => unwrapQueryResult(await getMenuAvailableTargetsAction(link.linkType)),
    enabled: link.linkType !== 'custom',
  });
  const { data: targets } = targetsQuery;
  const preservedTargetSlug =
    link.linkType === item.linkType && link.targetId === (item.targetId || null) && item.targetSlug?.trim()
      ? item.targetSlug.trim()
      : undefined;
  const targetSelectData = useMemo(
    () => buildTargetSelectData(targets, link.targetId, preservedTargetSlug),
    [link.targetId, preservedTargetSlug, targets],
  );
  const canSave =
    editable &&
    (!labelOwnedBySource || label.trim().length > 0) &&
    (link.linkType === 'custom' ? link.url.trim().length > 0 : Boolean(link.targetId || preservedTargetSlug)) &&
    (localization.mode !== 'fixed_locale' || Boolean(localization.fixedLocale));

  const handleSave = () => {
    if (!editable) {
      return;
    }
    const selectedTarget = targets?.find((target) => target.id === link.targetId);
    const updated: MenuItem | MenuItemBase = { ...item };

    if (draft.label !== undefined && labelOwnedBySource) {
      updated.label = label.trim();
    }
    if (draft.link) {
      Object.assign(updated, {
        linkType: link.linkType,
        url: link.linkType === 'custom' ? link.url.trim() : undefined,
        targetId: link.linkType !== 'custom' ? link.targetId || undefined : undefined,
        targetSlug: link.linkType !== 'custom' ? (selectedTarget?.slug ?? preservedTargetSlug) : undefined,
      });
    }
    if (draft.openInNewTab !== undefined) {
      updated.openInNewTab = openInNewTab || undefined;
    }
    if (draft.localization) {
      updated.localizationMode = localization.mode === 'fixed_locale' ? 'fixed_locale' : undefined;
      updated.fixedLocale = localization.mode === 'fixed_locale' ? localization.fixedLocale || undefined : undefined;
    }
    if (draft.visibility) {
      updated.visibility = visibility.mode === 'all' ? undefined : visibility;
    }

    onSave(updated);
  };

  return (
    <DsLayoutInset blockStart="sm">
      <DsLayoutStack gap="xs">
        <QueryErrorAlert queries={[targetsQuery]} />
        <TextInput
          size="xs"
          label={tPage('sourceLabel')}
          placeholder={tPage('labelPlaceholder')}
          description={tPage('sourceLabelDescription')}
          value={label}
          onChange={(e) => {
            const nextLabel = e.currentTarget.value;
            setDraft((current) => ({ ...current, label: nextLabel }));
          }}
          disabled={!editable || !labelOwnedBySource}
        />
        <DsLayoutInline grow gap="xs">
          <Select
            size="xs"
            value={link.linkType}
            onChange={(v) => {
              const nextLinkType = v as MenuLinkType;
              setDraft((current) => {
                const currentLink =
                  current.link ??
                  ({
                    linkType: item.linkType as MenuLinkType,
                    url: item.url || '',
                    targetId: item.targetId || null,
                  } satisfies MenuItemLinkDraft);
                return {
                  ...current,
                  link: {
                    ...currentLink,
                    linkType: nextLinkType,
                    targetId: nextLinkType === currentLink.linkType ? currentLink.targetId : null,
                  },
                };
              });
            }}
            data={[
              { value: 'custom', label: tPage('customUrl') },
              { value: 'page', label: tCommon('entities.page') },
              { value: 'category', label: tCommon('entities.category') },
              { value: 'tag', label: tCommon('entities.tag') },
              { value: 'series', label: tCommon('entities.series') },
            ]}
            disabled={!editable}
          />
          {link.linkType === 'custom' ? (
            <TextInput
              size="xs"
              placeholder={tPage('urlPlaceholder')}
              value={link.url}
              onChange={(e) => {
                const url = e.currentTarget.value;
                setDraft((current) => {
                  const currentLink =
                    current.link ??
                    ({
                      linkType: item.linkType as MenuLinkType,
                      url: item.url || '',
                      targetId: item.targetId || null,
                    } satisfies MenuItemLinkDraft);
                  return { ...current, link: { ...currentLink, url } };
                });
              }}
              disabled={!editable}
            />
          ) : (
            <Select
              size="xs"
              placeholder={targetsQuery.isLoading ? tCommon('states.loading') : tPage('targetPlaceholder')}
              aria-busy={targetsQuery.isLoading}
              error={targetsQuery.isError ? tCommon('states.notAvailable') : undefined}
              value={link.targetId}
              onChange={(targetId) =>
                setDraft((current) => {
                  const currentLink =
                    current.link ??
                    ({
                      linkType: item.linkType as MenuLinkType,
                      url: item.url || '',
                      targetId: item.targetId || null,
                    } satisfies MenuItemLinkDraft);
                  return { ...current, link: { ...currentLink, targetId } };
                })
              }
              data={targetSelectData}
              searchable
              nothingFoundMessage={tPage('noTargets')}
              disabled={!editable || targetsQuery.isLoading || targetsQuery.isError}
            />
          )}
        </DsLayoutInline>
        <DsLayoutInline grow gap="xs">
          <Select
            size="xs"
            label={tPage('labelLanguageMode')}
            value={localization.mode}
            onChange={(value) => {
              const nextMode = (value as MenuItemLocalizationMode | null) ?? 'translated';
              setDraft((current) => ({
                ...current,
                localization: {
                  ...(current.localization ?? {
                    mode: item.localizationMode ?? (item.fixedLocale ? 'fixed_locale' : 'translated'),
                    fixedLocale: item.fixedLocale || null,
                  }),
                  mode: nextMode,
                  fixedLocale: nextMode === 'fixed_locale' ? localization.fixedLocale : null,
                },
              }));
            }}
            data={[
              { value: 'translated', label: tPage('labelLanguageTranslated') },
              { value: 'fixed_locale', label: tPage('labelLanguageFixedLocale') },
            ]}
            disabled={!editable}
          />
          {localization.mode === 'fixed_locale' ? (
            <Select
              size="xs"
              label={tCommon('labels.language')}
              placeholder={tPage('fixedLocalePlaceholder')}
              value={localization.fixedLocale}
              onChange={(fixedLocale) =>
                setDraft((current) => ({
                  ...current,
                  localization: {
                    ...(current.localization ?? {
                      mode: item.localizationMode ?? (item.fixedLocale ? 'fixed_locale' : 'translated'),
                      fixedLocale: item.fixedLocale || null,
                    }),
                    fixedLocale,
                  },
                }))
              }
              data={supportedLocaleOptions}
              searchable
              disabled={!editable}
            />
          ) : null}
        </DsLayoutInline>
        <DsText size="xs" tone="secondary">
          {localization.mode === 'fixed_locale'
            ? tPage('labelLanguageFixedLocaleDescription')
            : tPage('labelLanguageTranslatedDescription')}
        </DsText>
        <Checkbox
          size="xs"
          label={tCommon('actions.openInNewTab')}
          checked={openInNewTab}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setDraft((current) => ({ ...current, openInNewTab: checked }));
          }}
          disabled={!editable}
        />
        <VisibilityEditor
          value={visibility}
          onChange={(nextVisibility) => setDraft((current) => ({ ...current, visibility: nextVisibility }))}
          disabled={!editable}
        />
        <DsLayoutInline justify="end" gap="xs">
          <Button size="xs" tone="neutral" emphasis="low" onClick={onCancel}>
            {tCommon('actions.cancel')}
          </Button>
          <SaveButton type="button" size="xs" onClick={handleSave} disabled={!canSave}>
            {tCommon('actions.save')}
          </SaveButton>
        </DsLayoutInline>
      </DsLayoutStack>
    </DsLayoutInset>
  );
}

// Sortable menu item component
export function SortableMenuItem({
  item,
  sourceLocale,
  onUpdate,
  onDelete,
  onAddChild,
  onUpdateChild,
  onDeleteChild,
  allowChildren,
  editable,
}: {
  item: MenuItem;
  sourceLocale: string;
  onUpdate: (updated: MenuItem) => void;
  onDelete: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onUpdateChild?: (parentId: string, child: MenuItemBase) => void;
  onDeleteChild?: (parentId: string, childId: string) => void;
  allowChildren: boolean;
  editable: boolean;
}) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.menus');
  const tSort = useTranslations('dataTable.sort');
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);

  const sortable = useSortableItem({
    id: item.id,
    disabled: !editable,
  });

  const hasChildren = item.children && item.children.length > 0;
  const fixedLocaleDisplayLabel = getFixedLocaleDisplayLabel(item.fixedLocale);
  const localizationMode = getMenuItemLocalizationMode(item);
  const usesFixedLocale = localizationMode === 'fixed_locale' && fixedLocaleDisplayLabel !== null;

  const rowLabel = (row: MenuItemBase, count?: number) => (
    <DsLayoutInline gap="xxs" wrap="nowrap">
      <DsText as="span" size="xs" weight="medium" truncate title={row.label}>
        {row.label}
      </DsText>
      {row.openInNewTab ? <IconExternalLink size="1em" aria-hidden /> : null}
      {count ? <LabelBadge>{count}</LabelBadge> : null}
    </DsLayoutInline>
  );
  const linkDescription = (row: MenuItemBase) => (
    <DsText size="xs" tone="secondary" wrap="anywhere">
      {getLinkTypeLabel(row.linkType, tCommon, tPage)}
      {row.linkType === 'custom' && row.url ? `: ${row.url}` : ''}
      {row.linkType !== 'custom' && row.targetSlug ? `: /${row.targetSlug}` : ''}
    </DsText>
  );
  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <Disclosure
        density="compact"
        withDivider={false}
        label={rowLabel(item, item.children?.length)}
        opened={editing || childrenExpanded}
        onChange={(opened) => {
          if (!opened) {
            setEditing(false);
            setChildrenExpanded(false);
            setEditingChildId(null);
          } else if (hasChildren) {
            setChildrenExpanded(true);
          } else {
            setEditing(true);
          }
        }}
        leadingActions={
          <IconButton
            emphasis="low"
            aria-label={tSort('aria.reorder', { label: item.label })}
            {...sortable.handle}
            interaction="drag-handle"
            draggable={false}
            disabled={!editable}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
        }
        actions={
          <DsLayoutInline gap="none" wrap="nowrap">
            {allowChildren ? (
              <IconButton
                emphasis="low"
                size="compact"
                onClick={() => onAddChild?.(item.id)}
                aria-label={`${tPage('addSubmenu')} ${item.label}`}
                disabled={!editable}
              >
                <IconPlus aria-hidden />
              </IconButton>
            ) : null}
            <IconButton
              emphasis="low"
              size="compact"
              aria-expanded={editing}
              aria-label={`${editing ? tCommon('actions.close') : tCommon('actions.edit')} ${item.label}`}
              onClick={() => setEditing(!editing)}
              disabled={!editable}
            >
              <IconEdit aria-hidden />
            </IconButton>
            <IconButton
              tone="danger"
              emphasis="low"
              size="compact"
              aria-label={`${tCommon('actions.delete')} ${item.label}`}
              onClick={() => onDelete(item.id)}
              disabled={!editable}
            >
              <IconTrash aria-hidden />
            </IconButton>
          </DsLayoutInline>
        }
      >
        <DsLayoutStack gap="xxs">
          {linkDescription(item)}
          {usesFixedLocale ? (
            <DsText size="xs" tone="secondary">
              {tPage('fixedLocaleItemBadge', { locale: fixedLocaleDisplayLabel ?? '' })}
            </DsText>
          ) : (
            <DsText size="xs" tone="secondary">
              {tPage('translatedItemBadge')}
            </DsText>
          )}
          {item.visibility && item.visibility.mode !== 'all' ? (
            <DsText size="xs" tone="secondary">
              {getVisibilityLabel(item.visibility)}
            </DsText>
          ) : null}
          {editing ? (
            <MenuItemForm
              item={item}
              onSave={(updated) => {
                onUpdate(updated as MenuItem);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
              editable={editable}
              sourceLocale={sourceLocale}
            />
          ) : null}
          {allowChildren && childrenExpanded && hasChildren
            ? item.children!.map((child) => (
                <Disclosure
                  nested
                  key={child.id}
                  density="compact"
                  withDivider={false}
                  label={rowLabel(child)}
                  opened={editingChildId === child.id}
                  onChange={(opened) => setEditingChildId(opened ? child.id : null)}
                  actions={
                    <IconButton
                      tone="danger"
                      emphasis="low"
                      size="compact"
                      aria-label={`${tCommon('actions.delete')} ${item.label} ${child.label}`}
                      onClick={() => onDeleteChild?.(item.id, child.id)}
                      disabled={!editable}
                    >
                      <IconTrash aria-hidden />
                    </IconButton>
                  }
                >
                  {linkDescription(child)}
                  <MenuItemForm
                    item={child}
                    onSave={(updated) => {
                      onUpdateChild?.(item.id, updated);
                      setEditingChildId(null);
                    }}
                    onCancel={() => setEditingChildId(null)}
                    editable={editable}
                    sourceLocale={sourceLocale}
                  />
                </Disclosure>
              ))
            : null}
        </DsLayoutStack>
      </Disclosure>
    </SortableSurface>
  );
}

function getLinkTypeLabel(
  type: string,
  tCommon: ReturnType<typeof useTranslations>,
  tPage: ReturnType<typeof useTranslations>,
): string {
  const labels: Record<string, string> = {
    custom: tPage('customUrl'),
    page: tCommon('entities.page'),
    category: tCommon('entities.category'),
    tag: tCommon('entities.tag'),
    series: tCommon('entities.series'),
  };
  return labels[type] ?? type;
}

const supportedLocaleOptions = getSupportedLocaleOptions();
const localeLabelByValue = new Map(supportedLocaleOptions.map((item) => [item.value, item.label]));

function getFixedLocaleDisplayLabel(locale?: string | null): string | null {
  const normalized = normalizeLocale(locale ?? null);
  if (normalized) {
    return localeLabelByValue.get(normalized) ?? normalized;
  }
  if (locale && locale.trim()) {
    return locale.trim();
  }
  return null;
}
