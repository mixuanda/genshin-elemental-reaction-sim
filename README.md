# GIDPS

GIDPS is a Genshin Impact damage calculator and rotation simulator. It combines an independent skill calculator, editable character builds, player-data import, and inspectable simulation results in a TypeScript workspace. The web interface currently uses Chinese labels.

## Features

- Calculate supported individual hits and skills with visible formulas, inputs, and intermediate values.
- Import GOOD files, Enka showcase JSON, or supported build text; review the parsed build before calculation.
- Edit teams and action timelines, then inspect damage, elemental application, energy, and resource records.
- Save documents and compatible result archives for later inspection.
- Run pinned Classic and Stellar source-engine integrations through separate Go/WASM hosts.
- Inspect catalog provenance, conditional support, and isolated candidate snapshots.

Support is tracked per action, condition, data source, and execution path. Catalog inclusion does not certify complete character or team mechanics. See [calculation and support](docs/guide/calculation-and-support.md) for the model boundaries.

## Quick start

Use Node.js 24 and npm from a checkout of this repository:

```sh
npm ci
npm run dev:local
```

Open [the local calculator](http://127.0.0.1:4179/calculator) or [character builds](http://127.0.0.1:4179/builds). The server binds to localhost; stop it with `Ctrl+C`.

To build and preview:

```sh
npm run build
npm run preview
```

See [installation](docs/guide/installation.md) for source-host prerequisites and [development](docs/guide/development.md) for workspace commands.

## Application routes

| Route | Purpose |
| --- | --- |
| `/calculator` | Independent skill calculations and player import |
| `/builds` | Editable reference builds |
| `/examples` | Editable teaching and source-backed examples |
| `/team`, `/rotation`, `/results` | Teams, actions, simulation, and result inspection |
| `/source-simulation` | Pinned source-engine team execution |
| `/compare` | Comparisons under explicit shared assumptions |
| `/data`, `/updates` | Catalog evidence and update status |

## Documentation

- [Guide index](docs/guide/README.md)
- [Importing player data](docs/guide/player-import.md)
- [Calculation and support](docs/guide/calculation-and-support.md)
- [Development](docs/guide/development.md)
- [Testing](docs/guide/testing.md)
- [Data update status](docs/update-status.md)
- [Data provenance](docs/data-provenance.md)
- [Known limitations](docs/known-limitations.md)

The English guide is the maintained entry point. Existing dated reports and separate Chinese documents retain their historical context; a past report is not a current release certificate.

## Repository layout

| Directory | Responsibility |
| --- | --- |
| `apps/web` | Browser UI, workers, and showcase proxy |
| `packages/sim-core` | Calculator, action execution, state, and result traces |
| `packages/schemas` | Input, result, and compatibility contracts |
| `packages/game-data` | Catalogs, mappings, provenance, and data workflows |
| `packages/reaction-formulas`, `packages/icd-profiles` | Reaction formulas and application policies |
| `packages/mechanics` | Character-specific mechanics |
| `packages/source-host` | Pinned source-engine hosts and WASM builds |
| `packages/test-vectors` | Regression vectors and historical compatibility checks |

## Contributing

Keep changes focused and include regression tests for behavior changes. Preserve source provenance, explicit missing-input errors, and historical format boundaries. Use English for new comments, commit messages, PR descriptions, and default documentation. Keep personal account data and credentials out of commits; use clearly identified synthetic fixtures.

Follow [the testing guide](docs/guide/testing.md), report the exact revision and commands tested, and distinguish focused passes from full release validation. Submit changes through a draft pull request to `develop`; production changes require separate review.

## Project status and licensing

The project is under active development. Current work includes broader mechanism coverage, full-account import validation, and end-to-end release acceptance. Consult the current pull request and its checks for validation status.

This checkout does not include a top-level license file. No open-source license grant is asserted here; review upstream notices and obtain the necessary permissions before redistribution.
