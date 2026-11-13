# Scalar API Reference (vendored)

`api-reference-1.78.0.js` is the browser UMD build of
[`@scalar/api-reference@1.78.0`](https://www.npmjs.com/package/@scalar/api-reference),
published under the MIT license (see the upstream
[LICENSE](https://github.com/scalar/scalar/blob/main/LICENSE)).

## Why the file lives in the repository

`/api/docs` builds its UI in the browser from this bundle. The application CSP
(`script-src 'self'`, see `next.config.ts`) forbids third-party script hosts, so
the bundle is served from our own origin instead of `cdn.jsdelivr.net`. The same
choice keeps the API reference working in an air-gapped installation.

The upstream bundle also requests webfonts from `fonts.scalar.com`; the CSP
blocks them and the page falls back to system fonts. Everything else (markup,
styles, requests to `/api/openapi.json`) stays same-origin.

## Updating

1. Download the pinned version:

   ```bash
   curl -o public/vendor/scalar/api-reference-<version>.js \
     https://cdn.jsdelivr.net/npm/@scalar/api-reference@<version>/dist/browser/standalone.js
   ```

2. Set the same `<version>` in `SCALAR_VERSION` in
   `src/app/api/docs/route.ts` — the route points `cdn` at the file name.
3. Remove the previous file and update the version and checksum below.

## Integrity

| Version | SHA-256 |
| --- | --- |
| 1.78.0 | `954b54c4e9e38abe6db9bbd504acd76aae3be473117a1b63a87b34a0298c629b` |
