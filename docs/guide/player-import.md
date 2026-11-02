# Importing player data

The calculator import preview accepts supported GOOD JSON, Enka showcase JSON, and build text. Select a local file or paste text, preview the parsed entries, and inspect the chosen character, weapon, artifacts, constellation, and talent levels before handing a build to the calculator.

## Choose one stat route

- **Equipment-derived:** calculate the panel from supported character, weapon, and artifact inputs. Conditional effects require their explicit conditions.
- **Final-panel:** use the imported final panel through the supported Enka parser and calculator context. Do not add equipment-derived bonuses a second time.

Missing required properties should remain actionable validation errors. Check the distinction between base and effective talent levels, and review the selected Traveler element rather than relying on a display name alone.

## Showcase and account scope

A public UID showcase contains the characters the player exposes through that service. It does not establish complete account coverage, conditional combat state, historical snapshots, or a full inventory. An upstream account-verification challenge must be resolved through the supported service; the project does not bypass it.

Full-account import acceptance is still an open validation item. Synthetic test fixtures and public showcase examples must not be described as a user's complete real build.

## Privacy and recovery

Keep account exports local unless sharing is explicitly intended. Do not add real account identifiers, cookies, tokens, or private exports to regression fixtures or issue reports. Use the synthetic-data marker for synthetic inputs.

After import, inspect the preview and any missing fields before calculation. When reopening a saved document or result archive, check its compatibility and provenance; an available historical archive does not imply every historical format can represent current mechanics.
