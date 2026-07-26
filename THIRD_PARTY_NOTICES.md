# Third-party references

## gcsim

- Project: [genshinsim/gcsim](https://github.com/genshinsim/gcsim)
- Documentation: [docs.gcsim.app](https://docs.gcsim.app/)
- License: MIT
- Copyright: Copyright (c) 2021 genshinsim

This project currently uses gcsim as a product and testing reference only:

- character and skill damage distribution;
- frame-oriented sample/event inspection;
- expandable damage calculation details;
- energy diagnostics;
- explicit warnings about simulator limitations.

No gcsim source code, character implementation, or game database was copied in
the Milestone 0/1 migration. If code is reused later, the applicable copyright
and MIT license text must be retained with the copied or substantial portions.

## Enka.Network

- API documentation: [Enka.Network API docs](https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md)
- Endpoint used at development/preview time: `https://enka.network/api/uid/:uid/`

The optional showcase importer reads only data made public by the player. It
uses a custom `User-Agent`, honors the response TTL with an in-memory cache, and
does not persist account responses. Enka data describes the public player build;
it is not a source for verified talent multipliers or simulator mechanics.
