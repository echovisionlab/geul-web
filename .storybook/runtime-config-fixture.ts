// Storybook renders outside the root layout, so it supplies the public runtime projection that
// app/layout.tsx writes in production. Imported first so import-time readers see these values.
const dataset = document.documentElement.dataset;
dataset.geulCdnUrl ??= 'http://localhost:8081';
dataset.geulApiUrl ??= 'http://localhost:8000';
