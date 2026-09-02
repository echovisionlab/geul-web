/**
 * Generate phone countries metadata from libphonenumber-js
 * Run: node scripts/generate-phone-countries.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const { getCountries, getCountryCallingCode, getExampleNumber } = require('libphonenumber-js');
const examples = require('libphonenumber-js/examples.mobile.json');

// Country names in English
const COUNTRY_NAMES = {
  KR: 'South Korea',
  US: 'United States',
  CN: 'China',
  JP: 'Japan',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  CA: 'Canada',
  AU: 'Australia',
  BR: 'Brazil',
  IN: 'India',
  RU: 'Russia',
  MX: 'Mexico',
  SG: 'Singapore',
  HK: 'Hong Kong',
  TW: 'Taiwan',
  VN: 'Vietnam',
  TH: 'Thailand',
  PH: 'Philippines',
  MY: 'Malaysia',
  ID: 'Indonesia',
  NZ: 'New Zealand',
  AF: 'Afghanistan',
  AL: 'Albania',
  DZ: 'Algeria',
  AD: 'Andorra',
  AO: 'Angola',
  AG: 'Antigua and Barbuda',
  AR: 'Argentina',
  AM: 'Armenia',
  AT: 'Austria',
  AZ: 'Azerbaijan',
  BS: 'Bahamas',
  BH: 'Bahrain',
  BD: 'Bangladesh',
  BB: 'Barbados',
  BY: 'Belarus',
  BE: 'Belgium',
  BZ: 'Belize',
  BJ: 'Benin',
  BT: 'Bhutan',
  BO: 'Bolivia',
  BA: 'Bosnia and Herzegovina',
  BW: 'Botswana',
  BN: 'Brunei',
  BG: 'Bulgaria',
  BF: 'Burkina Faso',
  BI: 'Burundi',
  CV: 'Cabo Verde',
  KH: 'Cambodia',
  CM: 'Cameroon',
  CF: 'Central African Republic',
  TD: 'Chad',
  CL: 'Chile',
  CO: 'Colombia',
  KM: 'Comoros',
  CD: 'DR Congo',
  CG: 'Congo',
  CR: 'Costa Rica',
  HR: 'Croatia',
  CU: 'Cuba',
  CY: 'Cyprus',
  CZ: 'Czech Republic',
  DK: 'Denmark',
  DJ: 'Djibouti',
  DM: 'Dominica',
  DO: 'Dominican Republic',
  EC: 'Ecuador',
  EG: 'Egypt',
  SV: 'El Salvador',
  GQ: 'Equatorial Guinea',
  ER: 'Eritrea',
  EE: 'Estonia',
  SZ: 'Eswatini',
  ET: 'Ethiopia',
  FJ: 'Fiji',
  FI: 'Finland',
  GA: 'Gabon',
  GM: 'Gambia',
  GE: 'Georgia',
  GH: 'Ghana',
  GR: 'Greece',
  GD: 'Grenada',
  GT: 'Guatemala',
  GN: 'Guinea',
  GW: 'Guinea-Bissau',
  GY: 'Guyana',
  HT: 'Haiti',
  HN: 'Honduras',
  HU: 'Hungary',
  IS: 'Iceland',
  IR: 'Iran',
  IQ: 'Iraq',
  IE: 'Ireland',
  IL: 'Israel',
  CI: 'Ivory Coast',
  JM: 'Jamaica',
  JO: 'Jordan',
  KZ: 'Kazakhstan',
  KE: 'Kenya',
  KI: 'Kiribati',
  KW: 'Kuwait',
  KG: 'Kyrgyzstan',
  LA: 'Laos',
  LV: 'Latvia',
  LB: 'Lebanon',
  LS: 'Lesotho',
  LR: 'Liberia',
  LY: 'Libya',
  LI: 'Liechtenstein',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MG: 'Madagascar',
  MW: 'Malawi',
  MV: 'Maldives',
  ML: 'Mali',
  MT: 'Malta',
  MH: 'Marshall Islands',
  MR: 'Mauritania',
  MU: 'Mauritius',
  FM: 'Micronesia',
  MD: 'Moldova',
  MC: 'Monaco',
  MN: 'Mongolia',
  ME: 'Montenegro',
  MA: 'Morocco',
  MZ: 'Mozambique',
  MM: 'Myanmar',
  NA: 'Namibia',
  NR: 'Nauru',
  NP: 'Nepal',
  NL: 'Netherlands',
  NI: 'Nicaragua',
  NE: 'Niger',
  NG: 'Nigeria',
  KP: 'North Korea',
  MK: 'North Macedonia',
  NO: 'Norway',
  OM: 'Oman',
  PK: 'Pakistan',
  PW: 'Palau',
  PS: 'Palestine',
  PA: 'Panama',
  PG: 'Papua New Guinea',
  PY: 'Paraguay',
  PE: 'Peru',
  PL: 'Poland',
  PT: 'Portugal',
  QA: 'Qatar',
  RO: 'Romania',
  RW: 'Rwanda',
  KN: 'Saint Kitts and Nevis',
  LC: 'Saint Lucia',
  VC: 'Saint Vincent and the Grenadines',
  WS: 'Samoa',
  SM: 'San Marino',
  ST: 'Sao Tome and Principe',
  SA: 'Saudi Arabia',
  SN: 'Senegal',
  RS: 'Serbia',
  SC: 'Seychelles',
  SL: 'Sierra Leone',
  SK: 'Slovakia',
  SI: 'Slovenia',
  SB: 'Solomon Islands',
  SO: 'Somalia',
  ZA: 'South Africa',
  SS: 'South Sudan',
  LK: 'Sri Lanka',
  SD: 'Sudan',
  SR: 'Suriname',
  SE: 'Sweden',
  CH: 'Switzerland',
  SY: 'Syria',
  TJ: 'Tajikistan',
  TZ: 'Tanzania',
  TL: 'Timor-Leste',
  TG: 'Togo',
  TO: 'Tonga',
  TT: 'Trinidad and Tobago',
  TN: 'Tunisia',
  TR: 'Turkey',
  TM: 'Turkmenistan',
  TV: 'Tuvalu',
  UG: 'Uganda',
  UA: 'Ukraine',
  AE: 'United Arab Emirates',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VU: 'Vanuatu',
  VA: 'Vatican City',
  VE: 'Venezuela',
  YE: 'Yemen',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};

// Priority countries (shown first)
const PRIORITY_COUNTRIES = ['KR', 'US', 'CN', 'JP', 'GB', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU'];

function getFlagEmoji(countryCode) {
  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
}

function formatExampleNumber(countryCode) {
  try {
    const example = getExampleNumber(countryCode, examples);
    if (example) {
      return example.formatNational();
    }
  } catch {
    // Ignore errors
  }
  return '';
}

function generate() {
  const countries = getCountries();

  const phoneCountries = countries
    .map((code) => {
      const name = COUNTRY_NAMES[code];
      if (!name) return null;

      return {
        code,
        name,
        flag: getFlagEmoji(code),
        dialCode: `+${getCountryCallingCode(code)}`,
        placeholder: formatExampleNumber(code),
        priority: PRIORITY_COUNTRIES.indexOf(code) >= 0 ? PRIORITY_COUNTRIES.indexOf(code) + 1 : 999,
      };
    })
    .filter((c) => c !== null)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });

  const output = `/**
 * Phone country metadata
 * Auto-generated by scripts/generate-phone-countries.cjs
 * DO NOT EDIT MANUALLY
 */

export interface PhoneCountry {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  placeholder: string;
  priority: number;
}

export const PHONE_COUNTRIES: PhoneCountry[] = ${JSON.stringify(phoneCountries, null, 2)};

export const DEFAULT_COUNTRY_CODE = 'KR';

export function getCountryByCode(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.code === code);
}

export function getCountryByDialCode(dialCode: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.dialCode === dialCode);
}
`;

  const outputPath = path.join(__dirname, '../lib/constants/phone-countries.ts');
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`Generated ${phoneCountries.length} countries to ${outputPath}`);
}

generate();
