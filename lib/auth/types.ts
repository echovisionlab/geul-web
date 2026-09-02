export interface SessionUser {
  id: string;
  nickname: string;
  email: string | null;
  image: string | null;
  preferred_locale: string | null;
  role: 'admin' | 'author' | 'user';
  status: 'active' | 'banned' | 'pending_deletion' | 'deleted';
}

export interface GeoInfo {
  countryCode: string;
  countryName: string;
  city: string | null;
  latitude: number;
  longitude: number;
  isProxy: boolean;
  isSatellite: boolean;
  timeZone: string | null;
}

export interface SessionWithUser {
  user: SessionUser;
  account_identity_id: string;
  geo: GeoInfo | null;
  onboarded: boolean;
  nickname_suggestion: string | null;
}
