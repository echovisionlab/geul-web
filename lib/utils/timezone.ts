/**
 * Timezone utilities for date field
 */

interface TimezoneOption {
  value: string; // IANA timezone (Asia/Seoul)
  label: string; // Display name
  country: string; // Country code (KR)
  offset: string; // UTC offset (+09:00)
}

/**
 * Common timezones list (frequently used)
 */
export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)', country: 'KR', offset: '+09:00' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)', country: 'JP', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)', country: 'CN', offset: '+08:00' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT)', country: 'HK', offset: '+08:00' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)', country: 'SG', offset: '+08:00' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)', country: 'TH', offset: '+07:00' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)', country: 'IN', offset: '+05:30' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)', country: 'AE', offset: '+04:00' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)', country: 'GB', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)', country: 'FR', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)', country: 'DE', offset: '+01:00' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK)', country: 'RU', offset: '+03:00' },
  {
    value: 'America/New_York',
    label: 'America/New_York (EST/EDT)',
    country: 'US',
    offset: '-05:00',
  },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)', country: 'US', offset: '-06:00' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)', country: 'US', offset: '-07:00' },
  {
    value: 'America/Los_Angeles',
    label: 'America/Los_Angeles (PST/PDT)',
    country: 'US',
    offset: '-08:00',
  },
  { value: 'America/Toronto', label: 'America/Toronto (EST/EDT)', country: 'CA', offset: '-05:00' },
  {
    value: 'America/Vancouver',
    label: 'America/Vancouver (PST/PDT)',
    country: 'CA',
    offset: '-08:00',
  },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)', country: 'BR', offset: '-03:00' },
  {
    value: 'Australia/Sydney',
    label: 'Australia/Sydney (AEST/AEDT)',
    country: 'AU',
    offset: '+11:00',
  },
  {
    value: 'Australia/Melbourne',
    label: 'Australia/Melbourne (AEST/AEDT)',
    country: 'AU',
    offset: '+11:00',
  },
  {
    value: 'Pacific/Auckland',
    label: 'Pacific/Auckland (NZST/NZDT)',
    country: 'NZ',
    offset: '+13:00',
  },
  { value: 'UTC', label: 'UTC', country: '', offset: '+00:00' },
];

/**
 * Get timezone display label
 */
export function getTimezoneLabel(timezone: string): string {
  const option = COMMON_TIMEZONES.find((t) => t.value === timezone);
  return option?.label ?? timezone;
}
