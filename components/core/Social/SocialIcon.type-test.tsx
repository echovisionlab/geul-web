import { prepareSocialIcon, SocialIcon, type SocialIconProps } from './SocialIcon';
import { SocialIconGlyph } from './SocialIconGlyph';

const glyph = { icon: prepareSocialIcon('github') };
<SocialIcon platform="github" size="lg" colorMode="hoverBrand" label="GitHub" data-testid="social" />;
<SocialIconGlyph {...glyph} size="sm" />;
// @ts-expect-error Public icons do not expose arbitrary SVG presentation.
<SocialIcon platform="github" style={{ color: 'red' }} />;
// @ts-expect-error Variable spreads must also preserve the closed presentation contract.
<SocialIcon platform="github" {...{ className: 'skin' }} />;
// @ts-expect-error Raw SVG stroke is not a product icon API.
<SocialIconGlyph {...glyph} strokeWidth={8} />;
// @ts-expect-error Physical size belongs to the existing named scale.
<SocialIcon platform="github" size={18} />;
// @ts-expect-error CSS dimensions are not named icon sizes.
<SocialIcon platform="github" size="17vw" />;
// @ts-expect-error Native width cannot override the named scale.
<SocialIconGlyph {...glyph} width={200} />;
// @ts-expect-error Core theme markers are owned by the shared provider.
const reserved: SocialIconProps = { platform: 'github', 'data-geul-theme': 'dark' };
void reserved;
<SocialIcon platform="google" colorMode="brand" size="md" />;
// @ts-expect-error Identity providers are not social-link platforms that can be prepared for the catalog-free renderer.
prepareSocialIcon('google');
// @ts-expect-error Prepared glyphs come from the Core registry; arbitrary colors cannot be supplied.
<SocialIconGlyph icon={{ platform: 'github', path: 'M0 0h24v24H0z', light: 'red' }} />;
// @ts-expect-error The previous open color props are closed.
<SocialIconGlyph {...glyph} light="#ff0000" />;
