# Firefox builds and releases

This fork is independent of ChatGPT Chat Exporter. It publishes as **Copy as
Markdown (Gardner)** with ID `copy-as-markdown@gardner.github.io`, so it does not
impersonate or replace the upstream extension.

## Local checks

Use Node 24 and pnpm 12.11.2 (the pinned `packageManager` version):

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:security:browser
pnpm package:firefox
pnpm lint:firefox
pnpm audit --audit-level=moderate
```

Load `dist/firefox-extension/manifest.json` through Firefox's
`about:debugging` for a temporary development installation. Firefox 140+ is
required on desktop, 142+ on Android. The unsigned ZIP is a development artifact;
permanent installation requires a Mozilla-signed XPI.

## GitHub setup

1. Create the public `gardner/copy-as-markdown` fork, push the reviewed changes,
   and enable GitHub Actions in the fork.
2. Add repository Actions secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` from your
   Mozilla signing account. GitHub does not copy repository secrets when forking.
3. Run **Signed Firefox release** on the default branch, or push the tag
   `firefox-v3.8.1`. The workflow runs CI, checks the version and existing releases,
   builds and validates the package, submits it through Mozilla's **unlisted**
   channel, verifies the returned payload, and publishes a GitHub Release.

The release contains the signed XPI, a ZIP of the exact committed source, and
`SHA256SUMS`. There is no marketplace listing or automated upstream update.
The source archive is also submitted to Mozilla because the extension bundles
TypeScript. The upstream MIT license and bundled third-party notices are kept.

For each subsequent release, update package.json and both browser manifests
together. Mozilla versions cannot be reused after submission. If signing
succeeds but GitHub publication fails, retrieve the signed workflow artifact
and publish that verified artifact rather than submitting the version again.

Local signing uses the same two environment variable names:

```sh
pnpm package:firefox
pnpm lint:firefox
pnpm sign:firefox
pnpm release:prepare
```

Commit source changes first. Never commit credentials. The build's pruned
`web-ext` dependency is used only through its exported AMO submission client;
use these scripts rather than invoking its general-purpose CLI.

Official signing guidance: [Mozilla Extension Workshop](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/#sign-your-extension-for-self-distribution).
