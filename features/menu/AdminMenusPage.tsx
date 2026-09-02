'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconEdit, IconMenu2, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Divider, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput, Checkbox } from '@/components/core/Input';
import { ConfirmModal } from '@/components/core/Modal';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { createMenuAction, deleteMenuAction, getMenuAvailableTargetsAction } from '@/lib/actions/menu';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { getSupportedLocaleOptions } from '@/lib/i18n/locale';
import { getMenuById, listMenus } from '@/lib/queries/menu-browser';
import {
  appendMenuItem,
  buildTargetSelectData,
  removeMenuChild,
  removeMenuItem,
  reorderMenuItems,
  replaceMenuChild,
  replaceMenuItem,
  type MenuItem,
  type MenuItemBase,
  type MenuItemLocalizationMode,
  type MenuLinkType,
  type MenuTarget,
  type MenuVisibility,
} from './menu-editor-model';
import { invalidateMenuEditorQueries } from './query-invalidation';
import { VisibilityEditor } from './VisibilityEditor';

import { SortableMenuItem } from './MenuItemsEditor';
import { MenuTargetItemsEditor } from './MenuTargetItemsEditor';
import { useMenuCollaboration } from './useMenuCollaboration';
import { isMenuItemLabelApplicableToLocale } from '@/features/translation/menu-translation-model';

const supportedLocaleOptions = getSupportedLocaleOptions();

export function AdminMenusPage() {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.menus');
  const queryClient = useQueryClient();

  // Menu states
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Menu modal states
  const [menuModalOpened, { open: openMenuModal, close: closeMenuModal }] = useDisclosure(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [deleteMenuOpened, { open: openDeleteMenuModal, close: closeDeleteMenuModal }] = useDisclosure(false);
  const [deletingMenu, setDeletingMenu] = useState<{ id: string; name: string } | null>(null);

  // Item modal states (for creating new items only)
  const [itemModalOpened, { open: openItemModal, close: closeItemModal }] = useDisclosure(false);
  const [creatingForParentId, setCreatingForParentId] = useState<string | null>(null);

  // Item form states
  const [formLabel, setFormLabel] = useState('');
  const [formLinkType, setFormLinkType] = useState<MenuLinkType>('custom');
  const [formUrl, setFormUrl] = useState('');
  const [formTargetId, setFormTargetId] = useState<string | null>(null);
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(false);
  const [formLocalizationMode, setFormLocalizationMode] = useState<MenuItemLocalizationMode>('translated');
  const [formFixedLocale, setFormFixedLocale] = useState<string | null>(null);
  const [formVisibility, setFormVisibility] = useState<MenuVisibility>({ mode: 'all' });

  // Queries
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: ['menus', 'list'],
    queryFn: listMenus,
  });
  const { data: selectedMenu, isLoading: selectedMenuLoading } = useQuery({
    queryKey: ['menus', 'detail', selectedMenuId],
    queryFn: () => getMenuById(selectedMenuId!),
    enabled: !!selectedMenuId,
  });
  const localeSession = useLocaleDocumentSession({
    entityType: 'menu',
    entityId: selectedMenuId ?? '',
    sourceTitle: selectedMenu?.name ?? '',
    sourceSummary: '',
    enabled: Boolean(selectedMenuId && selectedMenu),
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const menuRoom = useMenuCollaboration(selectedMenuId ?? '', roomLocale);
  const roomState = menuRoom.roomState;
  const canEditCurrentCopy =
    menuRoom.isSynced &&
    activeEditLocale.canEditActiveLocale &&
    activeEditLocale.hasLiveRow &&
    roomState?.locale === activeEditLocale.activeLocale &&
    roomState.sourceLocale === activeEditLocale.sourceLocale;
  const canEditStructure = canEditCurrentCopy && activeEditLocale.isSourceLocale;
  const selectedMenuAuthoringLocked = !canEditStructure;
  const effectiveSourceLocale = roomState?.sourceLocale ?? activeEditLocale.sourceLocale ?? '';
  const { data: targets } = useQuery({
    queryKey: ['menu', 'targets', formLinkType],
    queryFn: async (): Promise<MenuTarget[]> => getMenuAvailableTargetsAction(formLinkType),
    enabled: formLinkType !== 'custom' && itemModalOpened,
  });
  const formTargetSelectData = useMemo(() => buildTargetSelectData(targets, formTargetId), [formTargetId, targets]);
  const formLabelOwnedBySource = isMenuItemLabelApplicableToLocale(
    {
      id: 'new',
      label: formLabel,
      linkType: formLinkType,
      localizationMode: formLocalizationMode,
      fixedLocale: formFixedLocale ?? undefined,
    },
    effectiveSourceLocale,
  );
  const canSaveFormItem =
    (!formLabelOwnedBySource || formLabel.trim().length > 0) &&
    (formLinkType === 'custom' ? formUrl.trim().length > 0 : Boolean(formTargetId)) &&
    (formLocalizationMode !== 'fixed_locale' || Boolean(formFixedLocale));

  // Mutations
  const createMenu = useMutation({
    mutationFn: (name: string) => createMenuAction(name),
    onSuccess: async (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('created'), color: 'green' });
      await invalidateMenuEditorQueries(queryClient);
      if (result.data) {
        setSelectedMenuId(result.data.id);
      }
      closeMenuModal();
    },
  });

  const deleteMenu = useMutation({
    mutationFn: (id: string) => deleteMenuAction(id),
    onSuccess: async (result, id) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('deleted'), color: 'red' });
      await invalidateMenuEditorQueries(queryClient, id);
      if (selectedMenuId === id) {
        setSelectedMenuId(null);
        setMenuItems([]);
      }
      closeDeleteMenuModal();
      setDeletingMenu(null);
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // The room is authoritative once synced. The direct query is only the
  // loading fallback before the exact source/target locale room arrives.
  useEffect(() => {
    if (roomState) {
      setMenuItems(roomState.items);
    } else if (selectedMenu) {
      setMenuItems(selectedMenu.items as MenuItem[]);
    }
  }, [roomState, selectedMenu]);

  // Menu handlers
  const handleCreateMenu = () => {
    setEditingMenuId(null);
    setMenuName('');
    openMenuModal();
  };

  const handleEditMenu = (id: string, name: string) => {
    if (id !== selectedMenuId || !canEditStructure) {
      return;
    }
    setEditingMenuId(id);
    setMenuName(name);
    openMenuModal();
  };

  const handleSaveMenu = () => {
    if (!menuName.trim()) {
      return;
    }

    if (editingMenuId) {
      if (editingMenuId !== selectedMenuId || !roomState || !canEditStructure) {
        return;
      }
      menuRoom.replaceSource(menuName, roomState.items);
      closeMenuModal();
    } else {
      createMenu.mutate(menuName);
    }
  };

  const handleDeleteMenu = (id: string) => {
    const targetMenu = menus?.find((menu) => menu.id === id);
    setDeletingMenu({ id, name: targetMenu?.name ?? tCommon('entities.menu') });
    openDeleteMenuModal();
  };

  // Helper to save items
  const saveItems = (items: MenuItem[]) => {
    if (!selectedMenuId || selectedMenuAuthoringLocked) {
      return;
    }
    setMenuItems(items);
    menuRoom.replaceSource(roomState?.name ?? selectedMenu?.name ?? '', items);
  };

  // Item handlers
  const handleDragEnd = (event: DragEndEvent) => {
    if (selectedMenuAuthoringLocked) {
      return;
    }
    const { active, over } = event;
    if (over && active.id !== over.id) {
      saveItems(reorderMenuItems(menuItems, String(active.id), String(over.id)));
    }
  };

  const openCreateItemModal = (parentId?: string) => {
    if (selectedMenuAuthoringLocked) {
      return;
    }
    setCreatingForParentId(parentId || null);
    setFormLabel('');
    setFormLinkType('custom');
    setFormUrl('');
    setFormTargetId(null);
    setFormOpenInNewTab(false);
    setFormLocalizationMode('translated');
    setFormFixedLocale(null);
    setFormVisibility({ mode: 'all' });
    openItemModal();
  };

  const handleDeleteItem = (id: string) => {
    saveItems(removeMenuItem(menuItems, id));
  };

  const handleDeleteChild = (parentId: string, childId: string) => {
    saveItems(removeMenuChild(menuItems, parentId, childId));
  };

  const handleUpdateItem = (updated: MenuItem) => {
    saveItems(replaceMenuItem(menuItems, updated));
  };

  const handleUpdateChild = (parentId: string, updated: MenuItemBase) => {
    saveItems(replaceMenuChild(menuItems, parentId, updated));
  };

  const handleSaveItem = () => {
    if (selectedMenuAuthoringLocked) {
      return;
    }
    const selectedTarget = targets?.find((t) => t.id === formTargetId);
    const newItem: MenuItem = {
      id: crypto.randomUUID(),
      label: formLabelOwnedBySource ? formLabel.trim() : '',
      linkType: formLinkType,
      url: formLinkType === 'custom' ? formUrl.trim() : undefined,
      targetId: formLinkType !== 'custom' ? formTargetId || undefined : undefined,
      targetSlug: formLinkType !== 'custom' ? selectedTarget?.slug : undefined,
      openInNewTab: formOpenInNewTab || undefined,
      localizationMode: formLocalizationMode === 'fixed_locale' ? 'fixed_locale' : undefined,
      fixedLocale: formLocalizationMode === 'fixed_locale' ? formFixedLocale || undefined : undefined,
      visibility: formVisibility.mode === 'all' ? undefined : formVisibility,
    };

    saveItems(appendMenuItem(menuItems, newItem, creatingForParentId));
    closeItemModal();
  };

  const isSaving = createMenu.isPending;

  return (
    <EditorRuntimeProvider provider={menuRoom.provider} entityType="menu" entityId={selectedMenuId ?? ''}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{tPage('title')}</Title>
          <Button tone="neutral" emphasis="medium" onClick={handleCreateMenu} leftSection={<IconPlus size={16} />}>
            {tPage('createMenu')}
          </Button>
        </Group>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-lg)' }}>
          {/* Menu List */}
          <SectionCard>
            <SectionHeader title={tCommon('entities.menus')} />
            {menusLoading ? (
              <PageLoader />
            ) : !menus || menus.length === 0 ? (
              <Text size="sm" c="dimmed">
                {tPage('empty')}
              </Text>
            ) : (
              <Stack gap="xs">
                {menus.map((menu) => (
                  <Paper
                    key={menu.id}
                    p="sm"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedMenuId === menu.id ? 'var(--mantine-color-blue-light)' : undefined,
                    }}
                    onClick={() => setSelectedMenuId(menu.id)}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                        <IconMenu2 size={16} />
                        <Text size="sm" truncate>
                          {menu.name}
                        </Text>
                        <LabelBadge size="xs">{menu.items.length}</LabelBadge>
                      </Group>
                      <Group gap={4}>
                        <IconButton
                          emphasis="low"
                          size="sm"
                          aria-label={tCommon('actions.edit')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMenu(menu.id, menu.name);
                          }}
                          disabled={selectedMenuId !== menu.id || !canEditStructure}
                        >
                          <IconEdit size={14} />
                        </IconButton>
                        <IconButton
                          tone="danger"
                          emphasis="low"
                          size="sm"
                          aria-label={tCommon('actions.delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMenu(menu.id);
                          }}
                        >
                          <IconTrash size={14} />
                        </IconButton>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </SectionCard>

          {/* Menu Items Editor */}
          <SectionCard>
            {!selectedMenuId ? (
              <Stack align="center" justify="center" h={300}>
                <IconMenu2 size={48} color="gray" />
                <Text c="dimmed">{tPage('selectPrompt')}</Text>
              </Stack>
            ) : selectedMenuLoading ? (
              <PageLoader />
            ) : (
              <>
                <SectionHeader
                  title={roomState?.name ?? selectedMenu?.name ?? tPage('itemsTitle')}
                  actions={
                    <Group gap="xs">
                      {activeEditLocale.isControlVisible ? (
                        <TranslationLocaleControl
                          variant="select"
                          value={activeEditLocale.activeLocale}
                          options={activeEditLocale.localeOptions}
                          sourceLocale={effectiveSourceLocale}
                          onChange={(value) => value && activeEditLocale.setActiveLocale(value)}
                          style={{ width: 220 }}
                        />
                      ) : null}
                      {activeEditLocale.isSourceLocale ? (
                        <Button
                          tone="neutral"
                          emphasis="medium"
                          size="sm"
                          onClick={() => openCreateItemModal()}
                          leftSection={<IconPlus size={14} />}
                          disabled={selectedMenuAuthoringLocked}
                        >
                          {tPage('addItem')}
                        </Button>
                      ) : null}
                    </Group>
                  }
                />

                <Divider mb="md" />

                {!activeEditLocale.isSourceLocale && roomState?.locale ? (
                  <MenuTargetItemsEditor
                    items={menuItems}
                    locale={roomState.locale}
                    requestedLabels={roomState.requestedLabels}
                    editable={canEditCurrentCopy}
                    onChange={menuRoom.setLabel}
                    onUseSource={menuRoom.useSourceLabel}
                  />
                ) : menuItems.length === 0 ? (
                  <SectionCard p="xl" ta="center">
                    <Text c="dimmed">{tPage('noItems')}</Text>
                  </SectionCard>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={menuItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {menuItems.map((item) => (
                        <SortableMenuItem
                          key={item.id}
                          item={item}
                          sourceLocale={effectiveSourceLocale}
                          onUpdate={handleUpdateItem}
                          onDelete={handleDeleteItem}
                          onAddChild={openCreateItemModal}
                          onUpdateChild={handleUpdateChild}
                          onDeleteChild={handleDeleteChild}
                          allowChildren
                          editable={!selectedMenuAuthoringLocked}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </>
            )}
          </SectionCard>

          {selectedMenuId && selectedMenu ? (
            <EntityTranslationsPanel entityType="menu" entityId={selectedMenuId} canManage />
          ) : null}
        </div>

        {/* Menu Name Modal */}
        <Modal
          opened={menuModalOpened}
          onClose={closeMenuModal}
          title={editingMenuId ? tPage('editMenuTitle') : tPage('createMenu')}
        >
          <Stack>
            <TextInput
              label={tPage('menuNameLabel')}
              placeholder={tPage('menuNamePlaceholder')}
              value={menuName}
              onChange={(e) => setMenuName(e.currentTarget.value)}
              required
            />
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeMenuModal}>
                {tCommon('actions.cancel')}
              </Button>
              <Button onClick={handleSaveMenu} loading={isSaving} disabled={!menuName.trim()}>
                {editingMenuId
                  ? tCommon('actions.save')
                  : tCommon('actions.createItem', { item: tCommon('entities.menu') })}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Add Item Modal */}
        <Modal
          opened={itemModalOpened}
          onClose={closeItemModal}
          title={creatingForParentId ? tPage('addSubmenuItemTitle') : tPage('addMenuItemTitle')}
        >
          <Stack>
            <TextInput
              label={tPage('sourceLabel')}
              placeholder={tPage('labelPlaceholder')}
              description={tPage('sourceLabelDescription')}
              value={formLabel}
              onChange={(e) => setFormLabel(e.currentTarget.value)}
              disabled={selectedMenuAuthoringLocked || !formLabelOwnedBySource}
              required={formLabelOwnedBySource}
            />

            <Select
              label={tPage('linkType')}
              value={formLinkType}
              onChange={(v) => {
                setFormLinkType(v as MenuLinkType);
                setFormTargetId(null);
              }}
              data={[
                { value: 'custom', label: tPage('customUrl') },
                { value: 'page', label: tCommon('entities.page') },
                { value: 'category', label: tCommon('entities.category') },
                { value: 'tag', label: tCommon('entities.tag') },
                { value: 'series', label: tCommon('entities.series') },
              ]}
              disabled={selectedMenuAuthoringLocked}
            />

            {formLinkType === 'custom' ? (
              <TextInput
                label={tCommon('labels.url')}
                placeholder={tPage('urlPlaceholder')}
                value={formUrl}
                onChange={(e) => setFormUrl(e.currentTarget.value)}
                disabled={selectedMenuAuthoringLocked}
              />
            ) : (
              <Select
                label={tPage('selectTarget')}
                placeholder={tPage('targetPlaceholder')}
                value={formTargetId}
                onChange={(v) => setFormTargetId(v)}
                data={formTargetSelectData}
                searchable
                nothingFoundMessage={tPage('noTargets')}
                disabled={selectedMenuAuthoringLocked}
              />
            )}

            <Checkbox
              label={tCommon('actions.openInNewTab')}
              checked={formOpenInNewTab}
              onChange={(e) => setFormOpenInNewTab(e.currentTarget.checked)}
              disabled={selectedMenuAuthoringLocked}
            />

            <Group grow align="flex-start">
              <Select
                label={tPage('labelLanguageMode')}
                value={formLocalizationMode}
                onChange={(value) => {
                  const nextMode = (value as MenuItemLocalizationMode | null) ?? 'translated';
                  setFormLocalizationMode(nextMode);
                  if (nextMode !== 'fixed_locale') {
                    setFormFixedLocale(null);
                  }
                }}
                data={[
                  { value: 'translated', label: tPage('labelLanguageTranslated') },
                  { value: 'fixed_locale', label: tPage('labelLanguageFixedLocale') },
                ]}
                disabled={selectedMenuAuthoringLocked}
              />
              {formLocalizationMode === 'fixed_locale' ? (
                <Select
                  label={tCommon('labels.language')}
                  placeholder={tPage('fixedLocalePlaceholder')}
                  value={formFixedLocale}
                  onChange={setFormFixedLocale}
                  data={supportedLocaleOptions}
                  searchable
                  disabled={selectedMenuAuthoringLocked}
                />
              ) : null}
            </Group>
            <Text size="xs" c="dimmed">
              {formLocalizationMode === 'fixed_locale'
                ? tPage('labelLanguageFixedLocaleDescription')
                : tPage('labelLanguageTranslatedDescription')}
            </Text>

            <Divider my="xs" />

            <VisibilityEditor
              value={formVisibility}
              onChange={setFormVisibility}
              disabled={selectedMenuAuthoringLocked}
            />

            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeItemModal}>
                {tCommon('actions.cancel')}
              </Button>
              <Button onClick={handleSaveItem} disabled={!canSaveFormItem || selectedMenuAuthoringLocked}>
                {tCommon('actions.add')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        <ConfirmModal
          opened={deleteMenuOpened}
          onClose={closeDeleteMenuModal}
          onConfirm={() => deletingMenu && deleteMenu.mutate(deletingMenu.id)}
          title={tCommon('actions.delete')}
          message={
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingMenu?.name ?? tCommon('entities.menu'),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
          }
          confirmLabel={tCommon('actions.delete')}
          cancelLabel={tCommon('actions.cancel')}
          closeLabel={tCommon('actions.close')}
          loading={deleteMenu.isPending}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
