# Installation

## Web application

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev:local
```

Visit `http://127.0.0.1:4179/calculator`. The development server binds to `127.0.0.1` on port 4179 and fails if that port is occupied. Do not expose it publicly without the appropriate environment and access controls.

For a production bundle and local preview:

```sh
npm run build
npm run preview
```

The build includes TypeScript validation. Use the preview URL printed by Vite.

## Pinned source engines

Source-engine development additionally requires the Go toolchain used by the source-host build scripts. Inspect the pinned source metadata before rebuilding:

```sh
npm run source:prepare
npm run source:build
npm run source:build:stellar
```

These commands prepare and build the Classic and Stellar hosts separately. They are not required merely to edit a calculator test. Do not replace pinned source commits or generated WASM files without provenance and artifact verification.

## Troubleshooting

- Run `npm run check:workspace` if workspace imports resolve unexpectedly.
- Use a writable npm cache, such as `npm ci --cache /tmp/gidps-npm-cache`, in a restricted cloud environment.
- For memory-limited test runners, see [testing](testing.md). A terminated process is not a successful test result.
