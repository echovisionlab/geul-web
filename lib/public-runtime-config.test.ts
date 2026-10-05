describe('public runtime config', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reads client runtime config from html dataset', async () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          geulCdnUrl: 'https://cdn.example.test',
          geulApiUrl: 'https://api.example.test',
          geulP5RunnerUrl: 'https://runtime.example.run/tools/p5-runner',
          geulGoogleMapsApiKey: 'maps-key',
          geulEditorImageMaxSizeBytes: '73400320',
          geulAuthCodeLifespanSeconds: '720',
          geulAuthCodeResendCooldownSeconds: '45',
        },
      },
    });
    vi.stubGlobal('window', {});

    const runtime = await import('./public-runtime-config');

    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');
    expect(runtime.getPublicCollabUrl()).toBe('/collab');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
    expect(runtime.getPublicApiUrl()).toBe('https://api.example.test');
    expect(runtime.getPublicP5RunnerUrl()).toBe('https://runtime.example.run/tools/p5-runner');
    expect(runtime.getPublicGoogleMapsApiKey()).toBe('maps-key');
    expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(73400320);
    expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(720);
    expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(45);
  });

  it('reads the canonical window bootstrap config when dataset is unavailable', async () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {},
      },
    });
    vi.stubGlobal('window', {
      __GEUL_RUNTIME_CONFIG__: {
        cdnUrl: 'https://bootstrap-cdn.example.test',
        apiUrl: 'https://bootstrap-api.example.test',
        p5RunnerUrl: 'https://bootstrap-runtime.example.run/tools/p5-runner',
        googleMapsApiKey: 'bootstrap-maps-key',
        editorImageMaxSizeBytes: 83886080,
        authCodeLifespanSeconds: 600,
        authCodeResendCooldownSeconds: 30,
      },
    });

    const runtime = await import('./public-runtime-config');

    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');
    expect(runtime.getPublicCollabUrl()).toBe('/collab');
    expect(runtime.getPublicCdnUrl()).toBe('https://bootstrap-cdn.example.test');
    expect(runtime.getPublicApiUrl()).toBe('https://bootstrap-api.example.test');
    expect(runtime.getPublicP5RunnerUrl()).toBe('https://bootstrap-runtime.example.run/tools/p5-runner');
    expect(runtime.getPublicGoogleMapsApiKey()).toBe('bootstrap-maps-key');
    expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(83886080);
    expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(600);
    expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(30);
  });

  it('reads the runner dataset independently of the cached core runtime config', async () => {
    const dataset: DOMStringMap = {};
    vi.stubGlobal('document', { documentElement: { dataset } });
    vi.stubGlobal('window', {});

    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');

    dataset.geulP5RunnerUrl = 'http://127.0.0.1:3000/tools/p5-runner';
    expect(runtime.getPublicP5RunnerUrl()).toBe('http://127.0.0.1:3000/tools/p5-runner');
  });
});

describe('public runtime validation and bootstrap precedence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function browserConfig(config: Record<string, unknown> = {}) {
    vi.stubGlobal('document', { documentElement: { dataset: {} } });
    vi.stubGlobal('window', {
      __GEUL_RUNTIME_CONFIG__: {
        cdnUrl: 'https://cdn.example.test///',
        apiUrl: 'https://api.example.test/',
        ...config,
      },
    });
  }

  it('normalizes bootstrap URLs and trims optional keys synchronously', async () => {
    browserConfig({ p5RunnerUrl: 'https://runner.example.test/path///', googleMapsApiKey: '  maps-key  ' });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
    expect(runtime.getPublicApiUrl()).toBe('https://api.example.test');
    expect(runtime.getPublicP5RunnerUrl()).toBe('https://runner.example.test/path');
    expect(runtime.getPublicGoogleMapsApiKey()).toBe('maps-key');
  });

  it('treats an empty optional key as absent', async () => {
    browserConfig({ googleMapsApiKey: '  ' });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicGoogleMapsApiKey()).toBeUndefined();
  });

  it.each(['cdnUrl', 'apiUrl', 'p5RunnerUrl'])(
    'rejects invalid %s with URL issues and a useful message',
    async (field) => {
      browserConfig({ [field]: 'not-an-absolute-url' });
      const runtime = await import('./public-runtime-config');
      let failure: unknown;
      try {
        runtime.getPublicCdnUrl();
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        issues: [{ code: 'invalid_format', format: 'url', path: [field], message: 'Invalid URL' }],
      });
      const error = failure as { message: string; issues: unknown[] };
      expect(JSON.parse(error.message)).toEqual(error.issues);
    },
  );

  it.each([undefined, '', 'bad', '0', 0, '-1', -1, '1.5', 1.5, '9007199254740992', Number.MAX_SAFE_INTEGER + 1])(
    'uses defaults for missing or invalid numeric settings: %s',
    async (value) => {
      browserConfig({
        editorImageMaxSizeBytes: value,
        authCodeLifespanSeconds: value,
        authCodeResendCooldownSeconds: value,
      });
      const runtime = await import('./public-runtime-config');
      expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(30 * 1024 * 1024);
      expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(900);
      expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(60);
    },
  );

  it.each(['42', 42, ' 42 ', String(Number.MAX_SAFE_INTEGER)])(
    'accepts positive safe integer settings: %s',
    async (value) => {
      browserConfig({ editorImageMaxSizeBytes: value });
      const runtime = await import('./public-runtime-config');
      expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(Number(value));
    },
  );

  it.each([null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects unsupported numeric input rather than applying a default: %s',
    async (value) => {
      browserConfig({ editorImageMaxSizeBytes: value });
      const runtime = await import('./public-runtime-config');
      expect(() => runtime.getPublicEditorImageMaxSizeBytes()).toThrow();
    },
  );

  it('prefers the dataset and caches the validated core config', async () => {
    browserConfig({ cdnUrl: 'https://bootstrap.example.test' });
    const dataset = { geulCdnUrl: 'https://dataset.example.test/', geulApiUrl: 'https://dataset-api.example.test' };
    vi.stubGlobal('document', { documentElement: { dataset } });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicCdnUrl()).toBe('https://dataset.example.test');
    dataset.geulCdnUrl = 'https://changed.example.test';
    expect(runtime.getPublicCdnUrl()).toBe('https://dataset.example.test');
  });

  it('rejects an invalid complete dataset instead of falling back to a valid window config', async () => {
    browserConfig();
    vi.stubGlobal('document', {
      documentElement: { dataset: { geulCdnUrl: 'invalid', geulApiUrl: 'https://api.example.test' } },
    });
    const runtime = await import('./public-runtime-config');
    expect(() => runtime.getPublicCdnUrl()).toThrow('Invalid URL');
  });

  it('falls back to window config when the dataset is incomplete', async () => {
    browserConfig();
    vi.stubGlobal('document', { documentElement: { dataset: { geulCdnUrl: 'invalid' } } });
    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
  });

  it('validates trimmed server environment settings when no browser exists', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubEnv('PUBLIC_CDN_URL', ' https://server-cdn.example.test/// ');
    vi.stubEnv('PUBLIC_API_URL', ' https://server-api.example.test/ ');
    vi.stubEnv('PUBLIC_P5_RUNNER_URL', ' https://server-runner.example.test/path/ ');
    vi.stubEnv('PUBLIC_GOOGLE_MAPS_API_KEY', '  server-maps-key  ');
    vi.stubEnv('PUBLIC_EDITOR_IMAGE_MAX_SIZE_BYTES', '42');
    vi.stubEnv('AUTH_CODE_LIFESPAN_SECONDS', '0');
    vi.stubEnv('AUTH_CODE_RESEND_COOLDOWN_SECONDS', '45');
    const runtime = await import('./public-runtime-config');
    expect(runtime.getServerPublicRuntimeConfig()).toEqual({
      cdnUrl: 'https://server-cdn.example.test',
      apiUrl: 'https://server-api.example.test',
      p5RunnerUrl: 'https://server-runner.example.test/path',
      googleMapsApiKey: 'server-maps-key',
      editorImageMaxSizeBytes: 42,
      authCodeLifespanSeconds: 900,
      authCodeResendCooldownSeconds: 45,
    });
    expect(runtime.getPublicCdnUrl()).toBe('https://server-cdn.example.test');
    vi.stubEnv('PUBLIC_CDN_URL', 'invalid');
    expect(() => runtime.getServerPublicRuntimeConfig()).toThrow('Invalid URL');
  });
});
