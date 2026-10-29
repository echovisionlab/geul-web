'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DndContextProps,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SelectionRow } from '@/components/core/SelectionSurface';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { LabelBadge } from '@/components/core/Badge';
import { Button, SaveButton } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput, Checkbox } from '@/components/core/Input';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { PageLoader } from '@/features/site/PageLoader';
import { SettingsSection } from '@/components/core/Section';
import { PageHeader } from '@/components/core/PageHeader';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { unwrapQueryResult } from '@/lib/api/query-result';
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

function useAdminMenusPageModel() {
  const tModalActions = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.menus');
  const queryClient = useQueryClient();

  // Menu states
  const searchParams = useSearchParams();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(() => searchParams.get('menu'));
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
  const menusQuery = useQuery({
    queryKey: ['menus', 'list'],
    queryFn: listMenus,
  });
  const { data: menus, isLoading: menusLoading } = menusQuery;
  const selectedMenuQuery = useQuery({
    queryKey: ['menus', 'detail', selectedMenuId],
    queryFn: () => getMenuById(selectedMenuId!),
    enabled: !!selectedMenuId,
  });
  const { data: selectedMenu, isLoading: selectedMenuLoading } = selectedMenuQuery;
  const selectedMenuFailure =
    selectedMenuId && selectedMenu === null
      ? { ...selectedMenuQuery, isError: true, error: { status: 404 } }
      : selectedMenuQuery;
  const localeSession = useLocaleDocumentSession({
    entityType: 'menu',
    entityId: selectedMenuId ?? '',
    sourceTitle: selectedMenu?.name ?? '',
    sourceSummary: '',
    enabled: Boolean(selectedMenuId && selectedMenu),
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const menuRoom = useMenuCollaboration(selectedMenuId ?? '', roomLocale);
  const accessLevel = useEditorAccessLevel(menuRoom.provider);
  const roomState = menuRoom.roomState;
  const canEditCurrentCopy =
    accessLevel === 'edit' &&
    menuRoom.isSynced &&
    activeEditLocale.canEditActiveLocale &&
    activeEditLocale.hasLiveRow &&
    roomState?.locale === activeEditLocale.activeLocale &&
    roomState.sourceLocale === activeEditLocale.sourceLocale;
  const canEditStructure = canEditCurrentCopy && activeEditLocale.isSourceLocale;
  const selectedMenuAuthoringLocked = !canEditStructure;
  const effectiveSourceLocale = roomState?.sourceLocale ?? activeEditLocale.sourceLocale ?? '';
  const targetsQuery = useQuery({
    queryKey: ['menu', 'targets', formLinkType],
    queryFn: async (): Promise<MenuTarget[]> => unwrapQueryResult(await getMenuAvailableTargetsAction(formLinkType)),
    enabled: formLinkType !== 'custom' && itemModalOpened,
  });
  const { data: targets } = targetsQuery;
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('created'), tone: 'positive' });
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('deleted'), tone: 'positive' });
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
      menuRoom.replaceSource(roomState, menuName, roomState.items);
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
    if (!selectedMenuId || !roomState || selectedMenuAuthoringLocked) {
      return;
    }
    setMenuItems(items);
    menuRoom.replaceSource({ name: roomState.name, items: menuItems }, roomState.name, items);
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

  return {
    kind: 'ready' as const,
    menuRoom,
    selectedMenuId,
    menusQuery,
    selectedMenuFailure,
    targetsQuery,
    selectedMenuQuery,
    tPage,
    handleCreateMenu,
    tCommon,
    menusLoading,
    menus,
    setSelectedMenuId,
    handleEditMenu,
    canEditStructure,
    handleDeleteMenu,
    selectedMenuLoading,
    roomState,
    selectedMenu,
    activeEditLocale,
    effectiveSourceLocale,
    openCreateItemModal,
    selectedMenuAuthoringLocked,
    menuItems,
    canEditRoom: accessLevel === 'edit',
    canEditCurrentCopy,
    sensors,
    handleDragEnd,
    handleUpdateItem,
    handleDeleteItem,
    handleUpdateChild,
    handleDeleteChild,
    menuModalOpened,
    closeMenuModal,
    editingMenuId,
    tModalActions,
    menuName,
    setMenuName,
    handleSaveMenu,
    isSaving,
    itemModalOpened,
    closeItemModal,
    creatingForParentId,
    formLabel,
    setFormLabel,
    formLabelOwnedBySource,
    formLinkType,
    setFormLinkType,
    setFormTargetId,
    formUrl,
    setFormUrl,
    formTargetId,
    formTargetSelectData,
    formOpenInNewTab,
    setFormOpenInNewTab,
    formLocalizationMode,
    setFormLocalizationMode,
    setFormFixedLocale,
    formFixedLocale,
    formVisibility,
    setFormVisibility,
    handleSaveItem,
    canSaveFormItem,
    deleteMenuOpened,
    closeDeleteMenuModal,
    deletingMenu,
    deleteMenu,
  };
}

type AdminMenusPageControllerModel = ReturnType<typeof useAdminMenusPageModel>;
type AdminMenusPageReadyModel = Extract<AdminMenusPageControllerModel, { kind: 'ready' }>;
export type AdminMenusPageViewModel =
  | Exclude<AdminMenusPageControllerModel, { kind: 'ready' }>
  | (Omit<
      AdminMenusPageReadyModel,
      | 'menuRoom'
      | 'menusQuery'
      | 'selectedMenuFailure'
      | 'targetsQuery'
      | 'selectedMenuQuery'
      | 'roomState'
      | 'selectedMenu'
      | 'deleteMenu'
    > & {
      menuRoom:
        | Pick<NonNullable<AdminMenusPageReadyModel['menuRoom']>, 'provider' | 'setLabel' | 'useSourceLabel'>
        | Extract<AdminMenusPageReadyModel['menuRoom'], null | undefined>;
      menusQuery: import('react').ComponentProps<typeof QueryErrorAlert>['queries'][number];
      selectedMenuFailure: import('react').ComponentProps<typeof QueryErrorAlert>['queries'][number];
      targetsQuery: import('react').ComponentProps<typeof QueryErrorAlert>['queries'][number];
      selectedMenuQuery: import('react').ComponentProps<typeof QueryErrorAlert>['queries'][number];
      roomState:
        | Pick<NonNullable<AdminMenusPageReadyModel['roomState']>, 'name' | 'locale' | 'requestedLabels'>
        | Extract<AdminMenusPageReadyModel['roomState'], null | undefined>;
      selectedMenu: Pick<NonNullable<AdminMenusPageReadyModel['selectedMenu']>, 'name'> | null | undefined;
      deleteMenu:
        | Pick<NonNullable<AdminMenusPageReadyModel['deleteMenu']>, 'mutate' | 'isPending'>
        | Extract<AdminMenusPageReadyModel['deleteMenu'], null | undefined>;
    });
export function AdminMenusPageView({ model }: { model: AdminMenusPageViewModel }) {
  const tReorder = useTranslations('pageEditor.a11y');
  const {
    menuRoom,
    selectedMenuId,
    menusQuery,
    selectedMenuFailure,
    targetsQuery,
    selectedMenuQuery,
    tPage,
    handleCreateMenu,
    tCommon,
    menusLoading,
    menus,
    setSelectedMenuId,
    handleEditMenu,
    canEditStructure,
    handleDeleteMenu,
    selectedMenuLoading,
    roomState,
    selectedMenu,
    activeEditLocale,
    effectiveSourceLocale,
    openCreateItemModal,
    selectedMenuAuthoringLocked,
    menuItems,
    canEditRoom,
    canEditCurrentCopy,
    sensors,
    handleDragEnd,
    handleUpdateItem,
    handleDeleteItem,
    handleUpdateChild,
    handleDeleteChild,
    menuModalOpened,
    closeMenuModal,
    editingMenuId,
    tModalActions,
    menuName,
    setMenuName,
    handleSaveMenu,
    isSaving,
    itemModalOpened,
    closeItemModal,
    creatingForParentId,
    formLabel,
    setFormLabel,
    formLabelOwnedBySource,
    formLinkType,
    setFormLinkType,
    setFormTargetId,
    formUrl,
    setFormUrl,
    formTargetId,
    formTargetSelectData,
    formOpenInNewTab,
    setFormOpenInNewTab,
    formLocalizationMode,
    setFormLocalizationMode,
    setFormFixedLocale,
    formFixedLocale,
    formVisibility,
    setFormVisibility,
    handleSaveItem,
    canSaveFormItem,
    deleteMenuOpened,
    closeDeleteMenuModal,
    deletingMenu,
    deleteMenu,
  } = model;
  const describePosition = (id: string | number, targetId: string | number = id) => {
    const item = menuItems.find((entry) => entry.id === String(id));
    const index = menuItems.findIndex((entry) => entry.id === String(targetId));
    if (!item || index < 0) {
      return null;
    }
    return {
      section: `${selectedMenu?.name ?? tCommon('entities.menus')} · ${item.label}`,
      index: index + 1,
      count: menuItems.length,
    };
  };
  const reorderAccessibility: NonNullable<DndContextProps['accessibility']> = {
    screenReaderInstructions: { draggable: tReorder('dragInstructions') },
    announcements: {
      onDragStart: ({ active }) => {
        const position = describePosition(active.id);
        return position ? tReorder('dragStart', position) : undefined;
      },
      onDragOver: ({ active, over }) => {
        const position = over ? describePosition(active.id, over.id) : null;
        return position ? tReorder('dragOver', position) : undefined;
      },
      onDragEnd: ({ active, over }) => {
        const position = describePosition(active.id, over?.id ?? active.id);
        return position ? tReorder(over ? 'dragEnd' : 'dragCancel', position) : undefined;
      },
      onDragCancel: ({ active }) => {
        const position = describePosition(active.id);
        return position ? tReorder('dragCancel', position) : undefined;
      },
    },
  };
  return (
    <EditorRuntimeProvider provider={menuRoom.provider} entityType="menu" entityId={selectedMenuId ?? ''}>
      <DsLayoutStack gap="lg">
        <QueryErrorAlert queries={[menusQuery, selectedMenuFailure, targetsQuery, selectedMenuQuery]} />
        <PageHeader
          title={tPage('title')}
          description={tPage('description')}
          actions={
            <Button tone="neutral" emphasis="medium" onClick={handleCreateMenu} leftSection={<IconPlus size={16} />}>
              {tPage('createMenu')}
            </Button>
          }
        />

        <DsLayoutStack gap="xl">
          <SettingsSection title={tCommon('entities.menus')}>
            {menusQuery.isError ? null : menusLoading ? (
              <PageLoader />
            ) : !menus || menus.length === 0 ? (
              <SupportingText role="status" tone="secondary">
                {tPage('empty')}
              </SupportingText>
            ) : (
              <DsLayoutStack gap="none">
                {menus.map((menu) => (
                  <SelectionRow
                    density="compact"
                    key={menu.id}
                    selected={selectedMenuId === menu.id}
                    onAction={() => setSelectedMenuId(menu.id)}
                    trailing={
                      <DsLayoutInline gap="none" wrap="nowrap">
                        <IconButton
                          emphasis="medium"
                          size="chrome"
                          aria-label={`${tCommon('actions.edit')} ${menu.name}`}
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
                          size="chrome"
                          disabled={selectedMenuId === menu.id && !canEditRoom}
                          aria-label={`${tCommon('actions.delete')} ${menu.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMenu(menu.id);
                          }}
                        >
                          <IconTrash size={14} />
                        </IconButton>
                      </DsLayoutInline>
                    }
                  >
                    <DsLayoutInline gap="xxs" wrap="nowrap">
                      <DsText size="xs" truncate>
                        {menu.name}
                      </DsText>
                      <LabelBadge>{menu.items.length}</LabelBadge>
                    </DsLayoutInline>
                  </SelectionRow>
                ))}
              </DsLayoutStack>
            )}
          </SettingsSection>

          {selectedMenuFailure.isError ? null : !selectedMenuId ? (
            <SupportingText tone="secondary">{tPage('selectPrompt')}</SupportingText>
          ) : selectedMenuLoading ? (
            <PageLoader />
          ) : (
            <SettingsSection
              title={roomState?.name ?? selectedMenu?.name ?? tPage('itemsTitle')}
              actions={
                <DsLayoutInline gap="xs">
                  {activeEditLocale.isControlVisible ? (
                    <TranslationLocaleControl
                      variant="menu"
                      buttonSize="compact"
                      value={activeEditLocale.activeLocale}
                      options={activeEditLocale.localeOptions}
                      sourceLocale={effectiveSourceLocale}
                      onChange={(value) => value && activeEditLocale.setActiveLocale(value)}
                    />
                  ) : null}
                  {activeEditLocale.isSourceLocale ? (
                    <Button
                      tone="neutral"
                      emphasis="medium"
                      size="compact"
                      onClick={() => openCreateItemModal()}
                      leftSection={<IconPlus size={14} />}
                      disabled={selectedMenuAuthoringLocked}
                    >
                      {tPage('addItem')}
                    </Button>
                  ) : null}
                </DsLayoutInline>
              }
            >
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
                <div style={{ textAlign: 'center' }}>
                  <DsLayoutInset space="xs">
                    <SupportingText tone="secondary">{tPage('noItems')}</SupportingText>
                  </DsLayoutInset>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  accessibility={reorderAccessibility}
                >
                  <SortableContext items={menuItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <DsLayoutStack gap="none" role="group" aria-label={selectedMenu?.name ?? tCommon('entities.menus')}>
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
                    </DsLayoutStack>
                  </SortableContext>
                </DndContext>
              )}
            </SettingsSection>
          )}

          {selectedMenuId && selectedMenu ? (
            <AuthoringExtension kind="translations">
              <EntityTranslationsPanel
                entityType="menu"
                entityId={selectedMenuId}
                canManage
                canAdministerTranslations={canEditRoom}
                canMutateTargets={canEditRoom}
              />
            </AuthoringExtension>
          ) : null}
        </DsLayoutStack>

        {/* Menu Name Modal */}
        <ContentModal
          opened={menuModalOpened}
          onClose={closeMenuModal}
          title={editingMenuId ? tPage('editMenuTitle') : tPage('createMenu')}
          closeLabel={tModalActions('close')}
        >
          <DsLayoutStack>
            <TextInput
              label={tPage('menuNameLabel')}
              placeholder={tPage('menuNamePlaceholder')}
              disabled={Boolean(editingMenuId) && selectedMenuAuthoringLocked}
              value={menuName}
              onChange={(e) => setMenuName(e.currentTarget.value)}
              required
            />
            <DialogActions>
              <Button emphasis="low" onClick={closeMenuModal}>
                {tCommon('actions.cancel')}
              </Button>
              <SaveButton type="button"
                onClick={handleSaveMenu}
                loading={isSaving}
                disabled={!menuName.trim() || (Boolean(editingMenuId) && selectedMenuAuthoringLocked)}
              >
                {editingMenuId
                  ? tCommon('actions.save')
                  : tCommon('actions.createItem', { item: tCommon('entities.menu') })}
              </SaveButton>
            </DialogActions>
          </DsLayoutStack>
        </ContentModal>

        {/* Add Item Modal */}
        <ContentModal
          opened={itemModalOpened}
          onClose={closeItemModal}
          title={creatingForParentId ? tPage('addSubmenuItemTitle') : tPage('addMenuItemTitle')}
          closeLabel={tModalActions('close')}
        >
          <DsLayoutStack>
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

            <DsLayoutInline grow align="start">
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
            </DsLayoutInline>
            <DsText size="xs" tone="secondary">
              {formLocalizationMode === 'fixed_locale'
                ? tPage('labelLanguageFixedLocaleDescription')
                : tPage('labelLanguageTranslatedDescription')}
            </DsText>

            <VisibilityEditor
              value={formVisibility}
              onChange={setFormVisibility}
              disabled={selectedMenuAuthoringLocked}
            />

            <DialogActions>
              <Button emphasis="low" onClick={closeItemModal}>
                {tCommon('actions.cancel')}
              </Button>
              <Button
                emphasis="strong"
                onClick={handleSaveItem}
                disabled={!canSaveFormItem || selectedMenuAuthoringLocked}
              >
                {tCommon('actions.add')}
              </Button>
            </DialogActions>
          </DsLayoutStack>
        </ContentModal>

        <ConfirmationDialog
          intent="delete"
          opened={deleteMenuOpened}
          onClose={closeDeleteMenuModal}
          confirmDisabled={!canEditRoom && deletingMenu?.id === selectedMenuId}
          onConfirm={() =>
            deletingMenu && (deletingMenu.id !== selectedMenuId || canEditRoom) && deleteMenu.mutate(deletingMenu.id)
          }
          title={tCommon('actions.delete')}
          message={
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingMenu?.name ?? tCommon('entities.menu'),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
          }
          confirmLabel={tCommon('actions.delete')}
          cancelLabel={tCommon('actions.cancel')}
          closeLabel={tCommon('actions.close')}
          loading={deleteMenu.isPending}
        />
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
export function AdminMenusPage(...args: Parameters<typeof useAdminMenusPageModel>) {
  return <AdminMenusPageView model={useAdminMenusPageModel(...args)} />;
}
