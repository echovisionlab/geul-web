import { SiteLogoView } from './SiteLogoView';
const wordmark = <SiteLogoView src={null} alt="Archive Studio" size="xl" />;
const asset = <SiteLogoView src="/logo.svg" alt="Archive Studio" height={24} />;
// @ts-expect-error Site identity consumes only the existing bounded xs–xl typography scale.
const foreignSize = <SiteLogoView src={null} alt="Archive Studio" size="display" />;
// @ts-expect-error Numeric font sizes are not a wordmark API.
const numericSize = <SiteLogoView src={null} alt="Archive Studio" size={24} />;
void [wordmark, asset, foreignSize, numericSize];
