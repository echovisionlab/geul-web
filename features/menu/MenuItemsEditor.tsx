'use client';

import { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconExternalLink,
  IconGripVertical,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Collapse, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Checkbox, Select, TextInput } from '@/components/core/Input';
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

  const { data: targets } = useQuery({
    queryKey: ['menu', 'targets', link.linkType],
    queryFn: async (): Promise<MenuTarget[]> => getMenuAvailableTargetsAction(link.linkType),
    enabled: link.linkType !== 'custom',
  });
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
    <Stack gap="xs" mt="sm">
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
      <Group grow gap="xs">
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
            placeholder={tPage('targetPlaceholder')}
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
            disabled={!editable}
          />
        )}
      </Group>
      <Group grow gap="xs">
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
      </Group>
      <Text size="xs" c="dimmed">
        {localization.mode === 'fixed_locale'
          ? tPage('labelLanguageFixedLocaleDescription')
          : tPage('labelLanguageTranslatedDescription')}
      </Text>
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
      <Divider my="xs" />
      <VisibilityEditor
        value={visibility}
        onChange={(nextVisibility) => setDraft((current) => ({ ...current, visibility: nextVisibility }))}
        disabled={!editable}
      />
      <Group justify="flex-end" gap="xs">
        <Button size="xs" tone="neutral" emphasis="medium" onClick={onCancel}>
          {tCommon('actions.cancel')}
        </Button>
        <Button size="xs" onClick={handleSave} disabled={!canSave}>
          {tCommon('actions.save')}
        </Button>
      </Group>
    </Stack>
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
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = item.children && item.children.length > 0;
  const fixedLocaleDisplayLabel = getFixedLocaleDisplayLabel(item.fixedLocale);
  const localizationMode = getMenuItemLocalizationMode(item);
  const usesFixedLocale = localizationMode === 'fixed_locale' && fixedLocaleDisplayLabel !== null;

  return (
    <Paper ref={setNodeRef} style={style} p="sm" withBorder mb="xs">
      <Group gap="xs" wrap="nowrap">
        <IconButton
          emphasis="low"
          size="sm"
          aria-label="Drag menu item"
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab' }}
          disabled={!editable}
        >
          <IconGripVertical size={16} />
        </IconButton>

        {allowChildren && hasChildren && (
          <IconButton
            emphasis="low"
            size="sm"
            aria-label={childrenExpanded ? 'Collapse submenu' : 'Expand submenu'}
            onClick={() => setChildrenExpanded(!childrenExpanded)}
          >
            {childrenExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </IconButton>
        )}

        <Stack gap={2} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {item.label}
            </Text>
            {item.openInNewTab && <IconExternalLink size={14} color="gray" />}
            {item.visibility && item.visibility.mode !== 'all' && (
              <LabelBadge size="xs" tone="accent">
                {getVisibilityLabel(item.visibility)}
              </LabelBadge>
            )}
            {usesFixedLocale ? (
              <LabelBadge size="xs" tone="accent">
                {tPage('fixedLocaleItemBadge', { locale: fixedLocaleDisplayLabel ?? '' })}
              </LabelBadge>
            ) : (
              <LabelBadge size="xs" tone="neutral">
                {tPage('translatedItemBadge')}
              </LabelBadge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {getLinkTypeLabel(item.linkType, tCommon, tPage)}
            {item.linkType === 'custom' && item.url ? `: ${item.url}` : ''}
            {item.linkType !== 'custom' && item.targetSlug ? `: /${item.targetSlug}` : ''}
          </Text>
        </Stack>

        {hasChildren && <LabelBadge size="sm">{item.children!.length}</LabelBadge>}

        <Group gap="xs">
          {allowChildren && (
            <IconButton
              emphasis="low"
              size="sm"
              onClick={() => onAddChild?.(item.id)}
              label={tPage('addSubmenu')}
              title={tPage('addSubmenu')}
              disabled={!editable}
            >
              <IconPlus size={16} />
            </IconButton>
          )}
          <IconButton
            emphasis="low"
            size="sm"
            aria-label={editing ? tCommon('actions.close') : tCommon('actions.edit')}
            onClick={() => setEditing(!editing)}
            disabled={!editable}
          >
            {editing ? <IconChevronDown size={16} /> : <IconEdit size={16} />}
          </IconButton>
          <IconButton
            tone="danger"
            emphasis="low"
            size="sm"
            aria-label={tCommon('actions.delete')}
            onClick={() => onDelete(item.id)}
            disabled={!editable}
          >
            <IconTrash size={16} />
          </IconButton>
        </Group>
      </Group>

      <Collapse expanded={editing}>
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
      </Collapse>

      {allowChildren && hasChildren && (
        <Collapse expanded={childrenExpanded}>
          <Stack gap="xs" mt="sm" ml="xl">
            {item.children!.map((child) => (
              <Paper key={child.id} p="xs" withBorder>
                <Group gap="xs" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text size="sm">{child.label}</Text>
                      {child.openInNewTab && <IconExternalLink size={12} color="gray" />}
                      {child.visibility && child.visibility.mode !== 'all' && (
                        <LabelBadge size="xs" tone="accent">
                          {getVisibilityLabel(child.visibility)}
                        </LabelBadge>
                      )}
                      {getMenuItemLocalizationMode(child) === 'fixed_locale' &&
                      getFixedLocaleDisplayLabel(child.fixedLocale) != null ? (
                        <LabelBadge size="xs" tone="accent">
                          {tPage('fixedLocaleItemBadge', {
                            locale: getFixedLocaleDisplayLabel(child.fixedLocale) ?? '',
                          })}
                        </LabelBadge>
                      ) : (
                        <LabelBadge size="xs" tone="neutral">
                          {tPage('translatedItemBadge')}
                        </LabelBadge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {getLinkTypeLabel(child.linkType, tCommon, tPage)}
                      {child.linkType === 'custom' && child.url ? `: ${child.url}` : ''}
                      {child.linkType !== 'custom' && child.targetSlug ? `: /${child.targetSlug}` : ''}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <IconButton
                      emphasis="low"
                      size="sm"
                      aria-label={editingChildId === child.id ? tCommon('actions.close') : tCommon('actions.edit')}
                      onClick={() => setEditingChildId(editingChildId === child.id ? null : child.id)}
                      disabled={!editable}
                    >
                      {editingChildId === child.id ? <IconChevronDown size={14} /> : <IconEdit size={14} />}
                    </IconButton>
                    <IconButton
                      tone="danger"
                      emphasis="low"
                      size="sm"
                      aria-label={tCommon('actions.delete')}
                      onClick={() => onDeleteChild?.(item.id, child.id)}
                      disabled={!editable}
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </Group>
                </Group>
                <Collapse expanded={editingChildId === child.id}>
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
                </Collapse>
              </Paper>
            ))}
          </Stack>
        </Collapse>
      )}
    </Paper>
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
