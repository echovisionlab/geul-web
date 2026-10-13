import { expect, userEvent, waitFor, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { LayoutContainer } from '@/components/core/Layout';
import { AdminMenusPageView, type AdminMenusPageViewModel } from '@/features/menu/AdminMenusPage';
import {
  appendMenuItem,
  removeMenuItem,
  removeMenuChild,
  replaceMenuItem,
  replaceMenuChild,
  reorderMenuItems,
  type MenuItem,
  type MenuLinkType,
  type MenuItemLocalizationMode,
  type MenuVisibility,
} from '@/features/menu/menu-editor-model';
import { localEditorQueryClient, localEditLocale, readyQuery } from './fixtures/editor-pages';
const initialItems: MenuItem[] = [
  {
    id: 'listen',
    label: 'Listening room',
    linkType: 'custom',
    url: '/listen',
    localizationMode: 'translated',
    children: [{ id: 'archive', label: 'Archive', linkType: 'custom', url: '/archive' }],
  },
  { id: 'about', label: 'About', linkType: 'custom', url: '/about', openInNewTab: true },
];
function Preview({ state = 'ready' }: { state?: 'ready' | 'empty' | 'failed' | 'pending' }) {
  const [client] = useState(() => localEditorQueryClient('menu', 'local-menu'));
  const [menuItems, setItems] = useState(state === 'empty' ? [] : initialItems);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(state === 'empty' ? null : 'local-menu');
  const [names, setNames] = useState(
    state === 'empty'
      ? []
      : [
          {
            id: 'local-menu',
            name: 'Main navigation',
            items: initialItems,
            createdAt: undefined,
            updatedAt: undefined,
          },
          { id: 'footer', name: 'Footer', items: [], createdAt: undefined, updatedAt: undefined },
        ],
  );
  const [locale, setLocale] = useState('ko');
  const [menuModalOpened, setMenuModal] = useState(false),
    [itemModalOpened, setItemModal] = useState(false),
    [deleteMenuOpened, setDeleteModal] = useState(false);
  const [editingMenuId, setEditing] = useState<string | null>(null),
    [creatingForParentId, setParent] = useState<string | null>(null),
    [deletingMenu, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [menuName, setMenuName] = useState(''),
    [formLabel, setFormLabel] = useState(''),
    [formUrl, setFormUrl] = useState('');
  const [formLinkType, setFormLinkType] = useState<MenuLinkType>('custom'),
    [formTargetId, setFormTargetId] = useState<string | null>(null),
    [formFixedLocale, setFormFixedLocale] = useState<string | null>(null);
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(false),
    [formLocalizationMode, setFormLocalizationMode] = useState<MenuItemLocalizationMode>('translated'),
    [formVisibility, setFormVisibility] = useState<MenuVisibility>({ mode: 'all' });
  const tPage = useTranslations('adminList.menus'),
    tCommon = useTranslations('common'),
    tModalActions = useTranslations('common.actions');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const selectedMenu = names.find((x) => x.id === selectedMenuId);
  const failure = {
    ...readyQuery,
    isError: state === 'failed',
    error: state === 'failed' ? new Error('Local read failed') : null,
  };
  const openCreateItemModal = (parentId?: string) => {
    setParent(parentId ?? null);
    setFormLabel('');
    setFormUrl('');
    setItemModal(true);
  };
  const model: AdminMenusPageViewModel = {
    kind: 'ready',
    menuRoom: {
      provider: null,
      setLabel: (id, value) =>
        setItems((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, label: value }
              : {
                  ...item,
                  children: item.children?.map((child) => (child.id === id ? { ...child, label: value } : child)),
                },
          ),
        ),
      useSourceLabel: (id) =>
        setItems((items) =>
          items.map((item) => {
            const source = initialItems.find((initial) => initial.id === item.id);
            return item.id === id && source
              ? { ...item, label: source.label }
              : {
                  ...item,
                  children: item.children?.map((child) => {
                    const sourceChild = source?.children?.find((initial) => initial.id === child.id);
                    return child.id === id && sourceChild ? { ...child, label: sourceChild.label } : child;
                  }),
                };
          }),
        ),
    },
    selectedMenuId,
    menusQuery: failure,
    selectedMenuFailure: readyQuery,
    targetsQuery: readyQuery,
    selectedMenuQuery: readyQuery,
    tPage,
    handleCreateMenu: () => {
      setEditing(null);
      setMenuName('');
      setMenuModal(true);
    },
    tCommon,
    menusLoading: state === 'pending',
    menus: names.map((menu) => (menu.id === selectedMenuId ? { ...menu, items: menuItems } : menu)),
    setSelectedMenuId: (id) => {
      setNames((current) => current.map((menu) => (menu.id === selectedMenuId ? { ...menu, items: menuItems } : menu)));
      setSelectedMenuId(id);
      setItems(names.find((menu) => menu.id === id)?.items ?? []);
    },
    handleEditMenu: (id, name) => {
      setEditing(id);
      setMenuName(name);
      setMenuModal(true);
    },
    canEditStructure: locale === 'ko',
    handleDeleteMenu: (id) => {
      setDeleting(names.find((x) => x.id === id) ?? null);
      setDeleteModal(true);
    },
    selectedMenuLoading: state === 'pending',
    roomState: selectedMenu ? { name: selectedMenu.name, locale, requestedLabels: {} } : null,
    selectedMenu,
    activeEditLocale: localEditLocale(locale, setLocale),
    effectiveSourceLocale: 'ko',
    openCreateItemModal,
    selectedMenuAuthoringLocked: locale !== 'ko',
    menuItems,
    canEditCurrentCopy: true,
    sensors,
    handleDragEnd: ({ active, over }) => {
      if (over) {
        setItems((items) => reorderMenuItems(items, String(active.id), String(over.id)));
      }
    },
    handleUpdateItem: (updated) => setItems((items) => replaceMenuItem(items, updated)),
    handleDeleteItem: (id) => setItems((items) => removeMenuItem(items, id)),
    handleUpdateChild: (parent, updated) => setItems((items) => replaceMenuChild(items, parent, updated)),
    handleDeleteChild: (parent, id) => setItems((items) => removeMenuChild(items, parent, id)),
    menuModalOpened,
    closeMenuModal: () => setMenuModal(false),
    editingMenuId,
    tModalActions,
    menuName,
    setMenuName,
    handleSaveMenu: () => {
      setNames((items) =>
        editingMenuId
          ? items.map((x) => (x.id === editingMenuId ? { ...x, name: menuName } : x))
          : [
              ...items,
              {
                id: `local-menu-${items.length}`,
                name: menuName,
                items: [],
                createdAt: undefined,
                updatedAt: undefined,
              },
            ],
      );
      setMenuModal(false);
    },
    isSaving: false,
    itemModalOpened,
    closeItemModal: () => setItemModal(false),
    creatingForParentId,
    formLabel,
    setFormLabel,
    formLabelOwnedBySource: true,
    formLinkType,
    setFormLinkType,
    setFormTargetId,
    formUrl,
    setFormUrl,
    formTargetId,
    formTargetSelectData: [],
    formOpenInNewTab,
    setFormOpenInNewTab,
    formLocalizationMode,
    setFormLocalizationMode,
    setFormFixedLocale,
    formFixedLocale,
    formVisibility,
    setFormVisibility,
    handleSaveItem: () => {
      setItems((items) =>
        appendMenuItem(
          items,
          {
            id: `local-item-${Date.now()}`,
            label: formLabel,
            linkType: formLinkType,
            url: formUrl,
            targetId: formTargetId ?? undefined,
            fixedLocale: formFixedLocale ?? undefined,
            openInNewTab: formOpenInNewTab,
            localizationMode: formLocalizationMode,
            visibility: formVisibility,
          },
          creatingForParentId,
        ),
      );
      setItemModal(false);
    },
    canSaveFormItem: !!formLabel.trim() && !!formUrl.trim(),
    deleteMenuOpened,
    closeDeleteMenuModal: () => setDeleteModal(false),
    deletingMenu,
    deleteMenu: {
      isPending: false,
      mutate: (id) => {
        setNames((items) => items.filter((x) => x.id !== id));
        setSelectedMenuId(null);
        setDeleteModal(false);
      },
    },
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <AdminMenusPageView model={model} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Menus',
  component: Preview,
  args: { state: 'ready' },
  render: (args) => <Preview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Complete production AdminMenusPageView including nested sortable rows and original create/edit/delete dialogs. Local menu callbacks and seeded read-only translation queries. Backend locale ownership, target discovery, collaboration and translation commands are outside.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardMenuCreation: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const create = await canvas.findByRole('button', { name: t.menus('createMenu') });
    await expect(canvas.getByRole('button', { name: `${t.common('actions.edit')} Main navigation` })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: `${t.common('actions.delete')} Footer` })).toBeEnabled();
    create.focus();
    await userEvent.keyboard('{Enter}');
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await expect(dialog).toContainElement(canvasElement.ownerDocument.activeElement as HTMLElement);
    const name = within(dialog).getByRole('textbox');
    await userEvent.type(name, 'Keyboard menu');
    const save = within(dialog).getByRole('button', {
      name: t.common('actions.createItem', { item: t.common('entities.menu') }),
    });
    save.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(create).toHaveFocus());
    await expect(canvas.getByRole('button', { name: `${t.common('actions.delete')} Keyboard menu` })).toBeEnabled();
  },
};

export const KeyboardMenuReordering: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const name = t.dataTable('sort.aria.reorder', { label: 'Listening room' });
    const handle = await canvas.findByRole('button', { name });
    const instructionsId = handle.getAttribute('aria-describedby')!;
    const instructions = canvasElement.ownerDocument.getElementById(instructionsId)!;
    await expect(instructions).toHaveTextContent(t.reorder('dragInstructions'));
    handle.focus();
    await userEvent.keyboard(' ');
    const liveRegion = canvasElement.ownerDocument.querySelector('[id^="DndLiveRegion"]')!;
    await expect(liveRegion).toHaveTextContent('Main navigation · Listening room');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    await waitFor(() => {
      const handles = within(canvas.getByRole('group', { name: 'Main navigation' })).getAllByRole('button', {
        name: new RegExp('Listening room|About'),
      });
      const names = handles.map((button) => button.getAttribute('aria-label'));
      expect(names.indexOf(t.dataTable('sort.aria.reorder', { label: 'About' }))).toBeLessThan(names.indexOf(name));
    });
    await waitFor(() =>
      expect(liveRegion).toHaveTextContent(
        t.reorder('dragEnd', { section: 'Main navigation · Listening room', index: 2, count: 2 }),
      ),
    );
    await expect(canvas.getByRole('button', { name })).toHaveFocus();
  },
};
