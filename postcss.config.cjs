// Mantine's light-dark transform expands through these mixins. Project them
// through the same theme attribute used by the shared provider and token CSS.
const themeMixins = {};
for (const scheme of ['light', 'dark']) {
  themeMixins[scheme] = { [`[data-geul-theme='${scheme}'] &`]: { '@mixin-content': {} } };
  themeMixins[`${scheme}-root`] = { [`&[data-geul-theme='${scheme}']`]: { '@mixin-content': {} } };
  themeMixins[`where-${scheme}`] = { [`:where([data-geul-theme='${scheme}']) &`]: { '@mixin-content': {} } };
  themeMixins[`where-${scheme}-root`] = {
    [`&:where(:root[data-geul-theme='${scheme}'])`]: { '@mixin-content': {} },
  };
}

module.exports = {
  plugins: {
    'postcss-preset-mantine': { mixins: themeMixins },
    'postcss-simple-vars': {
      variables: require('./lib/styles/design-breakpoints.json'),
    },
  },
};
