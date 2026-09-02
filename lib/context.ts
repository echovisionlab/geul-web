import type { Context } from '@/lib/types/context/context';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getSession } from '@/lib/utils/session.server';

/**
 * Creates a request context for server actions.
 * Provides Member authorization, IP address, and geo-location information.
 * GeoIP data is fetched from the backend API via getSession().
 */
export const createContext = async (): Promise<Context> => {
  const [hdrs, auth] = await Promise.all([getRequestHeaders(), getSession()]);

  const xff = hdrs.get('x-forwarded-for');
  const realIp = hdrs.get('x-real-ip');
  const ipAddress = xff?.split(',')[0].trim() || realIp || 'anonymous';

  // GeoIP info comes from the backend API response
  const geo = auth?.geo ?? null;

  const member = auth?.user
    ? {
        id: auth.user.id,
        nickname: auth.user.nickname,
        role: auth.user.role ?? null,
        status: auth.user.status,
        image: auth.user.image ?? null,
      }
    : null;

  return {
    member,
    requestId: crypto.randomUUID(),
    ipAddress,
    userAgent: hdrs.get('user-agent') || undefined,
    countryCode: geo?.countryCode ?? null,
    countryName: geo?.countryName ?? null,
    city: geo?.city ?? null,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    isProxy: geo?.isProxy ?? false,
    isSatellite: geo?.isSatellite ?? false,
  };
};
