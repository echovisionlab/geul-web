import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ShareLinkItemSchema, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import type { ShareLinkServices } from '@/features/share/ShareLinkServicesContext';

/** Both form preview and dashboard links retain independent local records. */
export function formShareLinkFixture(): ShareLinkServices {
  const records = new Map<string, ShareLinkItem[]>();
  const key = (type: string, id: string) => `${type}:${id}`;
  return {
    list: async (type, id) => records.get(key(type, id)) ?? [],
    create: async (type, id, options) => {
      const token = crypto.randomUUID();
      const record = create(ShareLinkItemSchema, {
        id: token,
        token,
        label: options?.label,
        hasPassword: Boolean(options?.password),
        expiresAt: timestampFromDate(options?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        createdAt: timestampFromDate(new Date()),
        url: `https://example.test/s/${token}`,
      });
      records.set(key(type, id), [...(records.get(key(type, id)) ?? []), record]);
    },
    remove: async (type, id, linkId) => {
      records.set(
        key(type, id),
        (records.get(key(type, id)) ?? []).filter((record) => record.id !== linkId),
      );
    },
  };
}
