import { describe, expect, it } from 'vitest';
import { isMenuItemLabelApplicableToLocale, type MenuTranslationItem } from './menu-translation-model';

describe('menu translation model', () => {
  it('limits fixed labels to their exact locale', () => {
    const fixed: MenuTranslationItem = {
      id: 'brand',
      label: 'Brand',
      linkType: 'custom',
      localizationMode: 'fixed_locale',
      fixedLocale: 'ko-KR',
    };
    expect(isMenuItemLabelApplicableToLocale(fixed, 'ko-KR')).toBe(true);
    expect(isMenuItemLabelApplicableToLocale(fixed, 'en')).toBe(false);
  });

  it('lets translated labels follow every requested locale', () => {
    const translated: MenuTranslationItem = {
      id: 'posts',
      label: 'Posts',
      linkType: 'custom',
      localizationMode: 'translated',
    };
    expect(isMenuItemLabelApplicableToLocale(translated, 'ko')).toBe(true);
    expect(isMenuItemLabelApplicableToLocale(translated, 'en')).toBe(true);
  });
});
