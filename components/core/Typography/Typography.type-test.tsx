import { Code, Heading, ImageChrome, List, Text, VisuallyHidden } from './index';

const positive = (
  <ImageChrome placement="cover" shade="header" inset={{ base: 'md', sm: 'xl' }}>
    <Heading level={1} scale={{ base: 3, sm: 2 }} lines={2} tone="inverse" contrast="image" />
    <Heading level={1} scale="title" />
    <Heading level={2} scale={{ base: 2, lg: 'title' }} />
    <Text wrap="preserve" align="inherit" />
    <Code block scroll="standard" />
    <List spacing="xs">
      <List.Item>Item</List.Item>
    </List>
    <VisuallyHidden as="h2" />
  </ImageChrome>
);
// @ts-expect-error size is a finite registered role
const arbitrarySize = <Text size="17px" />;
// @ts-expect-error heading scale is finite even at a responsive breakpoint
const arbitraryHeading = <Heading scale={{ sm: 9 }} />;
// @ts-expect-error the document title is the only named heading role
const arbitraryRole = <Heading scale="display" />;
// @ts-expect-error direct text coloring bypasses the owner
const directColor = <Text tone="#fff" />;
const escape = { style: { fontSize: 17 } };
// @ts-expect-error style escapes cannot arrive through a spread
const directStyle = <Text {...escape} />;
// @ts-expect-error list spacing uses the existing scale
const arbitraryListGap = <List spacing={7} />;
// @ts-expect-error only finite native semantic headings and span are hidden labels
const arbitraryHidden = <VisuallyHidden as="section" />;
// @ts-expect-error media chrome has no caller CSS
const arbitraryChrome = <ImageChrome className="alternate" />;
void [
  positive,
  arbitrarySize,
  arbitraryHeading,
  arbitraryRole,
  directColor,
  directStyle,
  arbitraryListGap,
  arbitraryHidden,
  arbitraryChrome,
];
