export const dynamic = 'force-static';

export function GET() {
  return Response.json({ status: 'ok' }, { status: 200 });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
