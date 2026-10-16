# Docker image

Export `NODE_AUTH_TOKEN` with read access to the private geul packages as described
in the [development guide](../../README.md#development). Build the standalone
Next.js image from the repository root with a BuildKit secret:

```sh
docker build --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN -t geul-web .
```

The dependency steps resolve GitHub Packages download locations against the
committed integrity pins, fetch, and install with the token mounted only for
those commands. Do not pass credentials as build arguments or commit literal
tokens in `.npmrc`. Release builds additionally require
`--build-arg RELEASE_IMAGE_BUILD=true` and
`--secret id=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`;
export the same Server Action key used by the deployment.

Release automation publishes immutable SHA and release-tag references at
`registry.rawsector.com/echovisionlab/geul-web`. Production activation is owned by
the deployment repository and is intentionally separate from this build.

Release image pushes to `registry.rawsector.com` go through the Tailscale tailnet
to the in-cluster HAProxy on the Service node, bypassing Cloudflare Tunnel's
100 MB request-body limit. Set repository secrets `TS_OAUTH_CLIENT_ID` and
`TS_OAUTH_SECRET`, and repository variable `REGISTRY_INTERNAL_ADDRESS` to the
Service node's tailnet IP address. The workflow maps the registry hostname in
both the runner and BuildKit container; Buildx uses host networking for the
tailnet route. Keep `HARBOR_REGISTRY_USERNAME` and `HARBOR_REGISTRY_PASSWORD`
for registry authentication.

Configure the deployment's Harbor pull credential (for example, Kubernetes
`imagePullSecrets`). For a local pull, export a Harbor username/password with project read access:

```sh
printf '%s' "$HARBOR_REGISTRY_PASSWORD" | docker login registry.rawsector.com \
  --username "$HARBOR_REGISTRY_USERNAME" --password-stdin
docker pull registry.rawsector.com/echovisionlab/geul-web:<tag>
```

Replace `<tag>` with the release tag (for example, `v0.13.0`); deploy by the
published `@sha256:...` digest where possible. The private-dependency GitHub token
is needed only at build time, not by the running container or Harbor.
