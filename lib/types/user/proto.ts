import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { AccountStatus } from '@echovisionlab/geul-proto/secure/account_pb.ts';

export function accountRoleToString(role: AuthorizationRole): 'user' | 'admin' | 'author' {
  switch (role) {
    case AuthorizationRole.ADMIN:
      return 'admin';
    case AuthorizationRole.AUTHOR:
      return 'author';
    default:
      return 'user';
  }
}

export function accountStatusToString(status: AccountStatus): 'active' | 'banned' | 'pending_deletion' | 'deleted' {
  switch (status) {
    case AccountStatus.BANNED:
      return 'banned';
    case AccountStatus.PENDING_DELETION:
      return 'pending_deletion';
    case AccountStatus.DELETED:
      return 'deleted';
    default:
      return 'active';
  }
}
