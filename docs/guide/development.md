# Development

Install dependencies at the repository root with `npm ci`; this is an npm-workspaces project. Prefer workspace packages over ad hoc copies of shared formulas or schemas.

| Command | Purpose |
| --- | --- |
| `npm run dev:local` | Localhost web development server |
| `npm run check:workspace` | Verify workspace resolution |
| `npm run typecheck` | Workspace check and TypeScript validation |
| `npm run build` | Typecheck and web production build |
| `npm run preview` | Preview the built web application |
| `npm run data:check` | Check normalized data consistency |
| `npm run data:status` | Refresh generated local data-status documentation |

`data:status` writes generated status content. Review its diff rather than treating its completion as external verification. The detailed generated status lives in `docs/update-status.md`; the main README deliberately stays a concise project entry point.

## Data and source changes

Candidate data flows through discovery, synchronization, normalization, classification, validation, and diff review. Candidate previews are isolated from the active catalog. Promotion, activation, and rollback are separate operations; inspect their script options and evidence requirements before changing active data.

Keep source identities and artifact hashes with source-host changes. Do not treat a successful build as proof of complete gameplay support.

## Change workflow

Make small, recoverable commits after each independently verified change. Use English for new comments, commits, PR descriptions, and default documentation. Document the tested revision and outstanding checks. Open a draft PR against `develop`; keep integration and production review separate.

Do not commit private player exports or credentials. Historical fixtures must be synthetic or demonstrably safe to publish, with reproducible provenance.
