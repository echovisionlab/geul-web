/**
 * `PhoneField` brings `libphonenumber-js` (about 36 kB gzip). Forms load it only when they have a phone
 * field (`FormRenderer` preloads it then); the form builder imports it statically.
 */
export const loadPhoneField = () => import('./fields/PhoneField');
