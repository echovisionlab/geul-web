import { Button, type ButtonProps } from './Button';
import { IconButton, type IconButtonProps } from '../IconButton';
import { NavigationLink, type LinkProps } from '../Navigation';
import { Tabs, type TabsProps } from '../Tabs';

/** Closed production contracts: the compiler must reject framework/style escape props. */
export function ActionTypeContract() {
  const button = (
    <Button size="compact" emphasis="medium" onClick={() => undefined}>
      Save
    </Button>
  );
  const link = (
    <Button href="/posts" target="_blank">
      Posts
    </Button>
  );
  const icon = (
    <IconButton size="chrome" label="Search" interaction="action">
      +
    </IconButton>
  );
  const navigation = (
    <NavigationLink href="/about" appearance="quiet">
      About
    </NavigationLink>
  );
  const tabs = (
    <Tabs defaultValue="first">
      <Tabs.List>
        <Tabs.Tab value="first">First</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="first" paddingTop="md">
        Content
      </Tabs.Panel>
    </Tabs>
  );
  // @ts-expect-error style belongs to the Core owner
  const styled: ButtonProps = { children: 'Save', style: { color: 'red' } };
  // @ts-expect-error arbitrary strings are not registered control sizes
  const sized: ButtonProps = { children: 'Save', size: '37px' };
  // @ts-expect-error Mantine classes/vars cannot cross the boundary
  const classes: ButtonProps = { children: 'Save', classNames: { root: 'local' } };
  // @ts-expect-error links are not submit buttons
  const submitLink: ButtonProps = { href: '/about', type: 'submit' };
  // @ts-expect-error arbitrary numeric hit areas are not a density preset
  const numeric: IconButtonProps = { label: 'Search', size: 14 };
  // @ts-expect-error arbitrary roots cannot replace the accessible control
  const renderer: IconButtonProps = { label: 'Search', component: 'span' };
  // @ts-expect-error navigation styling stays inside its named appearance
  const inline: LinkProps = { href: '/about', style: { color: 'blue' } };
  // @ts-expect-error tabs cannot receive a library style object
  const styledTabs: TabsProps = { styles: { root: { flex: 1 } } };
  // @ts-expect-error reserved owner markers cannot arrive through typed props
  const reserved: ButtonProps = { 'data-geul-theme': 'dark' };
  // @ts-expect-error reserved Core state markers cannot arrive through typed props
  const reservedCore: ButtonProps = { 'data-core-owner': 'foreign' };
  void reserved;
  void reservedCore;
  const foreign = { style: { color: 'red' } };
  // @ts-expect-error typed prop spreads cannot escape the same owner contract
  const spread = <Button {...foreign}>Save</Button>;
  return (
    <>
      {spread}
      {button}
      {link}
      {icon}
      {navigation}
      {tabs}
      {styled}
      {sized}
      {classes}
      {submitLink}
      {numeric}
      {renderer}
      {inline}
      {styledTabs}
    </>
  );
}

const menuIndicator = (
  <Button indicator="menu" aria-expanded={false}>
    Options
  </Button>
);
const disclosureIndicator = (
  <Button indicator="disclosure" aria-expanded>
    Details
  </Button>
);
const indicatorLink = (
  // @ts-expect-error opening affordances belong to actions, not navigation links
  <Button href="/about" indicator="menu">
    About
  </Button>
);
// @ts-expect-error indicator variants are finite
const inventedIndicator = <Button indicator="triangle">Options</Button>;
void [menuIndicator, disclosureIndicator, indicatorLink, inventedIndicator];

// @ts-expect-error Compact action geometry has one named role.
const oldCompactSize = <Button size="compact-xs">Save</Button>;
void oldCompactSize;

// @ts-expect-error Router options belong to the href branch, including typed spreads.
const actionNavigation: ButtonProps = { children: 'Save', replace: true };
// @ts-expect-error Navigation callbacks require an href.
const actionNavigate: ButtonProps = { children: 'Save', onNavigate: () => undefined };
// @ts-expect-error Native submit data belongs to a button, not a link.
const namedLink: ButtonProps = { href: '/posts', name: 'save', value: 'draft' };
void [actionNavigation, actionNavigate, namedLink];

<Button type="submit" form="editor" name="intent" value="save">
  Save
</Button>;
<Button aria-pressed={false}>Bold</Button>;
<Button href="/posts" replace scroll={false} prefetch={false}>
  Posts
</Button>;
