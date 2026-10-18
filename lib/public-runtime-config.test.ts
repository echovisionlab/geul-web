const env = {
  PUBLIC_FONT_BASE_URL: ' https://fonts.example.test/fonts/// ',
  PUBLIC_CDN_URL: ' https://server-cdn.example.test/// ',
  PUBLIC_API_URL: ' https://server-api.example.test/ ',
  PUBLIC_P5_RUNNER_URL: ' https://server-runner.example.test/path/ ',
  PUBLIC_GOOGLE_MAPS_API_KEY: '  server-maps-key  ',
  PUBLIC_EDITOR_IMAGE_MAX_SIZE_BYTES: '42',
  AUTH_CODE_LIFESPAN_SECONDS: '0',
  AUTH_CODE_RESEND_COOLDOWN_SECONDS: '45',
};

function browserDataset(dataset: DOMStringMap) {
  vi.stubGlobal('document', { documentElement: { dataset } });
  vi.stubGlobal('window', {});
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('public runtime config in the browser', () => {
  it('decodes the server projection from the html dataset', async () => {
    browserDataset({
      geulCdnUrl: 'https://cdn.example.test',
      geulApiUrl: 'https://api.example.test',
      geulP5RunnerUrl: 'https://runtime.example.run/tools/p5-runner',
      geulGoogleMapsApiKey: 'maps-key',
      geulEditorImageMaxSizeBytes: '73400320',
      geulAuthCodeLifespanSeconds: '720',
      geulAuthCodeResendCooldownSeconds: '45',
    });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');
    expect(runtime.getPublicCollabUrl()).toBe('/collab');
    expect(runtime.getPublicFontBaseUrl()).toBe('https://static.rawsector.com/fonts');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
    expect(runtime.getPublicApiUrl()).toBe('https://api.example.test');
    expect(runtime.getPublicP5RunnerUrl()).toBe('https://runtime.example.run/tools/p5-runner');
    expect(runtime.getPublicGoogleMapsApiKey()).toBe('maps-key');
    expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(73400320);
    expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(720);
    expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(45);
  });

  it('treats absent optional values as undefined', async () => {
    browserDataset({ geulCdnUrl: 'https://cdn.example.test', geulApiUrl: 'https://api.example.test' });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicP5RunnerUrl()).toBeUndefined();
    expect(runtime.getPublicGoogleMapsApiKey()).toBeUndefined();
  });

  it.each(['', ' ', 'bad', '0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992'])(
    'uses defaults for invalid numeric dataset values: %j',
    async (value) => {
      browserDataset({
        geulCdnUrl: 'https://cdn.example.test',
        geulApiUrl: 'https://api.example.test',
        geulEditorImageMaxSizeBytes: value,
        geulAuthCodeLifespanSeconds: value,
        geulAuthCodeResendCooldownSeconds: value,
      });
      const runtime = await import('./public-runtime-config');
      expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(30 * 1024 * 1024);
      expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(900);
      expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(60);
    },
  );

  it.each(['42', ' 42 ', String(Number.MAX_SAFE_INTEGER)])('accepts positive safe integers: %j', async (value) => {
    browserDataset({
      geulCdnUrl: 'https://cdn.example.test',
      geulApiUrl: 'https://api.example.test',
      geulEditorImageMaxSizeBytes: value,
    });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(Number(value));
  });

  it('reads a font base independently of the existing asset CDN', async () => {
    browserDataset({
      geulCdnUrl: 'https://cdn.example.test',
      geulApiUrl: 'https://api.example.test',
      geulFontBaseUrl: ' https://static.example.test/fonts/// ',
    });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicFontBaseUrl()).toBe('https://static.example.test/fonts');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
  });

  it('caches the first complete projection', async () => {
    const dataset: DOMStringMap = { geulCdnUrl: 'https://cdn.example.test/', geulApiUrl: 'https://api.example.test' };
    browserDataset(dataset);
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
    dataset.geulCdnUrl = 'https://changed.example.test';
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
  });

  it('uses local development services when a non-production document has no projection', async () => {
    browserDataset({});
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicCdnUrl()).toBe('http://localhost:8081');
    expect(runtime.getPublicApiUrl()).toBe('http://localhost:8000');
  });

  it('fails loudly instead of using local services when a production document has no projection', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    browserDataset({ geulCdnUrl: 'https://cdn.example.test' });
    const runtime = await import('./public-runtime-config');
    expect(() => runtime.getPublicCdnUrl()).toThrow('public runtime config is missing');
  });

  it('reads the runner dataset independently of the cached core runtime config', async () => {
    const dataset: DOMStringMap = {};
    browserDataset(dataset);
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');
    dataset.geulP5RunnerUrl = 'http://127.0.0.1:3000/tools/p5-runner';
    expect(runtime.getPublicP5RunnerUrl()).toBe('http://127.0.0.1:3000/tools/p5-runner');
  });
});

describe('public runtime config during server rendering', () => {
  it('normalizes environment settings without a schema library', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value);
    }
    const runtime = await import('./public-runtime-config');
    expect(runtime.readPublicRuntimeEnvironment()).toEqual({
      cdnUrl: 'https://server-cdn.example.test',
      fontBaseUrl: 'https://fonts.example.test/fonts',
      apiUrl: 'https://server-api.example.test',
      p5RunnerUrl: 'https://server-runner.example.test/path',
      googleMapsApiKey: 'server-maps-key',
      editorImageMaxSizeBytes: 42,
      authCodeLifespanSeconds: 900,
      authCodeResendCooldownSeconds: 45,
    });
    expect(runtime.getPublicCdnUrl()).toBe('https://server-cdn.example.test');
  });
});
