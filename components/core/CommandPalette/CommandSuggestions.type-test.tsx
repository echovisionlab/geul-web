import type { CommandSuggestionsProps } from './CommandSuggestions';
import type { ToolbarSurfaceProps } from '../Section/ToolbarSurface';
const suggestions: CommandSuggestionsProps = {
  id: 'commands',
  label: 'Commands',
  items: [],
  inputElement: document.body,
  position: { left: 0, top: 0 },
  onSelect() {},
  density: 'comfortable',
};
const toolbar: ToolbarSurfaceProps = { label: 'Formatting', density: 'compact', appearance: 'embedded', width: 'full' };
// @ts-expect-error command results cannot supply arbitrary visual density
const badDensity: CommandSuggestionsProps = { ...suggestions, density: 'tiny' };
// @ts-expect-error command results styling belongs to Core
const badStyle: CommandSuggestionsProps = { ...suggestions, style: { height: 900 } };
// @ts-expect-error toolbar appearance is a finite shared role
const badAppearance: ToolbarSurfaceProps = { ...toolbar, appearance: 'custom' };
// @ts-expect-error toolbar consumers cannot override descendant control classes
const badClasses: ToolbarSurfaceProps = { ...toolbar, classNames: { button: 'skin' } };
void [badDensity, badStyle, badAppearance, badClasses];
