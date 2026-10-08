import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getSettings } from '@/lib/queries/manifest';
import { toHttpErrorResult } from '@/lib/api/http-error';
import { ogPreviewInput } from '@/lib/server/og-preview-input';
import { createLogger } from '@/lib/utils/logger';
import {
  DEFAULT_CONTENT_OG_CONFIG,
  DEFAULT_HOME_OG_CONFIG,
  generateHomeOgImage,
  generateOgImage,
} from '@/lib/utils/og-image';

const logger = createLogger('og-preview-api');

export const dynamic = 'force-dynamic';

/**
 * Fetch an image URL and return it as a data URL (base64)
 */
async function fetchImageAsDataUrl(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return undefined;
    }
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  // Check admin permission
  let session;
  try {
    session = await getSessionFromCookie({ throwOnError: true });
  } catch (error) {
    logger.error('Failed to check preview permission', { error });
    const result = toHttpErrorResult(error, 'Failed to check preview permission');
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let decoded: unknown;
  try {
    decoded = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ogPreviewInput.safeParse(decoded);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid preview request' }, { status: 400 });
  }
  const body = parsed.data;
  try {
    // Get site settings for the preview
    const settings = await getSettings();

    // Get logo as PNG data URL if available
    let logoDataUrl: string | undefined;
    if (settings.logo_url) {
      logoDataUrl = await fetchImageAsDataUrl(settings.logo_url);
    }

    const ogSettings = {
      siteTitle: settings.site_title || 'Site',
      primaryColor: settings.primary_color || '#b02d23',
      logoSvg: logoDataUrl,
    };

    let imageBuffer: Buffer;

    if (body.type === 'home') {
      // Generate home OG image (logo-centered, no title)
      imageBuffer = await generateHomeOgImage(ogSettings, body.config || DEFAULT_HOME_OG_CONFIG);
    } else {
      // Generate content OG image (title-centered)
      const { title, config } = body;
      if (!title) {
        return NextResponse.json({ error: 'Title is required for content type' }, { status: 400 });
      }
      imageBuffer = await generateOgImage(title, ogSettings, config || DEFAULT_CONTENT_OG_CONFIG);
    }

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('Error generating preview', { error });
    const { status, error: message } = toHttpErrorResult(error, 'Failed to generate preview');
    return NextResponse.json({ error: message }, { status });
  }
}
