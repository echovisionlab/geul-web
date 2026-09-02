'use client';

import type { ComponentProps } from 'react';
import { deleteUserAction } from '@/lib/actions/user';
import { UserRowMenu } from './UserRowMenu';
import { UsersTableView, type UserRow } from './UsersTableView';

type UsersTableContentProps = Omit<ComponentProps<typeof UsersTableView>, 'deleteAction' | 'renderActions'>;

export function UsersTableContent(props: UsersTableContentProps) {
  return (
    <UsersTableView
      {...props}
      deleteAction={deleteUserAction}
      renderActions={(user: UserRow) => <UserRowMenu user={user} />}
    />
  );
}
