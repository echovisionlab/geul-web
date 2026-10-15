'use client';

import type { ComponentProps } from 'react';
import { deleteUserAction } from '@/lib/actions/user';
import { UserRowMenu } from './UserRowMenu';
import { UsersTableView, type UserRow } from './UsersTableView';

type UsersTableContentProps = Omit<ComponentProps<typeof UsersTableView>, 'renderActions' | 'deleteAction'> & {
  deleteAction?: ComponentProps<typeof UsersTableView>['deleteAction'];
};

export function UsersTableContent({ deleteAction = deleteUserAction, ...props }: UsersTableContentProps) {
  return (
    <UsersTableView
      {...props}
      deleteAction={deleteAction}
      renderActions={(user: UserRow) => <UserRowMenu user={user} />}
    />
  );
}
