'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface UserModalTarget {
  id: string;
  nickname: string;
  role: string | null;
  status: string;
  banned: boolean;
  newsletter_subscribed: boolean;
}

interface UserModalContextValue {
  // Ban modal
  banningUser: UserModalTarget | null;
  openBan: (user: UserModalTarget) => void;
  closeBan: () => void;
  // Role modal
  roleUser: UserModalTarget | null;
  openRole: (user: UserModalTarget) => void;
  closeRole: () => void;
  // Delete modal
  deletingUser: UserModalTarget | null;
  openDelete: (user: UserModalTarget) => void;
  closeDelete: () => void;
  newsletterUser: UserModalTarget | null;
  openNewsletterUnsubscribe: (user: UserModalTarget) => void;
  closeNewsletterUnsubscribe: () => void;
}

const UserModalContext = createContext<UserModalContextValue | null>(null);

export function useUserModal() {
  const context = useContext(UserModalContext);
  if (!context) {
    throw new Error('useUserModal must be used within UserModalProvider');
  }
  return context;
}

export function UserModalProvider({ children }: { children: ReactNode }) {
  const [banningUser, setBanningUser] = useState<UserModalTarget | null>(null);
  const [roleUser, setRoleUser] = useState<UserModalTarget | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserModalTarget | null>(null);
  const [newsletterUser, setNewsletterUser] = useState<UserModalTarget | null>(null);

  const value: UserModalContextValue = {
    banningUser,
    openBan: setBanningUser,
    closeBan: () => setBanningUser(null),
    roleUser,
    openRole: setRoleUser,
    closeRole: () => setRoleUser(null),
    deletingUser,
    openDelete: setDeletingUser,
    closeDelete: () => setDeletingUser(null),
    newsletterUser,
    openNewsletterUnsubscribe: setNewsletterUser,
    closeNewsletterUnsubscribe: () => setNewsletterUser(null),
  };

  return <UserModalContext.Provider value={value}>{children}</UserModalContext.Provider>;
}
