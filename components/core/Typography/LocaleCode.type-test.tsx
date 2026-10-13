import { LocaleCode } from './LocaleCode';
const valid = <LocaleCode code="zh-CN" aria-label="Simplified Chinese" />;
// @ts-expect-error codes own their xs metadata role
const arbitrarySize = <LocaleCode code="en" size="lg" />;
// @ts-expect-error direction is owned by the language code
const arbitraryDirection = <LocaleCode code="en" dir="rtl" />;
// @ts-expect-error labels belong beside the code
const arbitraryChildren = <LocaleCode code="en">English</LocaleCode>;
// @ts-expect-error visual overrides cannot arrive through a spread
const arbitraryStyle = <LocaleCode code="en" {...{ style: { fontSize: 24 } }} />;
// @ts-expect-error size overrides cannot arrive through a spread
const arbitrarySpread = <LocaleCode code="en" {...{ size: 'lg' }} />;
void [valid, arbitrarySize, arbitraryDirection, arbitraryChildren, arbitraryStyle, arbitrarySpread];
