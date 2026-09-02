import { describe, expect, it } from 'vitest';
import {
  isOpenApiPath,
  shouldExpireSessionCookies,
  shouldRetryOpenApiWithoutSession,
  shouldRetryWithNextTarget,
} from './rpc-proxy';

describe('rpc-proxy helpers', () => {
  describe('isOpenApiPath', () => {
    it('returns true for open API paths', () => {
      expect(isOpenApiPath('api.open.v1.TermsService/Get')).toBe(true);
    });

    it('returns false for manage API paths', () => {
      expect(isOpenApiPath('api.manage.v1.TermsService/GetActiveTerms')).toBe(false);
    });
  });

  describe('shouldRetryWithNextTarget', () => {
    it('retries all 5xx responses', () => {
      expect(shouldRetryWithNextTarget(500, 'api.manage.v1.PageService/GetPage')).toBe(true);
      expect(shouldRetryWithNextTarget(503, 'api.open.v1.TermsService/Get')).toBe(true);
    });

    it('retries auth and not-found errors for open APIs', () => {
      const openPath = 'api.open.v1.TermsService/Get';
      expect(shouldRetryWithNextTarget(401, openPath)).toBe(true);
      expect(shouldRetryWithNextTarget(403, openPath)).toBe(true);
      expect(shouldRetryWithNextTarget(404, openPath)).toBe(true);
    });

    it('does not retry auth and not-found errors for non-open APIs', () => {
      const managePath = 'api.manage.v1.TermsService/GetActiveTerms';
      expect(shouldRetryWithNextTarget(401, managePath)).toBe(false);
      expect(shouldRetryWithNextTarget(403, managePath)).toBe(false);
      expect(shouldRetryWithNextTarget(404, managePath)).toBe(false);
    });
  });

  describe('shouldRetryOpenApiWithoutSession', () => {
    it('retries open APIs anonymously after a 401', () => {
      expect(shouldRetryOpenApiWithoutSession(401, 'api.open.v1.PostService/ListMapFeatures')).toBe(true);
    });

    it('does not retry non-open APIs anonymously', () => {
      expect(shouldRetryOpenApiWithoutSession(401, 'api.manage.v1.PostService/GetPost')).toBe(false);
    });

    it('does not treat 403 as a stale-session retry signal', () => {
      expect(shouldRetryOpenApiWithoutSession(403, 'api.open.v1.PostService/ListMapFeatures')).toBe(false);
    });
  });

  describe('shouldExpireSessionCookies', () => {
    it('expires cookies on 401 responses', () => {
      expect(shouldExpireSessionCookies(401)).toBe(true);
    });

    it('does not expire cookies on 403 responses', () => {
      expect(shouldExpireSessionCookies(403)).toBe(false);
    });
  });
});
