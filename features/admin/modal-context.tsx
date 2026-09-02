'use client';

import { createContext, useCallback, useContext, useMemo, useState, type Context, type ReactNode } from 'react';

interface DeleteModalContextValue<TEntity> {
  deleting: TEntity | null;
  openDelete: (entity: TEntity) => void;
  closeDelete: () => void;
}

interface CreateDeleteModalContextValue<TEntity> extends DeleteModalContextValue<TEntity> {
  isCreateOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
}

interface CrudModalContextValue<TEntity> extends CreateDeleteModalContextValue<TEntity> {
  editing: TEntity | null;
  openEdit: (entity: TEntity) => void;
  closeEdit: () => void;
}

function useRequiredContext<TValue>(context: Context<TValue | null>, displayName: string): TValue {
  const value = useContext(context);
  if (value === null) {
    throw new Error(`use${displayName}Modal must be used within ${displayName}ModalProvider`);
  }
  return value;
}

export function createDeleteModalContext<TEntity>(displayName: string) {
  const Context = createContext<DeleteModalContextValue<TEntity> | null>(null);

  function useModal() {
    return useRequiredContext(Context, displayName);
  }

  function Provider({ children }: { children: ReactNode }) {
    const [deleting, setDeleting] = useState<TEntity | null>(null);
    const closeDelete = useCallback(() => setDeleting(null), []);
    const value = useMemo(() => ({ deleting, openDelete: setDeleting, closeDelete }), [closeDelete, deleting]);

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  Provider.displayName = `${displayName}ModalProvider`;
  return { Provider, useModal };
}

export function createCreateDeleteModalContext<TEntity>(displayName: string) {
  const Context = createContext<CreateDeleteModalContextValue<TEntity> | null>(null);

  function useModal() {
    return useRequiredContext(Context, displayName);
  }

  function Provider({ children }: { children: ReactNode }) {
    const [deleting, setDeleting] = useState<TEntity | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const closeDelete = useCallback(() => setDeleting(null), []);
    const openCreate = useCallback(() => setIsCreateOpen(true), []);
    const closeCreate = useCallback(() => setIsCreateOpen(false), []);
    const value = useMemo(
      () => ({ deleting, openDelete: setDeleting, closeDelete, isCreateOpen, openCreate, closeCreate }),
      [closeCreate, closeDelete, deleting, isCreateOpen, openCreate],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  Provider.displayName = `${displayName}ModalProvider`;
  return { Provider, useModal };
}

export function createCrudModalContext<TEntity>(displayName: string) {
  const Context = createContext<CrudModalContextValue<TEntity> | null>(null);

  function useModal() {
    return useRequiredContext(Context, displayName);
  }

  function Provider({ children }: { children: ReactNode }) {
    const [editing, setEditing] = useState<TEntity | null>(null);
    const [deleting, setDeleting] = useState<TEntity | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const closeEdit = useCallback(() => setEditing(null), []);
    const closeDelete = useCallback(() => setDeleting(null), []);
    const openCreate = useCallback(() => setIsCreateOpen(true), []);
    const closeCreate = useCallback(() => setIsCreateOpen(false), []);
    const value = useMemo(
      () => ({
        editing,
        openEdit: setEditing,
        closeEdit,
        deleting,
        openDelete: setDeleting,
        closeDelete,
        isCreateOpen,
        openCreate,
        closeCreate,
      }),
      [closeCreate, closeDelete, closeEdit, deleting, editing, isCreateOpen, openCreate],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  Provider.displayName = `${displayName}ModalProvider`;
  return { Provider, useModal };
}
