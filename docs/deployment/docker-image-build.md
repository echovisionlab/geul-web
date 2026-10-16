# Docker image

Build the standalone Next.js image from the repository root:

```sh
docker build -t geul-web .
```

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
