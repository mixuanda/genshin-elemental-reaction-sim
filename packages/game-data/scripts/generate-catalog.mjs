#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, "..");
const REPO_DIR = resolve(PACKAGE_DIR, "../..");
const GENSHIN_DB_DIR = resolve(REPO_DIR, "node_modules/genshin-db");
const DATA_PATH = resolve(GENSHIN_DB_DIR, "src/min/data.min.json");
const ENKA_MAP_PATH = resolve(
  PACKAGE_DIR,
  "vendor/enka-avatar-skill-map.json"
);
const OUTPUT_PATH = resolve(
  PACKAGE_DIR,
  "src/generated/catalog.zh-CN.json"
);
const RUNTIME_INDEX_PATH = resolve(
  PACKAGE_DIR,
  "src/generated/catalog-index.zh-CN.json"
);

const GAME_PATCH = "6.7";
const GENSHIN_DB_VERSION = "5.2.12";
const GENSHIN_DB_COMMIT = "1bab2cdba4d218fd5caa46b5f54e7884ee8359a2";
const VERIFIED_AT = "2026-07-26T00:00:00.000Z";
const CATALOG_VERSION =
  "gi-6.7-zh-CN.genshin-db-5.2.12.enka-2b9d23b.1";

const ELEMENTS = {
  ELEMENT_PYRO: "pyro",
  ELEMENT_CRYO: "cryo",
  ELEMENT_HYDRO: "hydro",
  ELEMENT_ELECTRO: "electro",
  ELEMENT_ANEMO: "anemo",
  ELEMENT_GEO: "geo",
  ELEMENT_DENDRO: "dendro"
};

const WEAPON_TYPES = {
  WEAPON_SWORD_ONE_HAND: "sword",
  WEAPON_CLAYMORE: "claymore",
  WEAPON_POLE: "polearm",
  WEAPON_CATALYST: "catalyst",
  WEAPON_BOW: "bow"
};

const ENKA_ELEMENTS = {
  Fire: "pyro",
  Ice: "cryo",
  Water: "hydro",
  Electric: "electro",
  Wind: "anemo",
  Rock: "geo",
  Grass: "dendro",
  None: "unknown"
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function provenance(patch, note) {
  return {
    patch,
    source: "genshin-db",
    sourceVersion: GENSHIN_DB_VERSION,
    verifiedAt: VERIFIED_AT,
    verificationStatus: "provisional",
    notes: note
  };
}

function enkaProvenance(snapshot) {
  return {
    patch: "API snapshot",
    source: "EnkaNetwork/API-docs",
    sourceVersion: snapshot.source.commit,
    verifiedAt: snapshot.source.verifiedAt,
    verificationStatus: "provisional",
    notes:
      "Numeric interoperability identifiers only. This is not talent multiplier or simulator-mechanics verification."
  };
}

function abilityKind(key) {
  if (key === "combat1") return "normal";
  if (key === "combat2") return "skill";
  if (key === "combat3") return "burst";
  if (key.startsWith("combat")) return "alternate";
  if (key.startsWith("passive")) return "passive";
  return "other";
}

function abilityKeys(talent) {
  return Object.keys(talent)
    .filter(
      (key) =>
        key.startsWith("combat") ||
        key.startsWith("passive")
    )
    .sort((left, right) => {
      const order = (key) => {
        if (key === "combat1") return 1;
        if (key === "combat2") return 2;
        if (key === "combat3") return 3;
        if (key.startsWith("combat")) return 4;
        if (key.startsWith("passive")) return 10 + Number(key.slice(7) || 0);
        return 100;
      };
      return order(left) - order(right) || left.localeCompare(right);
    });
}

function maxLevelCount(parameters) {
  return Math.max(
    0,
    ...Object.values(parameters).map((values) =>
      Array.isArray(values) ? values.length : 0
    )
  );
}

if (!existsSync(DATA_PATH)) {
  throw new Error(
    "genshin-db data not found. Run npm install before generating the catalog."
  );
}

const packageMetadata = readJson(resolve(GENSHIN_DB_DIR, "package.json"));
if (packageMetadata.version !== GENSHIN_DB_VERSION) {
  throw new Error(
    `Expected genshin-db ${GENSHIN_DB_VERSION}, received ${packageMetadata.version}.`
  );
}

const combinedData = readJson(DATA_PATH);
const characterStats = combinedData.stats.characters;
const talentStats = combinedData.stats.talents;
const weaponStats = combinedData.stats.weapons;
const characterVersions = combinedData.version.characters;
const talentVersions = combinedData.version.talents;
const weaponVersions = combinedData.version.weapons;
const localizedData = combinedData.data.ChineseSimplified;
const enkaSnapshot = readJson(ENKA_MAP_PATH);

const talentSets = Object.entries(localizedData.talents)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([slug, talent]) => {
  const patch = talentVersions[slug] ?? "unknown";
  const stats = talentStats[slug] ?? {};
  const abilities = abilityKeys(talent).map((key) => {
    const source = talent[key] ?? {};
    const parameters = stats[key] ?? {};
    return {
      id: `talent:${slug}:${key}`,
      key,
      kind: abilityKind(key),
      name: source.name ?? key,
      description: source.description ?? "",
      labels: source.attributes?.labels ?? [],
      parameters,
      levelCount: maxLevelCount(parameters),
      provenance: provenance(
        patch,
        "Community/datamined talent text and numeric arrays; not independently frame-, ICD- or mechanics-verified."
      ),
      simulationStatus: "metadata-only",
      unmappedMechanics: [
        "hit timing and hitlag",
        "elemental application and ICD",
        "particle generation",
        "state transitions and target rules"
      ]
    };
  });
  return {
    id: `talent-set:${slug}`,
    numericId: talent.id,
    slug,
    name: talent.name,
    releasePatch: patch,
    abilities,
    provenance: provenance(
      patch,
      "Talent-set metadata and numeric arrays are catalogued, but no automatic conversion to executable hit events is permitted."
    ),
    simulationStatus: "metadata-only",
    unmappedMechanics: [
      "ability-to-hit event compiler",
      "frames, cooldowns and action legality",
      "ICD, aura and reaction ownership",
      "particles, energy and character state"
    ]
  };
  });

const talentSetIds = new Set(talentSets.map((entry) => entry.id));
const travelerTalentSetIds = talentSets
  .filter((entry) => entry.slug.startsWith("traveler"))
  .map((entry) => entry.id);

const characters = Object.entries(localizedData.characters)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([slug, character]) => {
    const patch = characterVersions[slug] ?? "unknown";
    const directTalentSetId = `talent-set:${slug}`;
    const linkedTalentSets =
      slug === "aether" || slug === "lumine"
        ? travelerTalentSetIds
        : talentSetIds.has(directTalentSetId)
          ? [directTalentSetId]
          : [];
    return {
      id: `character:${character.id}`,
      avatarId: character.id,
      slug,
      name: character.name,
      element: ELEMENTS[character.elementType] ?? "unknown",
      weaponType: WEAPON_TYPES[character.weaponType],
      rarity: character.rarity,
      releasePatch: patch,
      talentSetIds: linkedTalentSets,
      stats: characterStats[slug],
      provenance: provenance(
        patch,
        "Community/datamined character identity and base-stat data; game behavior is not independently verified."
      ),
      simulationStatus: "metadata-only",
      unmappedMechanics: [
        "executable abilities",
        "constellations and passives",
        "frames, hitlag and cancel windows",
        "ICD, aura, particles and state transitions"
      ]
    };
  })
  .sort((left, right) => left.avatarId - right.avatarId);

const weapons = Object.entries(localizedData.weapons)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([slug, weapon]) => {
    const patch = weaponVersions[slug] ?? "unknown";
    const refinements = [1, 2, 3, 4, 5]
      .map((rank) => {
        const refinement = weapon[`r${rank}`];
        return refinement
          ? {
              rank,
              description: refinement.description ?? "",
              values: refinement.values ?? []
            }
          : null;
      })
      .filter(Boolean);
    return {
      id: `weapon:${weapon.id}`,
      itemId: weapon.id,
      slug,
      name: weapon.name,
      weaponType: WEAPON_TYPES[weapon.weaponType],
      rarity: weapon.rarity,
      releasePatch: patch,
      baseAtkValue: weapon.baseAtkValue ?? 0,
      mainStatType: weapon.mainStatType ?? "FIGHT_PROP_NONE",
      baseStatText: weapon.baseStatText ?? "",
      effectName: weapon.effectName ?? "",
      refinements,
      stats: weaponStats[slug],
      provenance: provenance(
        patch,
        "Community/datamined weapon stats and refinement text; passive trigger behavior is not independently verified."
      ),
      simulationStatus: "metadata-only",
      unmappedMechanics: [
        "passive trigger conditions",
        "buff stacking and refresh rules",
        "proc ownership and internal cooldowns"
      ]
    };
  })
  .sort((left, right) => left.itemId - right.itemId);

const enkaCharacterMappings = enkaSnapshot.records.map((entry) => ({
  id: `enka-avatar:${entry.variantKey}`,
  variantKey: entry.variantKey,
  avatarId: entry.avatarId,
  element: ENKA_ELEMENTS[entry.element] ?? "unknown",
  skillOrder: entry.skillOrder,
  proudMap: entry.proudMap,
  provenance: enkaProvenance(enkaSnapshot)
}));

const catalog = {
  schemaVersion: "1.0.0",
  catalogVersion: CATALOG_VERSION,
  locale: "zh-CN",
  gamePatch: GAME_PATCH,
  generatedAt: VERIFIED_AT,
  sources: [
    {
      id: "genshin-db",
      name: "genshin-db",
      url: "https://github.com/theBowja/genshin-db",
      version: GENSHIN_DB_VERSION,
      commit: GENSHIN_DB_COMMIT,
      license: "MIT",
      contentSha256: createHash("sha256")
        .update(readFileSync(DATA_PATH))
        .digest("hex"),
      notes:
        "Generated from the exact npm package pinned in package-lock.json; upstream data is community/datamined and remains provisional."
    },
    {
      id: "enka-api-docs-identifiers",
      name: enkaSnapshot.source.name,
      url: enkaSnapshot.source.url,
      version: enkaSnapshot.source.commit.slice(0, 12),
      commit: enkaSnapshot.source.commit,
      license: enkaSnapshot.source.license,
      contentSha256: enkaSnapshot.source.contentSha256,
      notes: enkaSnapshot.source.notes
    }
  ],
  counts: {
    characters: characters.length,
    talentSets: talentSets.length,
    weapons: weapons.length,
    enkaCharacterMappings: enkaCharacterMappings.length
  },
  characters,
  talentSets,
  weapons,
  enkaCharacterMappings
};

const serialized = `${JSON.stringify(catalog)}\n`;
const runtimeIndex = {
  schemaVersion: catalog.schemaVersion,
  catalogVersion: catalog.catalogVersion,
  gamePatch: catalog.gamePatch,
  verificationStatus: "provisional",
  counts: {
    ...catalog.counts,
    abilities: talentSets.reduce(
      (count, talentSet) => count + talentSet.abilities.length,
      0
    )
  },
  characters: characters.map((character) => ({
    id: character.id,
    avatarId: character.avatarId,
    name: character.name,
    element: character.element,
    weaponType: character.weaponType,
    rarity: character.rarity,
    talentSetIds: character.talentSetIds,
    simulationStatus: character.simulationStatus
  })),
  talentSets: talentSets.map((talentSet) => ({
    id: talentSet.id,
    abilities: talentSet.abilities.map((ability) => ({
      id: ability.id,
      key: ability.key,
      name: ability.name
    }))
  })),
  weapons: weapons.map((weapon) => ({
    id: weapon.id,
    itemId: weapon.itemId,
    name: weapon.name,
    simulationStatus: weapon.simulationStatus
  })),
  enkaCharacterMappings: enkaCharacterMappings.map((mapping) => ({
    variantKey: mapping.variantKey,
    avatarId: mapping.avatarId,
    element: mapping.element,
    skillOrder: mapping.skillOrder,
    proudMap: mapping.proudMap
  }))
};
const runtimeSerialized = `${JSON.stringify(runtimeIndex)}\n`;
if (process.argv.includes("--check")) {
  if (!existsSync(OUTPUT_PATH)) {
    throw new Error(`Generated catalog is missing: ${OUTPUT_PATH}`);
  }
  const current = readFileSync(OUTPUT_PATH, "utf8");
  if (current !== serialized) {
    throw new Error(
      "Generated catalog is stale. Run `npm run data:generate` and commit the result."
    );
  }
  if (!existsSync(RUNTIME_INDEX_PATH)) {
    throw new Error(`Generated runtime index is missing: ${RUNTIME_INDEX_PATH}`);
  }
  if (readFileSync(RUNTIME_INDEX_PATH, "utf8") !== runtimeSerialized) {
    throw new Error(
      "Generated runtime index is stale. Run `npm run data:generate` and commit the result."
    );
  }
  console.log(
    `Catalog is reproducible: ${catalog.counts.characters} characters, ${catalog.counts.talentSets} talent sets, ${runtimeIndex.counts.abilities} abilities, ${catalog.counts.weapons} weapons.`
  );
} else {
  writeFileSync(OUTPUT_PATH, serialized);
  writeFileSync(RUNTIME_INDEX_PATH, runtimeSerialized);
  console.log(
    `Wrote full catalog plus runtime index: ${catalog.counts.characters} characters, ${catalog.counts.talentSets} talent sets, ${runtimeIndex.counts.abilities} abilities, ${catalog.counts.weapons} weapons and ${catalog.counts.enkaCharacterMappings} Enka mappings.`
  );
}
