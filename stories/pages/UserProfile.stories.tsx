import { useState } from 'react';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
import { UserProfileView } from '@/features/user/ui/UserProfile';
function UserProfilePagePreview({
  admin = false,
  initiallyBanned = false,
  pending = false,
}: {
  admin?: boolean;
  initiallyBanned?: boolean;
  pending?: boolean;
}) {
  const t = useTranslations('userProfile');
  const c = useTranslations('common');
  const s = useTranslations('socialLinks');
  const [dialog, setDialog] = useState<'ban' | 'role' | 'delete' | null>(null);
  const [banned, setBanned] = useState(initiallyBanned);
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<string | null>('author');
  const [savedRole, setSavedRole] = useState<string | null>('author');
  const [deleted, setDeleted] = useState(false);
  const close = () => {
    if (!pending) {
      setDialog(null);
    }
  };
  const dialogLabels = { cancel: c('actions.cancel'), close: c('actions.close') };
  return (
    <LayoutContainer size="wide" inset="md">
      {deleted ? (
        <Alert tone="positive" role="status">
          {c('messages.itemDeleted', { item: 'June Han' })}
        </Alert>
      ) : (
        <UserProfileView
          profile={{
            name: 'June Han',
            initials: 'JH',
            avatarUrl: null,
            roleLabel:
              savedRole === 'admin' ? c('roles.admin') : savedRole === 'user' ? c('roles.user') : c('roles.author'),
            joinedLabel: null,
            bio: 'Field recordings, sound installations, and a notebook of everyday listening.',
            socialLinks: [],
            banned,
            banReason: banned && reason ? reason : null,
            showAdminActions: admin,
          }}
          labels={{
            title: t('title'),
            back: c('actions.back'),
            socialLinks: s('label'),
            banned: t('states.banned'),
            changeRole: c('actions.changeRole'),
            ban: t('actions.ban'),
            unban: t('actions.unban'),
            delete: c('actions.delete'),
            banDialog: {
              ...dialogLabels,
              title: t('modals.ban.title'),
              description: t.rich('modals.ban.description', {
                name: 'June Han',
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              reason: t('modals.ban.reasonLabel'),
              reasonPlaceholder: t('modals.ban.reasonPlaceholder'),
              confirm: t('modals.ban.title'),
            },
            roleDialog: {
              ...dialogLabels,
              title: c('actions.changeRole'),
              role: c('labels.role'),
              confirm: t('modals.role.confirm'),
            },
            deleteDialog: {
              ...dialogLabels,
              title: t('modals.delete.title'),
              description: t.rich('modals.delete.description', {
                name: 'June Han',
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              warning: t('modals.delete.warning'),
              confirm: c('actions.delete'),
            },
          }}
          dialogs={{
            ban: { opened: dialog === 'ban', pending, error: null, reason },
            role: {
              opened: dialog === 'role',
              pending,
              error: null,
              value: role,
              options: [
                { value: 'user', label: c('roles.user') },
                { value: 'author', label: c('roles.author') },
                { value: 'admin', label: c('roles.admin') },
              ],
            },
            delete: { opened: dialog === 'delete', pending, error: null },
          }}
          events={{
            onBack: goBackPreview,
            onOpenBan: () => setDialog('ban'),
            onCloseBan: close,
            onBanReasonChange: setReason,
            onConfirmBan: () => {
              if (!pending) {
                setBanned(true);
                close();
              }
            },
            onUnban: () => setBanned(false),
            onOpenRole: () => {
              setRole(savedRole);
              setDialog('role');
            },
            onCloseRole: () => {
              setRole(savedRole);
              close();
            },
            onRoleChange: setRole,
            onConfirmRole: () => {
              if (!pending) {
                setSavedRole(role);
                close();
              }
            },
            onOpenDelete: () => setDialog('delete'),
            onCloseDelete: close,
            onConfirmDelete: () => {
              if (!pending) {
                setDeleted(true);
                close();
              }
            },
          }}
          unbanPending={pending}
        />
      )}
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/User/Profile',
  component: UserProfilePagePreview,
  args: { admin: false, initiallyBanned: false, pending: false },
  render: (args) => <UserProfilePagePreview key={`${args.admin}-${args.initiallyBanned}-${args.pending}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production profile section with local ban/unban, role and deletion state. Back navigation opens the preceding mapped Storybook preview.',
      },
    },
  },
} satisfies Meta<typeof UserProfilePagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Public: Story = {};
export const AdminActions: Story = { args: { admin: true } };
export const Banned: Story = { args: { admin: true, initiallyBanned: true } };
export const Pending: Story = { args: { admin: true, pending: true } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
