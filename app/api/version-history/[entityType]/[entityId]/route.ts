import { NextResponse } from 'next/server';
import { listVersions, parseVersionEntityType, toVersionErrorResult } from '@/lib/server/version-history';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{
    entityType: string;
    entityId: string;
  }>;
}

export async function GET(request: Request, { params }: Params) {
  const { entityType, entityId } = await params;
  const parsedEntityType = parseVersionEntityType(entityType);

  if (!parsedEntityType) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Number.isSafeInteger((page - 1) * pageSize) ||
    (page - 1) * pageSize > 2_147_483_647
  ) {
    return NextResponse.json({ error: 'Invalid pagination' }, { status: 400 });
  }

  try {
    const result = await listVersions(parsedEntityType, entityId, page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    const { status, error } = toVersionErrorResult(err, 'Failed to fetch versions');
    return NextResponse.json({ error }, { status });
  }
}
