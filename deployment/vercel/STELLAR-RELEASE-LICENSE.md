# Modified Stellar program and constituent integration — 2026-10-22

The modified GIDPS Stellar program based on gcsim
`a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd` is distributed under the GNU Affero
General Public License, version 3 or, at your option, any later version
(`AGPL-3.0-or-later`). This includes the original GIDPS modifications in that
program and the original GIDPS portions of the constituent integration source
files identified by path and SHA-256 in `stellar-integration-scope.json`.

You may copy, redistribute and modify those covered original portions under
AGPL-3.0-or-later. The program is provided without any warranty, including the
implied warranties of merchantability or fitness for a particular purpose.
See the accompanying full AGPL text for the complete terms.

The integration list was derived from actual nonzero rendered modules of the
source-host Worker, rather than all files in the repository. Publishing this
version does not uniformly relicense independent original components or select
a root repository licence. The rights of recipients in the covered published
version are not limited to use on this site or to use with a particular service.

Existing third-party copyright and licence notices remain intact. In
particular, prior MIT gcsim contributions, the Classic b4 host, Go/BSD notices,
linked Go modules, Zod and other MIT material retain their notices. This
statement does not claim rights to relicense third-party game data, text,
images, trademarks, or independent works outside the identified program.

The public source-distribution manifest identifies the corresponding modified
native sources, necessary TS/interface/formula/build inputs, fixed dependency
sources and the exact WASM hashes. The two minimal native source trees were
rebuilt offline to byte-identical WASM using the pinned official toolchains and
retained Go dependency inputs. Compiler-cache conditions are recorded per
variant in the source manifest. No clean-room or hermetic reproducibility claim
is made. Source availability does not turn provisional game mechanics into
officially verified mechanics.
