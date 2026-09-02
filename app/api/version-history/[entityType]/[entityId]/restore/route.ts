import { NextResponse } from 'next/server';
import { parseVersionEntityType, restoreVersion, toVersionErrorResult } from '@/lib/server/version-history';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{
    entityType: string;
    entityId: string;
  }>;
}

export async function POST(request: Request, { params }: Params) {
  const { entityType, entityId } = await params;
  const parsedEntityType = parseVersionEntityType(entityType);

  if (!parsedEntityType) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { versionId?: string } | null;
  if (!body?.versionId) {
    return NextResponse.json({ error: 'Missing version id' }, { status: 400 });
  }

  try {
    const result = await restoreVersion(parsedEntityType, entityId, body.versionId);
    return NextResponse.json(result);
  } catch (err) {
    const { status, error } = toVersionErrorResult(err, 'Failed to restore version');
    return NextResponse.json({ error }, { status });
  }
}
