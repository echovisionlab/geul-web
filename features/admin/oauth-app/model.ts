/**
 * Who may sign in through an Admin-registered app. `memberCriteria` admits the Members of the selected Member
 * criteria, matched by the same backend rule as restricted file downloads. Not the OAuth token audience (`aud`),
 * which names the resource a token is for.
 */
export type OAuthSignInAccess = 'none' | 'admins' | 'members' | 'memberCriteria';

/** A Member criteria that can admit Members, as listed for the picker. */
export interface OAuthMemberCriteriaOption {
  id: string;
  name: string;
}

/** How an app proves itself at the token endpoint. `none` is a public app that relies on PKCE. */
export type OAuthClientAuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none';

export type OAuthTokenLifespan = '5m' | '15m' | '1h';

/** Optional profile data a sign-in app may ask for; `openid` is always granted. */
export type OAuthSignInScope = 'email' | 'profile';

/** An app registered by an Admin to sign people in with their site account. */
export interface OAuthSignInAppSummary {
  clientId: string;
  name: string;
  signInAccess: OAuthSignInAccess;
  memberCriteria: OAuthMemberCriteriaOption[];
  redirectHosts: string[];
  /** ISO timestamp. */
  createdAt: string;
}

/** An AI tool that connected itself to the site's editing tools. */
export interface OAuthConnectionSummary {
  clientId: string;
  name: string;
  /** Host that published the tool's registration, or null when it registered with a generated ID. */
  publisher: string | null;
  /** The connection still points at an address the site no longer serves. */
  stale: boolean;
  /** ISO timestamp, or null when Hydra does not report it. */
  createdAt: string | null;
}

export interface OAuthSignInAppDraft {
  name: string;
  /** Empty lets the server generate the ID; it cannot change after creation. */
  clientId: string;
  signInAccess: OAuthSignInAccess;
  memberCriteriaIds: string[];
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scopes: OAuthSignInScope[];
  authMethod: OAuthClientAuthMethod;
  accessTokenLifespan: OAuthTokenLifespan;
  idTokenLifespan: OAuthTokenLifespan;
}

/** A stored sign-in app: its settings, the criteria it links and the revision every write needs. */
export interface OAuthSignInApp {
  draft: OAuthSignInAppDraft;
  memberCriteria: OAuthMemberCriteriaOption[];
  revision: string;
  createdAt: string;
}

export interface OAuthConnectionDetail extends OAuthConnectionSummary {
  redirectUris: string[];
  resource: string;
  authMethod: string;
}

export interface OAuthAppSecret {
  clientId: string;
  value: string;
}

export const EMPTY_SIGN_IN_APP_DRAFT: OAuthSignInAppDraft = {
  name: '',
  clientId: '',
  signInAccess: 'admins',
  memberCriteriaIds: [],
  redirectUris: [],
  postLogoutRedirectUris: [],
  scopes: [],
  authMethod: 'client_secret_basic',
  accessTokenLifespan: '15m',
  idTokenLifespan: '15m',
};
