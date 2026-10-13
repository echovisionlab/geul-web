afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function stubValidEnvironment() {
  vi.stubEnv('PUBLIC_CDN_URL', ' https://server-cdn.example.test/// ');
  vi.stubEnv('PUBLIC_API_URL', 'https://server-api.example.test/');
  vi.stubEnv('PUBLIC_P5_RUNNER_URL', 'https://server-runner.example.test/path/');
  vi.stubEnv('PUBLIC_GOOGLE_MAPS_API_KEY', '  server-maps-key  ');
  vi.stubEnv('PUBLIC_EDITOR_IMAGE_MAX_SIZE_BYTES', '42');
  vi.stubEnv('AUTH_CODE_LIFESPAN_SECONDS', 'bad');
  vi.stubEnv('AUTH_CODE_RESEND_COOLDOWN_SECONDS', '45');
}

describe('server public runtime validation', () => {
  it('validates the same normalized projection that browsers decode', async () => {
    stubValidEnvironment();
    const server = await import('./public-runtime-config.server');
    const shared = await import('./public-runtime-config');
    expect(server.getServerPublicRuntimeConfig()).toEqual(shared.readPublicRuntimeEnvironment());
    expect(server.getServerPublicRuntimeConfig()).toEqual({
      cdnUrl: 'https://server-cdn.example.test',
      apiUrl: 'https://server-api.example.test',
      p5RunnerUrl: 'https://server-runner.example.test/path',
      googleMapsApiKey: 'server-maps-key',
      editorImageMaxSizeBytes: 42,
      authCodeLifespanSeconds: 900,
      authCodeResendCooldownSeconds: 45,
    });
  });

  it.each([
    ['PUBLIC_CDN_URL', 'cdnUrl'],
    ['PUBLIC_API_URL', 'apiUrl'],
    ['PUBLIC_P5_RUNNER_URL', 'p5RunnerUrl'],
  ])('rejects an invalid %s with a URL issue and a useful message', async (name, field) => {
    stubValidEnvironment();
    vi.stubEnv(name, 'not-an-absolute-url');
    const server = await import('./public-runtime-config.server');
    let failure: unknown;
    try {
      server.getServerPublicRuntimeConfig();
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      issues: [{ code: 'invalid_format', format: 'url', path: [field], message: 'Invalid URL' }],
    });
    const error = failure as { message: string; issues: unknown[] };
    expect(JSON.parse(error.message)).toEqual(error.issues);
  });
});
