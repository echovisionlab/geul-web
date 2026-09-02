export interface GeoIPInfo {
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isProxy: boolean;
  isSatellite: boolean;
}

export interface GeoIPMetadata {
  buildEpoch: Date | null;
  importedAt: Date;
}

export interface GeoIPLocationRow {
  geoname_id: number;
  continent_code: string | null;
  continent_name: string | null;
  country_iso_code: string | null;
  country_name: string | null;
  subdivision_1_iso_code: string | null;
  subdivision_1_name: string | null;
  subdivision_2_iso_code: string | null;
  subdivision_2_name: string | null;
  city_name: string | null;
  metro_code: number | null;
  time_zone: string | null;
  is_in_european_union: boolean;
}

export interface GeoIPNetworkRow {
  network: string;
  geoname_id: number | null;
  registered_country_geoname_id: number | null;
  represented_country_geoname_id: number | null;
  is_anonymous_proxy: boolean;
  is_satellite_provider: boolean;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_radius: number | null;
}

export interface NewLocationLoginParams {
  email: string;
  userName: string | null;
  loginCountry: string;
  loginIp: string;
  loginTime: Date;
  loginProvider: string;
}
