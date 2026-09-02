/**
 * Unified context for all services and tRPC procedures.
 */
export interface Context {
  // Auth
  member: {
    id: string;
    nickname: string;
    role: string | null;
    status: string;
    image: string | null;
  } | null;
  // Request
  requestId: string;
  ipAddress: string;
  userAgent: string | undefined;

  // Geo
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isProxy: boolean;
  isSatellite: boolean;

  // Path (for audit logging in procedures)
  path?: string;
}
