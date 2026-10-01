// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { BlockRoomMetadataError } from '@/lib/collab/block-room-metadata';
import type { BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useDebouncedRoomMetadata } from './useDebouncedRoomMetadata';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

type Connection = Pick<BlockRoomConnection, 'protocol' | 'bootstrap' | 'acceptEpochAck' | 'reloadCanonical'>;
type Ack = Parameters<Connection['acceptEpochAck']>[0];
let root: Root;
let edit: ReturnType<typeof useDebouncedRoomMetadata<{ title: string }>>;
const ack = {} as Ack;
function connection(): Connection {
  return {
    protocol: {} as Connection['protocol'],
    bootstrap: {} as Connection['bootstrap'],
    acceptEpochAck: vi.fn(() => true),
    reloadCanonical: vi.fn(),
  };
}
function Editor({ room, write }: { room: Connection; write: () => Promise<Ack> }) {
  edit = useDebouncedRoomMetadata({ connection: room, document: 'work:one', write });
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  root = createRoot(document.createElement('div'));
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

it('reports failure and retains metadata for a retry before allowing a locale change', async () => {
  const room = connection();
  const write = vi.fn().mockRejectedValueOnce(new Error('permission denied')).mockResolvedValue(ack);
  act(() => root.render(<Editor room={room} write={write} />));
  act(() => edit({ title: 'draft' }));
  await act(async () => {
    expect(await edit.flush()).toBe(false);
  });
  expect(room.acceptEpochAck).not.toHaveBeenCalled();
  expect(notifications.show).toHaveBeenCalledWith({ message: 'permission denied', color: 'red' });
  await act(async () => {
    expect(await edit.flush()).toBe(true);
  });
  expect(write).toHaveBeenLastCalledWith(room.protocol, { title: 'draft' });
  expect(room.acceptEpochAck).toHaveBeenCalledExactlyOnceWith(ack);
});

it.each(['ack', 'error'] as const)('ignores a disposed room %s after a new room becomes active', async (result) => {
  const oldRoom = connection(),
    newRoom = connection();
  let finish!: (ack: Ack) => void, fail!: (error: Error) => void;
  const write = () =>
    new Promise<Ack>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
  act(() => root.render(<Editor room={oldRoom} write={write} />));
  act(() => edit({ title: 'old locale' }));
  const saved = edit.flush();
  act(() => root.render(<Editor room={newRoom} write={vi.fn()} />));
  await act(async () => {
    if (result === 'ack') {
      finish(ack);
    } else {
      fail(new BlockRoomMetadataError('obsolete', true));
    }
    await saved;
  });
  expect(oldRoom.acceptEpochAck).not.toHaveBeenCalled();
  expect(oldRoom.reloadCanonical).not.toHaveBeenCalled();
  expect(newRoom.acceptEpochAck).not.toHaveBeenCalled();
  expect(newRoom.reloadCanonical).not.toHaveBeenCalled();
  expect(notifications.show).not.toHaveBeenCalled();
});

it('retains pending intent across reconnect and uses the fresh room writer and ACK handler', async () => {
  const old = connection();
  const documentName = 'work:one:ko';
  old.protocol = { documentName } as Connection['protocol'];
  old.bootstrap = { documentName } as Connection['bootstrap'];
  const failed = vi.fn().mockRejectedValue(new BlockRoomMetadataError('reload', true));
  act(() => root.render(<Editor room={old} write={failed} />));
  act(() => edit({ title: 'pending' }));
  await act(async () => {
    expect(await edit.flush()).toBe(false);
  });
  act(() => root.render(<Editor room={{ ...old, protocol: null, bootstrap: null }} write={failed} />));
  expect(edit.hasPending()).toBe(true);
  const fresh = connection();
  fresh.protocol = { documentName } as Connection['protocol'];
  fresh.bootstrap = { documentName } as Connection['bootstrap'];
  const saved = vi.fn().mockResolvedValue(ack);
  await act(async () => {
    root.render(<Editor room={fresh} write={saved} />);
  });
  expect(saved).toHaveBeenCalledWith(fresh.protocol, { title: 'pending' });
  expect(fresh.acceptEpochAck).toHaveBeenCalledExactlyOnceWith(ack);
  expect(old.acceptEpochAck).not.toHaveBeenCalled();
  expect(edit.hasPending()).toBe(false);
});
