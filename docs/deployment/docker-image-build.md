# Docker image

Build the standalone Next.js image from the repository root:

```sh
docker build -t geul-web .
```

Release automation publishes immutable SHA and release-tag references at
`registry.dsub.io/echovisionlab/geul-web`. Production activation is owned by
the deployment repository and is intentionally separate from this build.
