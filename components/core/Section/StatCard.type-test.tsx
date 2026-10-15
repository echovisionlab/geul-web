import { IconUsers } from '@tabler/icons-react';
import { StatCard } from './StatCard';

<StatCard label="Users" value="1,284" icon={IconUsers} href="/admin/users" prefetch={false} />;
// @ts-expect-error Core owns glyph size and stroke; pass the glyph component.
<StatCard label="Users" value="1,284" icon={<IconUsers size={20} stroke={1.5} />} />;
// @ts-expect-error Visual overrides remain closed.
<StatCard label="Users" value="1,284" style={{ padding: 0 }} />;
