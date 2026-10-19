/** Read-only source review; this module deliberately does not supply executable mappings.
 * Implementation and localization are from one repository, not independent verification. */
export const neferOrdinarySourceEvidence = {
  "sourceRepository": "frzyc/genshin-optimizer",
  "commit": "180a0a1015cb725c7570cd828eb086749960df98",
  "sourceClassification": "community implementation plus localization from the same pinned repository",
  "independentSourceCount": 1,
  "sourceFiles": [
    {
      "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "sha256": "510f1d069423e18780fe0f6bd419332909ec4bf01f405c27f7627ed863189540",
      "bytes": 14943,
      "gitBlobSha": "4d08679173924843edf1198acc6585c5f6bd8dd5",
      "retrievedAt": "2026-09-23T11:42:41.764288+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Nefer/skillParam.json",
      "sha256": "e4d50dee294669cd1b225c7c593c6bbce942d34ca6c1423d1e718cb5eac90bed",
      "bytes": 7119,
      "gitBlobSha": "085e82527cc2155dfa4862028f1f1de390d382ce",
      "retrievedAt": "2026-09-23T11:42:41.687927+00:00"
    },
    {
      "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
      "sha256": "50d7ab10f56e866ee0856586e046649c6676470b4a76286ddb5de6ce7902dd46",
      "bytes": 12815,
      "gitBlobSha": "d73f99ff495faa759d644f705e16eeeda186bbb2",
      "retrievedAt": "2026-09-23T11:42:41.789160+00:00"
    },
    {
      "path": "libs/gi/dm-localization/assets/locales/en/tooltips_gen.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/tooltips_gen.json",
      "sha256": "f20816bb19c79a617a173d8bade6b7301810d92a893ee4495f2e190365f012dd",
      "bytes": 38604,
      "gitBlobSha": "188d09480020761be49244617e3025b4cc845282",
      "retrievedAt": "2026-09-23T11:42:42.822770+00:00"
    }
  ],
  "sourceConstants": {
    "veilMaxStacksC0C1": 3,
    "veilMaxStacksC2Plus": 5,
    "veilDurationSecondsC0C1": 9,
    "veilDurationAdditionalSecondsC2": 5,
    "veilDurationSecondsC2Plus": 14,
    "veilPhantasmMultiplierPerStack": 0.08,
    "fullVeilElementalMasteryC0C1": 100,
    "fullVeilElementalMasteryC2Plus": 200,
    "fullVeilElementalMasteryDurationSeconds": 8,
    "c2VeilStacksOnSkillCast": 2,
    "c1PhantasmLunarBloomAdditionalEmCoefficient": 0.6,
    "c3SkillTalentLevelIncrease": 3,
    "c5BurstTalentLevelIncrease": 3,
    "maximumTalentLevel": 15,
    "c4VerdantDewRateBonus": 0.25,
    "c4DendroResistanceReduction": 0.2,
    "c4SignedDendroResistanceChange": -0.2,
    "c4ResistanceRemovalDelaySeconds": 4.5,
    "c6PhantasmSecondPersonalEmCoefficient": 0.85,
    "c6PhantasmAdditionalHitEmCoefficient": 1.2,
    "c6LunarBloomElevatedDamage": 0.15
  },
  "catalogSnapshotId": "snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34",
  "catalogSha256": "3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602",
  "supplementalSha256": "78d922ea7eb883b77c7101bd7be72159188aef4105ec5fc056fa3ec4aa722241",
  "catalogCoordinates": {
    "talentSet": "talent-set:nefer",
    "constellations": "supplemental.constellationSets[id=constellation-set:12201].entries[rank=1..6]",
    "constellationSourceMapping": "data.ChineseSimplified.constellations.nefer",
    "constellationNumericEvidenceStatus": "unchecked",
    "constellationMechanicEvidenceStatus": "missing",
    "constellationConstantsAreDescriptionsNotNumericParameterVectors": true
  },
  "currentCatalogComparison": {
    "baseAndBurstBonusVectors": [
      {
        "catalogCoordinate": "talent-set:nefer.combat2.param1",
        "sourceCoordinate": "skillParam.skill[0]",
        "sourceValues": [
          0.76384,
          0.821128,
          0.878416,
          0.9548,
          1.012088,
          1.069376,
          1.14576,
          1.222144,
          1.298528,
          1.374912,
          1.451296,
          1.52768,
          1.62316,
          1.71864,
          1.81412
        ],
        "catalogValues": [
          0.76384,
          0.821128,
          0.878416,
          0.9548,
          1.012088,
          1.069376,
          1.14576,
          1.222144,
          1.298528,
          1.374912,
          1.451296,
          1.52768,
          1.62316,
          1.71864,
          1.81412
        ],
        "matchesAll15Levels": true
      },
      {
        "catalogCoordinate": "talent-set:nefer.combat2.param2",
        "sourceCoordinate": "skillParam.skill[1]",
        "sourceValues": [
          1.52768,
          1.642256,
          1.756832,
          1.9096,
          2.024176,
          2.138752,
          2.29152,
          2.444288,
          2.597056,
          2.749824,
          2.902592,
          3.05536,
          3.24632,
          3.43728,
          3.62824
        ],
        "catalogValues": [
          1.52768,
          1.642256,
          1.756832,
          1.9096,
          2.024176,
          2.138752,
          2.29152,
          2.444288,
          2.597056,
          2.749824,
          2.902592,
          3.05536,
          3.24632,
          3.43728,
          3.62824
        ],
        "matchesAll15Levels": true
      },
      {
        "catalogCoordinate": "talent-set:nefer.combat3.param1",
        "sourceCoordinate": "skillParam.burst[0]",
        "sourceValues": [
          2.2464,
          2.41488,
          2.58336,
          2.808,
          2.97648,
          3.14496,
          3.3696,
          3.59424,
          3.81888,
          4.04352,
          4.26816,
          4.4928,
          4.7736,
          5.0544,
          5.3352
        ],
        "catalogValues": [
          2.2464,
          2.41488,
          2.58336,
          2.808,
          2.97648,
          3.14496,
          3.3696,
          3.59424,
          3.81888,
          4.04352,
          4.26816,
          4.4928,
          4.7736,
          5.0544,
          5.3352
        ],
        "matchesAll15Levels": true
      },
      {
        "catalogCoordinate": "talent-set:nefer.combat3.param2",
        "sourceCoordinate": "skillParam.burst[1]",
        "sourceValues": [
          4.4928,
          4.82976,
          5.16672,
          5.616,
          5.95296,
          6.28992,
          6.7392,
          7.18848,
          7.63776,
          8.08704,
          8.53632,
          8.9856,
          9.5472,
          10.1088,
          10.6704
        ],
        "catalogValues": [
          4.4928,
          4.82976,
          5.16672,
          5.616,
          5.95296,
          6.28992,
          6.7392,
          7.18848,
          7.63776,
          8.08704,
          8.53632,
          8.9856,
          9.5472,
          10.1088,
          10.6704
        ],
        "matchesAll15Levels": true
      },
      {
        "catalogCoordinate": "talent-set:nefer.combat3.param3",
        "sourceCoordinate": "skillParam.burst[2]",
        "sourceValues": [
          3.3696,
          3.62232,
          3.87504,
          4.212,
          4.46472,
          4.71744,
          5.0544,
          5.39136,
          5.72832,
          6.06528,
          6.40224,
          6.7392,
          7.1604,
          7.5816,
          8.0028
        ],
        "catalogValues": [
          3.3696,
          3.62232,
          3.87504,
          4.212,
          4.46472,
          4.71744,
          5.0544,
          5.39136,
          5.72832,
          6.06528,
          6.40224,
          6.7392,
          7.1604,
          7.5816,
          8.0028
        ],
        "matchesAll15Levels": true
      },
      {
        "catalogCoordinate": "talent-set:nefer.combat3.param4",
        "sourceCoordinate": "skillParam.burst[3]",
        "sourceValues": [
          6.7392,
          7.24464,
          7.75008,
          8.424,
          8.92944,
          9.43488,
          10.1088,
          10.78272,
          11.45664,
          12.13056,
          12.80448,
          13.4784,
          14.3208,
          15.1632,
          16.0056
        ],
        "catalogValues": [
          6.7392,
          7.24464,
          7.75008,
          8.424,
          8.92944,
          9.43488,
          10.1088,
          10.78272,
          11.45664,
          12.13056,
          12.80448,
          13.4784,
          14.3208,
          15.1632,
          16.0056
        ],
        "matchesAll15Levels": true
      },
      {
        "catalogCoordinate": "talent-set:nefer.combat3.param5",
        "sourceCoordinate": "skillParam.burst[4]",
        "sourceValues": [
          0.13,
          0.16,
          0.19,
          0.22,
          0.25,
          0.28,
          0.31,
          0.34,
          0.37,
          0.4,
          0.43,
          0.46,
          0.49,
          0.52,
          0.55
        ],
        "catalogValues": [
          0.13,
          0.16,
          0.19,
          0.22,
          0.25,
          0.28,
          0.31,
          0.34,
          0.37,
          0.4,
          0.43,
          0.46,
          0.49,
          0.52,
          0.55
        ],
        "matchesAll15Levels": true
      }
    ],
    "verifiedCoefficientPositions": 105,
    "constellationDescriptionsConsistentWithFixedLocalization": true,
    "numericalChangesFound": false
  },
  "constellationReview": {
    "C0": {
      "ordinarySkill": "ATK×combat2.param1 + EM×combat2.param2; nonzero Veil multiplier applicability is conflicted below.",
      "ordinaryBurst": "Hit1: ATK×param1+EM×param2; Hit2: ATK×param3+EM×param4. Add consumedVeils×param5 to the ordinary damage-bonus bucket when ascension>=1 and Moonsign>=2.",
      "a1Em": "At 3 stacks or refreshing the third stack, +100 EM for 8 seconds. The actual active buff is independent of current stacks after consumption.",
      "locations": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 115,
          "endLine": 188,
          "detail": "Separate consumed-Veil bonus, Phantasm multiplier and EM expressions"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 225,
          "endLine": 231,
          "detail": "Initial E also receives the disputed multiplier"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 290,
          "endLine": 300,
          "detail": "Ordinary Q retains two mixed ATK/EM hits"
        }
      ]
    },
    "C1": {
      "directOrdinaryChange": false,
      "effect": "Adds 0.6×EM to Phantasm Lunar-Bloom base damage only; not an extra EM term in the ordinary E dash or Q.",
      "locations": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 195,
          "endLine": 199,
          "detail": "C1 additional Lunar-Bloom multiplier"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 204,
          "endLine": 208,
          "detail": "C1 applies to Phantasm Lunar-Bloom damage"
        }
      ]
    },
    "C2": {
      "directOrdinaryChange": "Can change actual EM and valid consumed-Veil counts; do not automatically multiply the ordinary E by Phantasm buffs.",
      "effect": "Maximum Veils 3→5; individual Veil duration 9→14s; skill cast grants 2 stacks. Full-stack EM threshold changes to 5 and grants 200 EM for 8s instead of 100; never add both.",
      "gate": "The sheet gates Veil damage effects and EM by ascension>=1 and Moonsign>=2; localization requires A1 unlocked. It does not implement the stack-grant event ordering.",
      "locations": [
        {
          "path": "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
          "startLine": 518,
          "endLine": 536,
          "detail": "Base A1 constants"
        },
        {
          "path": "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
          "startLine": 571,
          "endLine": 575,
          "detail": "C2 constants [2,5,200]"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 169,
          "endLine": 188,
          "detail": "At C2 uses 5-stack/200EM branch instead of 3-stack/100EM"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 210,
          "endLine": 215,
          "detail": "C2 stack grant, cap, duration and replacement EM buff"
        }
      ]
    },
    "C3": {
      "directOrdinaryChange": "Effective E talent level +3, maximum 15; changes the two base E arrays through level selection. Do not add it twice when the selected level is already effective.",
      "locations": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 317,
          "endLine": 325,
          "detail": "skillC3 and premod skillBoost"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 217,
          "endLine": 222,
          "detail": "+3 E levels, cap 15"
        }
      ]
    },
    "C4": {
      "directOrdinaryChange": "Ordinary Dendro E/Q can benefit from -0.20 enemy Dendro RES if the target debuff is actually active.",
      "effect": "Shadow Dance plus nearby target applies resistance reduction; after ending the state or moving away, removal occurs after 4.5s. On-field+Shadow Dance is explicitly the condition for +25% Verdant Dew speed, not an additional condition stated for the RES sentence.",
      "locations": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 201,
          "endLine": 206,
          "detail": "C4 condition and -0.20 modifier"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 328,
          "endLine": 332,
          "detail": "Team enemy resistance channel"
        },
        {
          "path": "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
          "startLine": 577,
          "endLine": 581,
          "detail": "[0.25,4.5,0.2]"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 224,
          "endLine": 229,
          "detail": "Target range and delayed removal, distinct from Dew condition"
        }
      ]
    },
    "C5": {
      "directOrdinaryChange": "Effective Q talent level +3, cap 15; selects higher values in all four base damage vectors AND param5 consumed-Veil bonus.",
      "locations": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 317,
          "endLine": 325,
          "detail": "burstC5 and premod burstBoost"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 129,
          "endLine": 131,
          "detail": "Per-Veil bonus is indexed by total burst level"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 231,
          "endLine": 236,
          "detail": "+3 Q levels, cap 15"
        }
      ]
    },
    "C6": {
      "directOrdinaryChange": false,
      "effect": "Converts the second personal hit of Phantasm to 0.85×EM Lunar-Bloom; adds a post-Phantasm 1.2×EM Lunar-Bloom hit; Ascendant Gleam elevates Lunar-Bloom by 15%. None refers to ordinary E dash or ordinary Q hit2. Earlier C2-C5 effects still apply.",
      "locations": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 240,
          "endLine": 258,
          "detail": "Only skill.nefer2Dmg is converted, not burst.hit2"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 290,
          "endLine": 313,
          "detail": "Q hit2 remains ordinary; separate C6 Lunar-Bloom hit"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 208,
          "endLine": 212,
          "detail": "C6 elevated Lunar-Bloom channel only"
        },
        {
          "path": "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
          "startLine": 583,
          "endLine": 587,
          "detail": "[0.85,1.2,0.15]"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 238,
          "endLine": 244,
          "detail": "C6 explicitly identifies Phantasm and Lunar-Bloom"
        }
      ]
    }
  },
  "conflicts": [
    {
      "id": "nefer-initial-skill-veil-scope-conflict",
      "status": "unresolved-same-source-conflict",
      "implementation": [
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 146,
          "endLine": 168,
          "detail": "Builds the Phantasm 1+0.08×Veil multiplier"
        },
        {
          "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
          "startLine": 225,
          "endLine": 230,
          "detail": "Passes it to initial skillDmg"
        }
      ],
      "scopeText": [
        {
          "path": "libs/gi/dm-localization/assets/locales/en/tooltips_gen.json",
          "startLine": 236,
          "endLine": 240,
          "detail": "Phantasm is the replacement Charged Attack: personal two hits and shade three hits"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/tooltips_gen.json",
          "startLine": 243,
          "endLine": 247,
          "detail": "Veils increase Phantasm damage by 8% per stack"
        },
        {
          "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
          "startLine": 210,
          "endLine": 214,
          "detail": "C2 maximum 140% likewise specifies Phantasm"
        }
      ],
      "impact": "Nonzero-Veil multiplication on ordinary E dash cannot be promoted to verified game behavior. Zero Veils makes that factor 1, but actual EM, C2 grant timing and C4 RES must still be restored independently. Q uses its separate sourced param5 bonus.",
      "independentSecondSource": false
    }
  ],
  "unverifiedTiming": [
    "C2 grants 2 Veils when casting E, but these files do not establish whether the grant happens before initial dash damage.",
    "Shadow Dance entry and C4 target debuff ordering relative to the same E initial hit are not established. Target range threshold and enter/leave polling cadence are absent.",
    "Full-stack EM lasts 8s after reaching or refreshing the threshold. Consuming Veils does not provide evidence for immediate removal; actual buff state at each hit must be supplied or independently simulated.",
    "Q consumes all Veils on cast, while the sheet exposes consumedVeils separately from current A1 stacks. It is not an event-order/snapshot implementation for its two hits."
  ],
  "productionBehaviorApplied": false
} as const;
