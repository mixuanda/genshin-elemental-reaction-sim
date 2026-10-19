import type { SourceHitMapping } from "./types";

/**
 * Reviewed base normal actions from the pinned gcsim source below.
 * No character/talent label is used to infer damage semantics at runtime.
 * The numeric source tables are retained so catalog updates cannot silently
 * reuse an old classification. Each action is one N input, not a whole chain.
 *
 * `attack.go` supplies element, table selection and emitted-hit multiplicity;
 * `zz_*.dm.go` supplies the full coefficient vectors and numeric field indices;
 * `pkg/enemy/damage.go` supplies the default ATK scaling of Mult.
 * A completeAction claim is restricted to the self-damage hits of this input
 * under the listed base-state assumptions, not complete character mechanics.
 */
interface NormalActionReference {
  normalIndex: number;
  hitIndex: number;
  parameterKey: string;
  instanceCount: number;
  sourceCoefficientValues: number[];
}

interface NormalFamilyReference {
  characterSlug: string;
  talentSetId: string;
  element: SourceHitMapping["element"];
  sourcePaths: string[];
  extraAssumptions?: string[];
  actions: NormalActionReference[];
}

const normalFamilies: NormalFamilyReference[] = [
  {
    characterSlug: "sucrose",
    talentSetId: "talent-set:sucrose",
    element: "anemo",
    sourcePaths: ["internal/characters/sucrose/attack.go", "internal/characters/sucrose/zz_sucrose.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.33464, 0.359738, 0.384836, 0.4183, 0.443398, 0.468496, 0.50196, 0.535424, 0.568888, 0.602352, 0.635816, 0.66928, 0.71111, 0.75294, 0.79477] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.30616, 0.329122, 0.352084, 0.3827, 0.405662, 0.428624, 0.45924, 0.489856, 0.520472, 0.551088, 0.581704, 0.61232, 0.65059, 0.68886, 0.72713] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.38448, 0.413316, 0.442152, 0.4806, 0.509436, 0.538272, 0.57672, 0.615168, 0.653616, 0.692064, 0.730512, 0.76896, 0.81702, 0.86508, 0.91314] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.479176, 0.515114, 0.551052, 0.59897, 0.634908, 0.670846, 0.718764, 0.766682, 0.814599, 0.862517, 0.910434, 0.958352, 1.018249, 1.078146, 1.138043] },
    ]
  },
  {
    characterSlug: "xianyun",
    talentSetId: "talent-set:xianyun",
    element: "anemo",
    sourcePaths: ["internal/characters/xianyun/attack.go", "internal/characters/xianyun/zz_xianyun.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.403024, 0.433251, 0.463478, 0.50378, 0.534007, 0.564234, 0.604536, 0.644838, 0.685141, 0.725443, 0.765746, 0.806048, 0.856426, 0.906804, 0.957182] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.388552, 0.417693, 0.446835, 0.48569, 0.514831, 0.543973, 0.582828, 0.621683, 0.660538, 0.699394, 0.738249, 0.777104, 0.825673, 0.874242, 0.922811] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.488776, 0.525434, 0.562092, 0.61097, 0.647628, 0.684286, 0.733164, 0.782042, 0.830919, 0.879797, 0.928674, 0.977552, 1.038649, 1.099746, 1.160843] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.649168, 0.697856, 0.746543, 0.81146, 0.860148, 0.908835, 0.973752, 1.038669, 1.103586, 1.168502, 1.233419, 1.298336, 1.379482, 1.460628, 1.541774] },
    ]
  },
  {
    characterSlug: "yaemiko",
    talentSetId: "talent-set:yaemiko",
    element: "electro",
    sourcePaths: ["internal/characters/yaemiko/attack.go", "internal/characters/yaemiko/zz_yaemiko.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.396584, 0.426328, 0.456072, 0.49573, 0.525474, 0.555218, 0.594876, 0.634534, 0.674193, 0.713851, 0.75351, 0.793168, 0.842741, 0.892314, 0.941887] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.385192, 0.414081, 0.442971, 0.48149, 0.510379, 0.539269, 0.577788, 0.616307, 0.654826, 0.693346, 0.731865, 0.770384, 0.818533, 0.866682, 0.914831] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.568888, 0.611555, 0.654221, 0.71111, 0.753777, 0.796443, 0.853332, 0.910221, 0.96711, 1.023998, 1.080887, 1.137776, 1.208887, 1.279998, 1.351109] },
    ]
  },
  {
    characterSlug: "diona",
    talentSetId: "talent-set:diona",
    element: "physical",
    sourcePaths: ["internal/characters/diona/attack.go", "internal/characters/diona/zz_diona.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.3612, 0.3906, 0.42, 0.462, 0.4914, 0.525, 0.5712, 0.6174, 0.6636, 0.714, 0.77175, 0.839664, 0.907578, 0.975492, 1.04958] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.3354, 0.3627, 0.39, 0.429, 0.4563, 0.4875, 0.5304, 0.5733, 0.6162, 0.663, 0.716625, 0.779688, 0.842751, 0.905814, 0.97461] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.4558, 0.4929, 0.53, 0.583, 0.6201, 0.6625, 0.7208, 0.7791, 0.8374, 0.901, 0.973875, 1.059576, 1.145277, 1.230978, 1.32447] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.43, 0.465, 0.5, 0.55, 0.585, 0.625, 0.68, 0.735, 0.79, 0.85, 0.91875, 0.9996, 1.08045, 1.1613, 1.2495] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.5375, 0.58125, 0.625, 0.6875, 0.73125, 0.78125, 0.85, 0.91875, 0.9875, 1.0625, 1.148438, 1.2495, 1.350562, 1.451625, 1.561875] },
    ]
  },
  {
    characterSlug: "kujousara",
    talentSetId: "talent-set:kujousara",
    element: "physical",
    sourcePaths: ["internal/characters/sara/attack.go", "internal/characters/sara/zz_kujousara.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.36894, 0.39897, 0.429, 0.4719, 0.50193, 0.53625, 0.58344, 0.63063, 0.67782, 0.7293, 0.78078, 0.83226, 0.88374, 0.93522, 0.9867] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.387, 0.4185, 0.45, 0.495, 0.5265, 0.5625, 0.612, 0.6615, 0.711, 0.765, 0.819, 0.873, 0.927, 0.981, 1.035] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.48504, 0.52452, 0.564, 0.6204, 0.65988, 0.705, 0.76704, 0.82908, 0.89112, 0.9588, 1.02648, 1.09416, 1.16184, 1.22952, 1.2972] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.50396, 0.54498, 0.586, 0.6446, 0.68562, 0.7325, 0.79696, 0.86142, 0.92588, 0.9962, 1.06652, 1.13684, 1.20716, 1.27748, 1.3478] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.5805, 0.62775, 0.675, 0.7425, 0.78975, 0.84375, 0.918, 0.99225, 1.0665, 1.1475, 1.2285, 1.3095, 1.3905, 1.4715, 1.5525] },
    ]
  },
  {
    characterSlug: "citlali",
    talentSetId: "talent-set:citlali",
    element: "cryo",
    sourcePaths: ["internal/characters/citlali/attack.go", "internal/characters/citlali/zz_citlali.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.434072, 0.466627, 0.499183, 0.54259, 0.575145, 0.607701, 0.651108, 0.694515, 0.737922, 0.78133, 0.824737, 0.868144, 0.922403, 0.976662, 1.030921] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.388136, 0.417246, 0.446356, 0.48517, 0.51428, 0.54339, 0.582204, 0.621018, 0.659831, 0.698645, 0.737458, 0.776272, 0.824789, 0.873306, 0.921823] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.537712, 0.57804, 0.618369, 0.67214, 0.712468, 0.752797, 0.806568, 0.860339, 0.91411, 0.967882, 1.021653, 1.075424, 1.142638, 1.209852, 1.277066] },
    ]
  },
  {
    characterSlug: "shenhe",
    talentSetId: "talent-set:shenhe",
    element: "physical",
    sourcePaths: ["internal/characters/shenhe/attack.go", "internal/characters/shenhe/zz_shenhe.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.43258, 0.46779, 0.503, 0.5533, 0.58851, 0.62875, 0.68408, 0.73941, 0.79474, 0.8551, 0.91546, 0.97582, 1.03618, 1.09654, 1.1569] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.40248, 0.43524, 0.468, 0.5148, 0.54756, 0.585, 0.63648, 0.68796, 0.73944, 0.7956, 0.85176, 0.90792, 0.96408, 1.02024, 1.0764] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.5332, 0.5766, 0.62, 0.682, 0.7254, 0.775, 0.8432, 0.9114, 0.9796, 1.054, 1.1284, 1.2028, 1.2772, 1.3516, 1.426] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param6", instanceCount: 1, sourceCoefficientValues: [0.65618, 0.70959, 0.763, 0.8393, 0.89271, 0.95375, 1.03768, 1.12161, 1.20554, 1.2971, 1.38866, 1.48022, 1.57178, 1.66334, 1.7549] },
    ]
  },
  {
    characterSlug: "beidou",
    talentSetId: "talent-set:beidou",
    element: "physical",
    sourcePaths: ["internal/characters/beidou/attack.go", "internal/characters/beidou/zz_beidou.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.71122, 0.76911, 0.827, 0.9097, 0.96759, 1.03375, 1.12472, 1.21569, 1.30666, 1.4059, 1.519613, 1.653338, 1.787064, 1.92079, 2.066673] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.70864, 0.76632, 0.824, 0.9064, 0.96408, 1.03, 1.12064, 1.21128, 1.30192, 1.4008, 1.5141, 1.647341, 1.780582, 1.913822, 2.059176] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.88322, 0.95511, 1.027, 1.1297, 1.20159, 1.28375, 1.39672, 1.50969, 1.62266, 1.7459, 1.887112, 2.053178, 2.219244, 2.38531, 2.566473] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.86516, 0.93558, 1.006, 1.1066, 1.17702, 1.2575, 1.36816, 1.47882, 1.58948, 1.7102, 1.848525, 2.011195, 2.173865, 2.336536, 2.513994] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [1.12144, 1.21272, 1.304, 1.4344, 1.52568, 1.63, 1.77344, 1.91688, 2.06032, 2.2168, 2.3961, 2.606957, 2.817814, 3.02867, 3.258696] },
    ]
  },
  {
    characterSlug: "yumemizukimizuki",
    talentSetId: "talent-set:yumemizukimizuki",
    element: "anemo",
    sourcePaths: ["internal/characters/mizuki/attack.go", "internal/characters/mizuki/zz_yumemizukimizuki.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.522768, 0.561976, 0.601183, 0.65346, 0.692668, 0.731875, 0.784152, 0.836429, 0.888706, 0.940982, 0.993259, 1.045536, 1.110882, 1.176228, 1.241574] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.469144, 0.50433, 0.539516, 0.58643, 0.621616, 0.656802, 0.703716, 0.75063, 0.797545, 0.844459, 0.891374, 0.938288, 0.996931, 1.055574, 1.114217] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.713688, 0.767215, 0.820741, 0.89211, 0.945637, 0.999163, 1.070532, 1.141901, 1.21327, 1.284638, 1.356007, 1.427376, 1.516587, 1.605798, 1.695009] },
    ]
  },
  {
    characterSlug: "dori",
    talentSetId: "talent-set:dori",
    element: "physical",
    sourcePaths: ["internal/characters/dori/attack.go", "internal/characters/dori/zz_dori.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.90214, 0.97557, 1.049, 1.1539, 1.22733, 1.31125, 1.42664, 1.54203, 1.65742, 1.7833, 1.90918, 2.03506, 2.16094, 2.28682, 2.4127] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.410736, 0.444168, 0.4776, 0.52536, 0.558792, 0.597, 0.649536, 0.702072, 0.754608, 0.81192, 0.869232, 0.926544, 0.983856, 1.041168, 1.09848] },
      { normalIndex: 2, hitIndex: 2, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.431204, 0.466302, 0.5014, 0.55154, 0.586638, 0.62675, 0.681904, 0.737058, 0.792212, 0.85238, 0.912548, 0.972716, 1.032884, 1.093052, 1.15322] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [1.28398, 1.38849, 1.493, 1.6423, 1.74681, 1.86625, 2.03048, 2.19471, 2.35894, 2.5381, 2.71726, 2.89642, 3.07558, 3.25474, 3.4339] },
    ]
  },
  {
    characterSlug: "neuvillette",
    talentSetId: "talent-set:neuvillette",
    element: "hydro",
    sourcePaths: ["internal/characters/neuvillette/attack.go", "internal/characters/neuvillette/zz_neuvillette.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.545768, 0.586701, 0.627633, 0.68221, 0.723143, 0.764075, 0.818652, 0.873229, 0.927806, 0.982382, 1.036959, 1.091536, 1.159757, 1.227978, 1.296199] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.462456, 0.49714, 0.531824, 0.57807, 0.612754, 0.647438, 0.693684, 0.73993, 0.786175, 0.832421, 0.878666, 0.924912, 0.982719, 1.040526, 1.098333] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.723376, 0.777629, 0.831882, 0.90422, 0.958473, 1.012726, 1.085064, 1.157402, 1.229739, 1.302077, 1.374414, 1.446752, 1.537174, 1.627596, 1.718018] },
    ]
  },
  {
    characterSlug: "sigewinne",
    talentSetId: "talent-set:sigewinne",
    element: "physical",
    sourcePaths: ["internal/characters/sigewinne/attack.go", "internal/characters/sigewinne/zz_sigewinne.dm.go", "pkg/enemy/damage.go"],
    extraAssumptions: ["希格雯处于允许普通攻击的状态，未尝试在爆发中提前取消。"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.526139, 0.568965, 0.61179, 0.672969, 0.715794, 0.764737, 0.832034, 0.899331, 0.966628, 1.040043, 1.113458, 1.186873, 1.260287, 1.333702, 1.407117] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.510711, 0.552281, 0.59385, 0.653235, 0.694804, 0.742312, 0.807636, 0.872959, 0.938283, 1.009545, 1.080807, 1.152069, 1.223331, 1.294593, 1.365855] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.78291, 0.846635, 0.91036, 1.001396, 1.065121, 1.13795, 1.23809, 1.338229, 1.438369, 1.547612, 1.656855, 1.766098, 1.875342, 1.984585, 2.093828] },
    ]
  },
  {
    characterSlug: "albedo",
    talentSetId: "talent-set:albedo",
    element: "physical",
    sourcePaths: ["internal/characters/albedo/attack.go", "internal/characters/albedo/zz_albedo.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.367392, 0.397296, 0.4272, 0.46992, 0.499824, 0.534, 0.580992, 0.627984, 0.674976, 0.72624, 0.78498, 0.854058, 0.923136, 0.992215, 1.067573] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.367392, 0.397296, 0.4272, 0.46992, 0.499824, 0.534, 0.580992, 0.627984, 0.674976, 0.72624, 0.78498, 0.854058, 0.923136, 0.992215, 1.067573] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.474548, 0.513174, 0.5518, 0.60698, 0.645606, 0.68975, 0.750448, 0.811146, 0.871844, 0.93806, 1.013932, 1.103159, 1.192385, 1.281611, 1.378948] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.49751, 0.538005, 0.5785, 0.63635, 0.676845, 0.723125, 0.78676, 0.850395, 0.91403, 0.98345, 1.062994, 1.156537, 1.250081, 1.343624, 1.445671] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.620739, 0.671265, 0.72179, 0.793969, 0.844494, 0.902238, 0.981634, 1.061031, 1.140428, 1.227043, 1.326289, 1.443003, 1.559716, 1.676429, 1.803753] },
    ]
  },
  {
    characterSlug: "xinyan",
    talentSetId: "talent-set:xinyan",
    element: "physical",
    sourcePaths: ["internal/characters/xinyan/attack.go", "internal/characters/xinyan/zz_xinyan.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.7654, 0.8277, 0.89, 0.979, 1.0413, 1.1125, 1.2104, 1.3083, 1.4062, 1.513, 1.6198, 1.7266, 1.8334, 1.9402, 2.047] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.7396, 0.7998, 0.86, 0.946, 1.0062, 1.075, 1.1696, 1.2642, 1.3588, 1.462, 1.5652, 1.6684, 1.7716, 1.8748, 1.978] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.9546, 1.0323, 1.11, 1.221, 1.2987, 1.3875, 1.5096, 1.6317, 1.7538, 1.887, 2.0202, 2.1534, 2.2866, 2.4198, 2.553] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [1.15842, 1.25271, 1.347, 1.4817, 1.57599, 1.68375, 1.83192, 1.98009, 2.12826, 2.2899, 2.45154, 2.61318, 2.77482, 2.93646, 3.0981] },
    ]
  },
  {
    characterSlug: "eula",
    talentSetId: "talent-set:eula",
    element: "physical",
    sourcePaths: ["internal/characters/eula/attack.go", "internal/characters/eula/zz_eula.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.897324, 0.970362, 1.0434, 1.14774, 1.220778, 1.30425, 1.419024, 1.533798, 1.648572, 1.77378, 1.917248, 2.085965, 2.254683, 2.423401, 2.607457] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.935508, 1.011654, 1.0878, 1.19658, 1.272726, 1.35975, 1.479408, 1.599066, 1.718724, 1.84926, 1.998833, 2.17473, 2.350627, 2.526524, 2.718412] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 2, sourceCoefficientValues: [0.567987, 0.614219, 0.66045, 0.726495, 0.772726, 0.825562, 0.898212, 0.970861, 1.043511, 1.122765, 1.213577, 1.320372, 1.427166, 1.533961, 1.650465] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [1.126428, 1.218114, 1.3098, 1.44078, 1.532466, 1.63725, 1.781328, 1.925406, 2.069484, 2.22666, 2.406758, 2.618552, 2.830347, 3.042141, 3.27319] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 2, sourceCoefficientValues: [0.718336, 0.776806, 0.835275, 0.918803, 0.977272, 1.044094, 1.135974, 1.227854, 1.319735, 1.419968, 1.534818, 1.669882, 1.804946, 1.94001, 2.087352] },
    ]
  },
  {
    characterSlug: "dahlia",
    talentSetId: "talent-set:dahlia",
    element: "physical",
    sourcePaths: ["internal/characters/dahlia/attack.go", "internal/characters/dahlia/zz_dahlia.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.43547, 0.470915, 0.50636, 0.556996, 0.592441, 0.63295, 0.68865, 0.744349, 0.800049, 0.860812, 0.921575, 0.982338, 1.043102, 1.103865, 1.164628] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.401001, 0.43364, 0.46628, 0.512908, 0.545548, 0.58285, 0.634141, 0.685432, 0.736722, 0.792676, 0.84863, 0.904583, 0.960537, 1.01649, 1.072444] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.237446, 0.256773, 0.2761, 0.30371, 0.323037, 0.345125, 0.375496, 0.405867, 0.436238, 0.46937, 0.502502, 0.535634, 0.568766, 0.601898, 0.63503] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.290164, 0.313782, 0.3374, 0.37114, 0.394758, 0.42175, 0.458864, 0.495978, 0.533092, 0.57358, 0.614068, 0.654556, 0.695044, 0.735532, 0.77602] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.656576, 0.710018, 0.76346, 0.839806, 0.893248, 0.954325, 1.038306, 1.122286, 1.206267, 1.297882, 1.389497, 1.481112, 1.572728, 1.664343, 1.755958] },
    ]
  },
  {
    characterSlug: "collei",
    talentSetId: "talent-set:collei",
    element: "physical",
    sourcePaths: ["internal/characters/collei/attack.go", "internal/characters/collei/zz_collei.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.43602, 0.47151, 0.507, 0.5577, 0.59319, 0.63375, 0.68952, 0.74529, 0.80106, 0.8619, 0.92274, 0.98358, 1.04442, 1.10526, 1.1661] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.42656, 0.46128, 0.496, 0.5456, 0.58032, 0.62, 0.67456, 0.72912, 0.78368, 0.8432, 0.90272, 0.96224, 1.02176, 1.08128, 1.1408] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.54094, 0.58497, 0.629, 0.6919, 0.73593, 0.78625, 0.85544, 0.92463, 0.99382, 1.0693, 1.14478, 1.22026, 1.29574, 1.37122, 1.4467] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.68026, 0.73563, 0.791, 0.8701, 0.92547, 0.98875, 1.07576, 1.16277, 1.24978, 1.3447, 1.43962, 1.53454, 1.62946, 1.72438, 1.8193] },
    ]
  },
  {
    characterSlug: "bennett",
    talentSetId: "talent-set:bennett",
    element: "physical",
    sourcePaths: ["internal/characters/bennett/attack.go", "internal/characters/bennett/zz_bennett.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.44548, 0.48174, 0.518, 0.5698, 0.60606, 0.6475, 0.70448, 0.76146, 0.81844, 0.8806, 0.94276, 1.00492, 1.06708, 1.12924, 1.1914] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.42742, 0.46221, 0.497, 0.5467, 0.58149, 0.62125, 0.67592, 0.73059, 0.78526, 0.8449, 0.90454, 0.96418, 1.02382, 1.08346, 1.1431] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.5461, 0.59055, 0.635, 0.6985, 0.74295, 0.79375, 0.8636, 0.93345, 1.0033, 1.0795, 1.1557, 1.2319, 1.3081, 1.3843, 1.4605] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.59684, 0.64542, 0.694, 0.7634, 0.81198, 0.8675, 0.94384, 1.02018, 1.09652, 1.1798, 1.26308, 1.34636, 1.42964, 1.51292, 1.5962] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.71896, 0.77748, 0.836, 0.9196, 0.97812, 1.045, 1.13696, 1.22892, 1.32088, 1.4212, 1.52152, 1.62184, 1.72216, 1.82248, 1.9228] },
    ]
  },
  {
    characterSlug: "qiqi",
    talentSetId: "talent-set:qiqi",
    element: "physical",
    sourcePaths: ["internal/characters/qiqi/attack.go", "internal/characters/qiqi/zz_qiqi.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.37754, 0.40827, 0.439, 0.4829, 0.51363, 0.54875, 0.59704, 0.64533, 0.69362, 0.7463, 0.79898, 0.85166, 0.90434, 0.95702, 1.0097] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.38872, 0.42036, 0.452, 0.4972, 0.52884, 0.565, 0.61472, 0.66444, 0.71416, 0.7684, 0.82264, 0.87688, 0.93112, 0.98536, 1.0396] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 2, sourceCoefficientValues: [0.24166, 0.26133, 0.281, 0.3091, 0.32877, 0.35125, 0.38216, 0.41307, 0.44398, 0.4777, 0.51142, 0.54514, 0.57886, 0.61258, 0.6463] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 2, sourceCoefficientValues: [0.24682, 0.26691, 0.287, 0.3157, 0.33579, 0.35875, 0.39032, 0.42189, 0.45346, 0.4879, 0.52234, 0.55678, 0.59122, 0.62566, 0.6601] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.63038, 0.68169, 0.733, 0.8063, 0.85761, 0.91625, 0.99688, 1.07751, 1.15814, 1.2461, 1.33406, 1.42202, 1.50998, 1.59794, 1.6859] },
    ]
  },
  {
    characterSlug: "kaveh",
    talentSetId: "talent-set:kaveh",
    element: "physical",
    sourcePaths: ["internal/characters/kaveh/attack.go", "internal/characters/kaveh/zz_kaveh.dm.go", "pkg/enemy/damage.go", "internal/characters/kaveh/kaveh.go"],
    extraAssumptions: ["卡维元素爆发未启用；不使用草元素附魔状态。"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.761857, 0.823868, 0.88588, 0.974468, 1.03648, 1.10735, 1.204797, 1.302244, 1.39969, 1.505996, 1.612302, 1.718607, 1.824913, 1.931218, 2.037524] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.696385, 0.753068, 0.80975, 0.890725, 0.947407, 1.012188, 1.10126, 1.190333, 1.279405, 1.376575, 1.473745, 1.570915, 1.668085, 1.765255, 1.862425] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.842611, 0.911195, 0.97978, 1.077758, 1.146343, 1.224725, 1.332501, 1.440277, 1.548052, 1.665626, 1.7832, 1.900773, 2.018347, 2.13592, 2.253494] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [1.026883, 1.110467, 1.19405, 1.313455, 1.397039, 1.492563, 1.623908, 1.755254, 1.886599, 2.029885, 2.173171, 2.316457, 2.459743, 2.603029, 2.746315] },
    ]
  },
  {
    characterSlug: "yaoyao",
    talentSetId: "talent-set:yaoyao",
    element: "physical",
    sourcePaths: ["internal/characters/yaoyao/attack.go", "internal/characters/yaoyao/zz_yaoyao.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.510014, 0.551527, 0.59304, 0.652344, 0.693857, 0.7413, 0.806534, 0.871769, 0.937003, 1.008168, 1.079333, 1.150498, 1.221662, 1.292827, 1.363992] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.474428, 0.513044, 0.55166, 0.606826, 0.645442, 0.689575, 0.750258, 0.81094, 0.871623, 0.937822, 1.004021, 1.07022, 1.13642, 1.202619, 1.268818] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.313771, 0.339311, 0.36485, 0.401335, 0.426874, 0.456063, 0.496196, 0.53633, 0.576463, 0.620245, 0.664027, 0.707809, 0.751591, 0.795373, 0.839155] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.329457, 0.356274, 0.38309, 0.421399, 0.448215, 0.478862, 0.521002, 0.563142, 0.605282, 0.651253, 0.697224, 0.743195, 0.789165, 0.835136, 0.881107] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.779315, 0.842747, 0.90618, 0.996798, 1.060231, 1.132725, 1.232405, 1.332085, 1.431764, 1.540506, 1.649248, 1.757989, 1.866731, 1.975472, 2.084214] },
    ]
  },
  {
    characterSlug: "charlotte",
    talentSetId: "talent-set:charlotte",
    element: "cryo",
    sourcePaths: ["internal/characters/charlotte/attack.go", "internal/characters/charlotte/zz_charlotte.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.498456, 0.53584, 0.573224, 0.62307, 0.660454, 0.697838, 0.747684, 0.79753, 0.847375, 0.897221, 0.947066, 0.996912, 1.059219, 1.121526, 1.183833] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.433752, 0.466283, 0.498815, 0.54219, 0.574721, 0.607253, 0.650628, 0.694003, 0.737378, 0.780754, 0.824129, 0.867504, 0.921723, 0.975942, 1.030161] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.646008, 0.694459, 0.742909, 0.80751, 0.855961, 0.904411, 0.969012, 1.033613, 1.098214, 1.162814, 1.227415, 1.292016, 1.372767, 1.453518, 1.534269] },
    ]
  },
  {
    characterSlug: "amber",
    talentSetId: "talent-set:amber",
    element: "physical",
    sourcePaths: ["internal/characters/amber/attack.go", "internal/characters/amber/zz_amber.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.3612, 0.3906, 0.42, 0.462, 0.4914, 0.525, 0.5712, 0.6174, 0.6636, 0.714, 0.7644, 0.8148, 0.8652, 0.9156, 0.966] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.3612, 0.3906, 0.42, 0.462, 0.4914, 0.525, 0.5712, 0.6174, 0.6636, 0.714, 0.7644, 0.8148, 0.8652, 0.9156, 0.966] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.4644, 0.5022, 0.54, 0.594, 0.6318, 0.675, 0.7344, 0.7938, 0.8532, 0.918, 0.9828, 1.0476, 1.1124, 1.1772, 1.242] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.473, 0.5115, 0.55, 0.605, 0.6435, 0.6875, 0.748, 0.8085, 0.869, 0.935, 1.001, 1.067, 1.133, 1.199, 1.265] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.5934, 0.6417, 0.69, 0.759, 0.8073, 0.8625, 0.9384, 1.0143, 1.0902, 1.173, 1.2558, 1.3386, 1.4214, 1.5042, 1.587] },
    ]
  },
  {
    characterSlug: "layla",
    talentSetId: "talent-set:layla",
    element: "physical",
    sourcePaths: ["internal/characters/layla/attack.go", "internal/characters/layla/zz_layla.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.512173, 0.553862, 0.59555, 0.655105, 0.696793, 0.744438, 0.809948, 0.875459, 0.940969, 1.012435, 1.083901, 1.155367, 1.226833, 1.298299, 1.369765] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.484834, 0.524297, 0.56376, 0.620136, 0.659599, 0.7047, 0.766714, 0.828727, 0.890741, 0.958392, 1.026043, 1.093694, 1.161346, 1.228997, 1.296648] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.729736, 0.789133, 0.84853, 0.933383, 0.99278, 1.060663, 1.154001, 1.247339, 1.340677, 1.442501, 1.544325, 1.646148, 1.747972, 1.849795, 1.951619] },
    ]
  },
  {
    characterSlug: "nahida",
    talentSetId: "talent-set:nahida",
    element: "dendro",
    sourcePaths: ["internal/characters/nahida/attack.go", "internal/characters/nahida/zz_nahida.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.403048, 0.433277, 0.463505, 0.50381, 0.534039, 0.564267, 0.604572, 0.644877, 0.685182, 0.725486, 0.765791, 0.806096, 0.856477, 0.906858, 0.957239] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.369744, 0.397475, 0.425206, 0.46218, 0.489911, 0.517642, 0.554616, 0.59159, 0.628565, 0.665539, 0.702514, 0.739488, 0.785706, 0.831924, 0.878142] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.458744, 0.49315, 0.527556, 0.57343, 0.607836, 0.642242, 0.688116, 0.73399, 0.779865, 0.825739, 0.871614, 0.917488, 0.974831, 1.032174, 1.089517] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.584064, 0.627869, 0.671674, 0.73008, 0.773885, 0.81769, 0.876096, 0.934502, 0.992909, 1.051315, 1.109722, 1.168128, 1.241136, 1.314144, 1.387152] },
    ]
  },
  {
    characterSlug: "xiangling",
    talentSetId: "talent-set:xiangling",
    element: "physical",
    sourcePaths: ["internal/characters/xiangling/attack.go", "internal/characters/xiangling/zz_xiangling.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.42054, 0.45477, 0.489, 0.5379, 0.57213, 0.61125, 0.66504, 0.71883, 0.77262, 0.8313, 0.898537, 0.977609, 1.05668, 1.135751, 1.222011] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.4214, 0.4557, 0.49, 0.539, 0.5733, 0.6125, 0.6664, 0.7203, 0.7742, 0.833, 0.900375, 0.979608, 1.058841, 1.138074, 1.22451] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 2, sourceCoefficientValues: [0.26058, 0.28179, 0.303, 0.3333, 0.35451, 0.37875, 0.41208, 0.44541, 0.47874, 0.5151, 0.556762, 0.605758, 0.654753, 0.703748, 0.757197] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 4, sourceCoefficientValues: [0.14104, 0.15252, 0.164, 0.1804, 0.19188, 0.205, 0.22304, 0.24108, 0.25912, 0.2788, 0.30135, 0.327869, 0.354388, 0.380906, 0.409836] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.71036, 0.76818, 0.826, 0.9086, 0.96642, 1.0325, 1.12336, 1.21422, 1.30508, 1.4042, 1.517775, 1.651339, 1.784903, 1.918468, 2.064174] },
    ]
  },
  {
    characterSlug: "lisa",
    talentSetId: "talent-set:lisa",
    element: "electro",
    sourcePaths: ["internal/characters/lisa/attack.go", "internal/characters/lisa/zz_lisa.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.396, 0.4257, 0.4554, 0.495, 0.5247, 0.5544, 0.594, 0.6336, 0.6732, 0.7128, 0.753984, 0.80784, 0.861696, 0.915552, 0.969408] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.3592, 0.38614, 0.41308, 0.449, 0.47594, 0.50288, 0.5388, 0.57472, 0.61064, 0.64656, 0.683917, 0.732768, 0.781619, 0.83047, 0.879322] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.428, 0.4601, 0.4922, 0.535, 0.5671, 0.5992, 0.642, 0.6848, 0.7276, 0.7704, 0.814912, 0.87312, 0.931328, 0.989536, 1.047744] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.5496, 0.59082, 0.63204, 0.687, 0.72822, 0.76944, 0.8244, 0.87936, 0.93432, 0.98928, 1.046438, 1.121184, 1.19593, 1.270675, 1.345421] },
    ]
  },
  {
    characterSlug: "aino",
    talentSetId: "talent-set:aino",
    element: "physical",
    sourcePaths: ["internal/characters/aino/attack.go", "internal/characters/aino/zz_aino.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.664986, 0.719113, 0.77324, 0.850564, 0.904691, 0.96655, 1.051606, 1.136663, 1.221719, 1.314508, 1.407297, 1.500086, 1.592874, 1.685663, 1.778452] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.661916, 0.715793, 0.76967, 0.846637, 0.900514, 0.962087, 1.046751, 1.131415, 1.216079, 1.308439, 1.400799, 1.49316, 1.58552, 1.677881, 1.770241] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 2, sourceCoefficientValues: [0.492165, 0.532225, 0.572285, 0.629514, 0.669573, 0.715356, 0.778308, 0.841259, 0.90421, 0.972885, 1.041559, 1.110233, 1.178907, 1.247581, 1.316256] },
    ]
  },
  {
    characterSlug: "mona",
    talentSetId: "talent-set:mona",
    element: "hydro",
    sourcePaths: ["internal/characters/mona/attack.go", "internal/characters/mona/zz_mona.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.376, 0.4042, 0.4324, 0.47, 0.4982, 0.5264, 0.564, 0.6016, 0.6392, 0.6768, 0.7144, 0.752, 0.799, 0.846, 0.893] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.36, 0.387, 0.414, 0.45, 0.477, 0.504, 0.54, 0.576, 0.612, 0.648, 0.684, 0.72, 0.765, 0.81, 0.855] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.448, 0.4816, 0.5152, 0.56, 0.5936, 0.6272, 0.672, 0.7168, 0.7616, 0.8064, 0.8512, 0.896, 0.952, 1.008, 1.064] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.5616, 0.60372, 0.64584, 0.702, 0.74412, 0.78624, 0.8424, 0.89856, 0.95472, 1.01088, 1.06704, 1.1232, 1.1934, 1.2636, 1.3338] },
    ]
  },
  {
    characterSlug: "lynette",
    talentSetId: "talent-set:lynette",
    element: "physical",
    sourcePaths: ["internal/characters/lynette/attack.go", "internal/characters/lynette/zz_lynette.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.430817, 0.465884, 0.50095, 0.551045, 0.586112, 0.626188, 0.681292, 0.736397, 0.791501, 0.851615, 0.911729, 0.971843, 1.031957, 1.092071, 1.152185] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.376121, 0.406736, 0.43735, 0.481085, 0.511699, 0.546687, 0.594796, 0.642904, 0.691013, 0.743495, 0.795977, 0.848459, 0.900941, 0.953423, 1.005905] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.27864, 0.30132, 0.324, 0.3564, 0.37908, 0.405, 0.44064, 0.47628, 0.51192, 0.5508, 0.58968, 0.62856, 0.66744, 0.70632, 0.7452] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.215929, 0.233504, 0.25108, 0.276188, 0.293764, 0.31385, 0.341469, 0.369088, 0.396706, 0.426836, 0.456966, 0.487095, 0.517225, 0.547354, 0.577484] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.631541, 0.682945, 0.73435, 0.807785, 0.859189, 0.917937, 0.998716, 1.079494, 1.160273, 1.248395, 1.336517, 1.424639, 1.512761, 1.600883, 1.689005] },
    ]
  },
  {
    characterSlug: "yunjin",
    talentSetId: "talent-set:yunjin",
    element: "physical",
    sourcePaths: ["internal/characters/yunjin/attack.go", "internal/characters/yunjin/zz_yunjin.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.40506, 0.43803, 0.471, 0.5181, 0.55107, 0.58875, 0.64056, 0.69237, 0.74418, 0.8007, 0.85722, 0.91374, 0.97026, 1.02678, 1.0833] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.40248, 0.43524, 0.468, 0.5148, 0.54756, 0.585, 0.63648, 0.68796, 0.73944, 0.7956, 0.85176, 0.90792, 0.96408, 1.02024, 1.0764] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.22962, 0.24831, 0.267, 0.2937, 0.31239, 0.33375, 0.36312, 0.39249, 0.42186, 0.4539, 0.48594, 0.51798, 0.55002, 0.58206, 0.6141] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.2752, 0.2976, 0.32, 0.352, 0.3744, 0.4, 0.4352, 0.4704, 0.5056, 0.544, 0.5824, 0.6208, 0.6592, 0.6976, 0.736] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.23994, 0.25947, 0.279, 0.3069, 0.32643, 0.34875, 0.37944, 0.41013, 0.44082, 0.4743, 0.50778, 0.54126, 0.57474, 0.60822, 0.6417] },
      { normalIndex: 4, hitIndex: 2, parameterKey: "param6", instanceCount: 1, sourceCoefficientValues: [0.2881, 0.31155, 0.335, 0.3685, 0.39195, 0.41875, 0.4556, 0.49245, 0.5293, 0.5695, 0.6097, 0.6499, 0.6901, 0.7303, 0.7705] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param7", instanceCount: 1, sourceCoefficientValues: [0.67338, 0.72819, 0.783, 0.8613, 0.91611, 0.97875, 1.06488, 1.15101, 1.23714, 1.3311, 1.42506, 1.51902, 1.61298, 1.70694, 1.8009] },
    ]
  },
  {
    characterSlug: "sayu",
    talentSetId: "talent-set:sayu",
    element: "physical",
    sourcePaths: ["internal/characters/sayu/attack.go", "internal/characters/sayu/zz_sayu.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.7224, 0.7812, 0.84, 0.924, 0.9828, 1.05, 1.1424, 1.2348, 1.3272, 1.428, 1.5435, 1.679328, 1.815156, 1.950984, 2.09916] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.7138, 0.7719, 0.83, 0.913, 0.9711, 1.0375, 1.1288, 1.2201, 1.3114, 1.411, 1.525125, 1.659336, 1.793547, 1.927758, 2.07417] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.98126, 1.06113, 1.141, 1.2551, 1.33497, 1.42625, 1.55176, 1.67727, 1.80278, 1.9397, 2.096588, 2.281087, 2.465587, 2.650087, 2.851359] },
    ]
  },
  {
    characterSlug: "shikanoinheizou",
    talentSetId: "talent-set:shikanoinheizou",
    element: "anemo",
    sourcePaths: ["internal/characters/heizou/attack.go", "internal/characters/heizou/zz_shikanoinheizou.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.374736, 0.402841, 0.430946, 0.46842, 0.496525, 0.52463, 0.562104, 0.599578, 0.637051, 0.674525, 0.711998, 0.749472, 0.796314, 0.843156, 0.889998] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.36852, 0.396159, 0.423798, 0.46065, 0.488289, 0.515928, 0.55278, 0.589632, 0.626484, 0.663336, 0.700188, 0.73704, 0.783105, 0.82917, 0.875235] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.5106, 0.548895, 0.58719, 0.63825, 0.676545, 0.71484, 0.7659, 0.81696, 0.86802, 0.91908, 0.97014, 1.0212, 1.085025, 1.14885, 1.212675] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.147824, 0.158911, 0.169998, 0.18478, 0.195867, 0.206954, 0.221736, 0.236518, 0.251301, 0.266083, 0.280866, 0.295648, 0.314126, 0.332604, 0.351082] },
      { normalIndex: 4, hitIndex: 2, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.162608, 0.174804, 0.186999, 0.20326, 0.215456, 0.227651, 0.243912, 0.260173, 0.276434, 0.292694, 0.308955, 0.325216, 0.345542, 0.365868, 0.386194] },
      { normalIndex: 4, hitIndex: 3, parameterKey: "param6", instanceCount: 1, sourceCoefficientValues: [0.192176, 0.206589, 0.221002, 0.24022, 0.254633, 0.269046, 0.288264, 0.307482, 0.326699, 0.345917, 0.365134, 0.384352, 0.408374, 0.432396, 0.456418] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param7", instanceCount: 1, sourceCoefficientValues: [0.614496, 0.660583, 0.70667, 0.76812, 0.814207, 0.860294, 0.921744, 0.983194, 1.044643, 1.106093, 1.167542, 1.228992, 1.305804, 1.382616, 1.459428] },
    ]
  },
  {
    characterSlug: "gorou",
    talentSetId: "talent-set:gorou",
    element: "physical",
    sourcePaths: ["internal/characters/gorou/attack.go", "internal/characters/gorou/zz_gorou.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.37754, 0.40827, 0.439, 0.4829, 0.51363, 0.54875, 0.59704, 0.64533, 0.69362, 0.7463, 0.79898, 0.85166, 0.90434, 0.95702, 1.0097] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.37152, 0.40176, 0.432, 0.4752, 0.50544, 0.54, 0.58752, 0.63504, 0.68256, 0.7344, 0.78624, 0.83808, 0.88992, 0.94176, 0.9936] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.4945, 0.53475, 0.575, 0.6325, 0.67275, 0.71875, 0.782, 0.84525, 0.9085, 0.9775, 1.0465, 1.1155, 1.1845, 1.2535, 1.3225] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.58996, 0.63798, 0.686, 0.7546, 0.80262, 0.8575, 0.93296, 1.00842, 1.08388, 1.1662, 1.24852, 1.33084, 1.41316, 1.49548, 1.5778] },
    ]
  },
  {
    characterSlug: "baizhu",
    talentSetId: "talent-set:baizhu",
    element: "dendro",
    sourcePaths: ["internal/characters/baizhu/attack.go", "internal/characters/baizhu/zz_baizhu.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.373704, 0.401732, 0.42976, 0.46713, 0.495158, 0.523186, 0.560556, 0.597926, 0.635297, 0.672667, 0.710038, 0.747408, 0.794121, 0.840834, 0.887547] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.364248, 0.391567, 0.418885, 0.45531, 0.482629, 0.509947, 0.546372, 0.582797, 0.619222, 0.655646, 0.692071, 0.728496, 0.774027, 0.819558, 0.865089] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 2, sourceCoefficientValues: [0.225416, 0.242322, 0.259228, 0.28177, 0.298676, 0.315582, 0.338124, 0.360666, 0.383207, 0.405749, 0.42829, 0.450832, 0.479009, 0.507186, 0.535363] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.541376, 0.581979, 0.622582, 0.67672, 0.717323, 0.757926, 0.812064, 0.866202, 0.920339, 0.974477, 1.028614, 1.082752, 1.150424, 1.218096, 1.285768] },
    ]
  },
  {
    characterSlug: "kaeya",
    talentSetId: "talent-set:kaeya",
    element: "physical",
    sourcePaths: ["internal/characters/kaeya/attack.go", "internal/characters/kaeya/zz_kaeya.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.5375, 0.58125, 0.625, 0.6875, 0.73125, 0.78125, 0.85, 0.91875, 0.9875, 1.0625, 1.148438, 1.2495, 1.350562, 1.451625, 1.561875] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.51686, 0.55893, 0.601, 0.6611, 0.70317, 0.75125, 0.81736, 0.88347, 0.94958, 1.0217, 1.104337, 1.201519, 1.298701, 1.395883, 1.501899] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.65274, 0.70587, 0.759, 0.8349, 0.88803, 0.94875, 1.03224, 1.11573, 1.19922, 1.2903, 1.394662, 1.517393, 1.640123, 1.762853, 1.896741] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.70864, 0.76632, 0.824, 0.9064, 0.96408, 1.03, 1.12064, 1.21128, 1.30192, 1.4008, 1.5141, 1.647341, 1.780582, 1.913822, 2.059176] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.88236, 0.95418, 1.026, 1.1286, 1.20042, 1.2825, 1.39536, 1.50822, 1.62108, 1.7442, 1.885275, 2.051179, 2.217083, 2.382988, 2.563974] },
    ]
  },
  {
    characterSlug: "navia",
    talentSetId: "talent-set:navia",
    element: "physical",
    sourcePaths: ["internal/characters/navia/attack.go", "internal/characters/navia/zz_navia.dm.go", "pkg/enemy/damage.go", "internal/characters/navia/navia.go", "internal/characters/navia/asc.go"],
    extraAssumptions: ["娜维娅「不明流通渠道」附魔与强化未启用；不按元素战技后的状态计算。"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.93519, 1.01131, 1.08743, 1.196173, 1.272293, 1.359287, 1.478905, 1.598522, 1.718139, 1.848631, 1.979123, 2.109614, 2.240106, 2.370597, 2.501089] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.865065, 0.935478, 1.00589, 1.106479, 1.176891, 1.257362, 1.36801, 1.478658, 1.589306, 1.710013, 1.83072, 1.951427, 2.072133, 2.19284, 2.313547] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 3, sourceCoefficientValues: [0.348859, 0.377255, 0.40565, 0.446215, 0.47461, 0.507062, 0.551684, 0.596306, 0.640927, 0.689605, 0.738283, 0.786961, 0.835639, 0.884317, 0.932995] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [1.334316, 1.442923, 1.55153, 1.706683, 1.81529, 1.939412, 2.110081, 2.280749, 2.451417, 2.637601, 2.823785, 3.009968, 3.196152, 3.382335, 3.568519] },
    ]
  },
  {
    characterSlug: "jean",
    talentSetId: "talent-set:jean",
    element: "physical",
    sourcePaths: ["internal/characters/jean/attack.go", "internal/characters/jean/zz_jean.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.48332, 0.52266, 0.562, 0.6182, 0.65754, 0.7025, 0.76432, 0.82614, 0.88796, 0.9554, 1.032675, 1.12355, 1.214426, 1.305301, 1.404438] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.4558, 0.4929, 0.53, 0.583, 0.6201, 0.6625, 0.7208, 0.7791, 0.8374, 0.901, 0.973875, 1.059576, 1.145277, 1.230978, 1.32447] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.60286, 0.65193, 0.701, 0.7711, 0.82017, 0.87625, 0.95336, 1.03047, 1.10758, 1.1917, 1.288088, 1.401439, 1.514791, 1.628143, 1.751799] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.65876, 0.71238, 0.766, 0.8426, 0.89622, 0.9575, 1.04176, 1.12602, 1.21028, 1.3022, 1.407525, 1.531387, 1.655249, 1.779112, 1.914234] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.79206, 0.85653, 0.921, 1.0131, 1.07757, 1.15125, 1.25256, 1.35387, 1.45518, 1.5657, 1.692338, 1.841263, 1.990189, 2.139115, 2.301579] },
    ]
  },
  {
    characterSlug: "faruzan",
    talentSetId: "talent-set:faruzan",
    element: "physical",
    sourcePaths: ["internal/characters/faruzan/attack.go", "internal/characters/faruzan/zz_faruzan.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.447295, 0.483702, 0.52011, 0.572121, 0.608529, 0.650137, 0.70735, 0.764562, 0.821774, 0.884187, 0.9466, 1.009013, 1.071427, 1.13384, 1.196253] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.421864, 0.456202, 0.49054, 0.539594, 0.573932, 0.613175, 0.667134, 0.721094, 0.775053, 0.833918, 0.892783, 0.951648, 1.010512, 1.069377, 1.128242] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.531635, 0.574907, 0.61818, 0.679998, 0.723271, 0.772725, 0.840725, 0.908725, 0.976724, 1.050906, 1.125088, 1.199269, 1.273451, 1.347632, 1.421814] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.706206, 0.763688, 0.82117, 0.903287, 0.960769, 1.026463, 1.116791, 1.20712, 1.297449, 1.395989, 1.494529, 1.59307, 1.69161, 1.790151, 1.888691] },
    ]
  },
  {
    characterSlug: "kaedeharakazuha",
    talentSetId: "talent-set:kaedeharakazuha",
    element: "physical",
    sourcePaths: ["internal/characters/kazuha/attack.go", "internal/characters/kazuha/zz_kaedeharakazuha.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.44978, 0.48639, 0.523, 0.5753, 0.61191, 0.65375, 0.71128, 0.76881, 0.82634, 0.8891, 0.961013, 1.045582, 1.130151, 1.21472, 1.306977] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.45236, 0.48918, 0.526, 0.5786, 0.61542, 0.6575, 0.71536, 0.77322, 0.83108, 0.8942, 0.966525, 1.051579, 1.136633, 1.221688, 1.314474] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.258, 0.279, 0.3, 0.33, 0.351, 0.375, 0.408, 0.441, 0.474, 0.51, 0.55125, 0.59976, 0.64827, 0.69678, 0.7497] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.3096, 0.3348, 0.36, 0.396, 0.4212, 0.45, 0.4896, 0.5292, 0.5688, 0.612, 0.6615, 0.719712, 0.777924, 0.836136, 0.89964] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.60716, 0.65658, 0.706, 0.7766, 0.82602, 0.8825, 0.96016, 1.03782, 1.11548, 1.2002, 1.297275, 1.411435, 1.525595, 1.639756, 1.764294] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param6", instanceCount: 3, sourceCoefficientValues: [0.2537, 0.27435, 0.295, 0.3245, 0.34515, 0.36875, 0.4012, 0.43365, 0.4661, 0.5015, 0.542063, 0.589764, 0.637465, 0.685167, 0.737205] },
    ]
  },
  {
    characterSlug: "candace",
    talentSetId: "talent-set:candace",
    element: "physical",
    sourcePaths: ["internal/characters/candace/attack.go", "internal/characters/candace/zz_candace.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.60802, 0.65751, 0.707, 0.7777, 0.82719, 0.88375, 0.96152, 1.03929, 1.11706, 1.2019, 1.28674, 1.37158, 1.45642, 1.54126, 1.6261] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.61146, 0.66123, 0.711, 0.7821, 0.83187, 0.88875, 0.96696, 1.04517, 1.12338, 1.2087, 1.29402, 1.37934, 1.46466, 1.54998, 1.6353] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.354879, 0.383765, 0.41265, 0.453915, 0.4828, 0.515813, 0.561204, 0.606596, 0.651987, 0.701505, 0.751023, 0.800541, 0.850059, 0.899577, 0.949095] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.433741, 0.469046, 0.50435, 0.554785, 0.59009, 0.630438, 0.685916, 0.741395, 0.796873, 0.857395, 0.917917, 0.978439, 1.038961, 1.099483, 1.160005] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.94944, 1.02672, 1.104, 1.2144, 1.29168, 1.38, 1.50144, 1.62288, 1.74432, 1.8768, 2.00928, 2.14176, 2.27424, 2.40672, 2.5392] },
    ]
  },
  {
    characterSlug: "tighnari",
    talentSetId: "talent-set:tighnari",
    element: "physical",
    sourcePaths: ["internal/characters/tighnari/attack.go", "internal/characters/tighnari/zz_tighnari.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.44634, 0.48267, 0.519, 0.5709, 0.60723, 0.64875, 0.70584, 0.76293, 0.82002, 0.8823, 0.94458, 1.00686, 1.06914, 1.13142, 1.1937] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.41968, 0.45384, 0.488, 0.5368, 0.57096, 0.61, 0.66368, 0.71736, 0.77104, 0.8296, 0.88816, 0.94672, 1.00528, 1.06384, 1.1224] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 2, sourceCoefficientValues: [0.26445, 0.285975, 0.3075, 0.33825, 0.359775, 0.384375, 0.4182, 0.452025, 0.48585, 0.52275, 0.55965, 0.59655, 0.63345, 0.67035, 0.70725] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.68628, 0.74214, 0.798, 0.8778, 0.93366, 0.9975, 1.08528, 1.17306, 1.26084, 1.3566, 1.45236, 1.54812, 1.64388, 1.73964, 1.8354] },
    ]
  },
  {
    characterSlug: "ororon",
    talentSetId: "talent-set:ororon",
    element: "physical",
    sourcePaths: ["internal/characters/ororon/attack.go", "internal/characters/ororon/zz_ororon.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.50642, 0.54764, 0.58886, 0.647746, 0.688966, 0.736075, 0.80085, 0.865624, 0.930399, 1.001062, 1.071725, 1.142388, 1.213052, 1.283715, 1.354378] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.443734, 0.479852, 0.51597, 0.567567, 0.603685, 0.644963, 0.701719, 0.758476, 0.815233, 0.877149, 0.939065, 1.000982, 1.062898, 1.124815, 1.186731] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.698208, 0.755039, 0.81187, 0.893057, 0.949888, 1.014838, 1.104143, 1.193449, 1.282755, 1.380179, 1.477603, 1.575028, 1.672452, 1.769877, 1.867301] },
    ]
  },
  {
    characterSlug: "kirara",
    talentSetId: "talent-set:kirara",
    element: "physical",
    sourcePaths: ["internal/characters/kirara/attack.go", "internal/characters/kirara/zz_kirara.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.47902, 0.51801, 0.557, 0.6127, 0.65169, 0.69625, 0.75752, 0.81879, 0.88006, 0.9469, 1.01374, 1.08058, 1.14742, 1.21426, 1.2811] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.46354, 0.50127, 0.539, 0.5929, 0.63063, 0.67375, 0.73304, 0.79233, 0.85162, 0.9163, 0.98098, 1.04566, 1.11034, 1.17502, 1.2397] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.254216, 0.274908, 0.2956, 0.32516, 0.345852, 0.3695, 0.402016, 0.434532, 0.467048, 0.50252, 0.537992, 0.573464, 0.608936, 0.644408, 0.67988] },
      { normalIndex: 3, hitIndex: 2, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.381324, 0.412362, 0.4434, 0.48774, 0.518778, 0.55425, 0.603024, 0.651798, 0.700572, 0.75378, 0.806988, 0.860196, 0.913404, 0.966612, 1.01982] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.73272, 0.79236, 0.852, 0.9372, 0.99684, 1.065, 1.15872, 1.25244, 1.34616, 1.4484, 1.55064, 1.65288, 1.75512, 1.85736, 1.9596] },
    ]
  },
  {
    characterSlug: "lyney",
    talentSetId: "talent-set:lyney",
    element: "physical",
    sourcePaths: ["internal/characters/lyney/attack.go", "internal/characters/lyney/zz_lyney.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.38786, 0.41943, 0.451, 0.4961, 0.52767, 0.56375, 0.61336, 0.66297, 0.71258, 0.7667, 0.82082, 0.87494, 0.92906, 0.98318, 1.0373] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.38012, 0.41106, 0.442, 0.4862, 0.51714, 0.5525, 0.60112, 0.64974, 0.69836, 0.7514, 0.80444, 0.85748, 0.91052, 0.96356, 1.0166] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.56932, 0.61566, 0.662, 0.7282, 0.77454, 0.8275, 0.90032, 0.97314, 1.04596, 1.1254, 1.20484, 1.28428, 1.36372, 1.44316, 1.5226] },
    ]
  },
  {
    characterSlug: "ganyu",
    talentSetId: "talent-set:ganyu",
    element: "physical",
    sourcePaths: ["internal/characters/ganyu/attack.go", "internal/characters/ganyu/zz_ganyu.dm.go", "pkg/enemy/damage.go"],
    actions: [
      { normalIndex: 1, hitIndex: 1, parameterKey: "param1", instanceCount: 1, sourceCoefficientValues: [0.31734, 0.34317, 0.369, 0.4059, 0.43173, 0.46125, 0.50184, 0.54243, 0.58302, 0.6273, 0.678037, 0.737705, 0.797372, 0.857039, 0.922131] },
      { normalIndex: 2, hitIndex: 1, parameterKey: "param2", instanceCount: 1, sourceCoefficientValues: [0.35604, 0.38502, 0.414, 0.4554, 0.48438, 0.5175, 0.56304, 0.60858, 0.65412, 0.7038, 0.760725, 0.827669, 0.894613, 0.961556, 1.034586] },
      { normalIndex: 3, hitIndex: 1, parameterKey: "param3", instanceCount: 1, sourceCoefficientValues: [0.45494, 0.49197, 0.529, 0.5819, 0.61893, 0.66125, 0.71944, 0.77763, 0.83582, 0.8993, 0.972038, 1.057577, 1.143116, 1.228655, 1.321971] },
      { normalIndex: 4, hitIndex: 1, parameterKey: "param4", instanceCount: 1, sourceCoefficientValues: [0.45494, 0.49197, 0.529, 0.5819, 0.61893, 0.66125, 0.71944, 0.77763, 0.83582, 0.8993, 0.972038, 1.057577, 1.143116, 1.228655, 1.321971] },
      { normalIndex: 5, hitIndex: 1, parameterKey: "param5", instanceCount: 1, sourceCoefficientValues: [0.48246, 0.52173, 0.561, 0.6171, 0.65637, 0.70125, 0.76296, 0.82467, 0.88638, 0.9537, 1.030838, 1.121551, 1.212265, 1.302979, 1.401939] },
      { normalIndex: 6, hitIndex: 1, parameterKey: "param6", instanceCount: 1, sourceCoefficientValues: [0.5762, 0.6231, 0.67, 0.737, 0.7839, 0.8375, 0.9112, 0.9849, 1.0586, 1.139, 1.231125, 1.339464, 1.447803, 1.556142, 1.67433] },
    ]
  },
];

export const normalAttackMappings: SourceHitMapping[] = normalFamilies.flatMap((family) =>
  family.actions.map((action): SourceHitMapping => ({
    id: `${family.characterSlug}-normal-${action.normalIndex}-hit-${action.hitIndex}`,
    characterSlug: family.characterSlug,
    talentSetId: family.talentSetId,
    abilityKey: "combat1",
    parameterKey: action.parameterKey,
    skillId: `${family.characterSlug}-normal-${action.normalIndex}`,
    skillLabel: `普通攻击第 ${action.normalIndex} 段（基础状态）`,
    hitLabel: action.instanceCount === 1
      ? `第 ${action.hitIndex} 次命中`
      : `第 ${action.hitIndex}–${action.hitIndex + action.instanceCount - 1} 次命中`,
    element: family.element,
    scalingStat: "atk",
    attackTag: "normal",
    coefficientMultiplier: 1,
    instanceCount: action.instanceCount,
    sourceCoefficientValues: action.sourceCoefficientValues,
    coefficientTolerance: 0,
    sourcePaths: [...family.sourcePaths],
    assumptions: [
      "仅限基础普攻状态；未启用附魔、替换普攻或其他技能状态。",
      "该次普攻输入的全部列出命中均命中同一目标；不包含后续普攻输入。",
      "无被动、命座、装备或队友对该伤害的额外修改或触发；输入为该状态下的最终面板。",
      ...(family.extraAssumptions ?? [])
    ],
    exclusions: [
      "未将重击、下落攻击、技能、爆发、治疗或追击计入该普攻动作。",
      "此倍率与命中映射不构成附着、ICD、动作帧、能量或反应覆盖率验证。"
    ],
    completeAction: true
  }))
);

/** Deliberate exclusions, not zero-damage records or completed mechanics. */
export const normalAttackMappingExclusions = [
  { characterSlug: "shenhe", normalIndex: 4, reason: "源码两次命中的 param4 与 param5 全等级相同，注释同时引用两项；保留为参数身份待核验。" },
  { characterSlug: "sayu", normalIndex: 3, reason: "源码两次命中的 param3 与 param4 全等级相同，注释同时引用两项；保留为参数身份待核验。" },
  { characterSlug: "lyney", normalIndex: 3, reason: "源码两次命中的 param3 与 param4 全等级相同，注释同时引用两项；保留为参数身份待核验。" },
  { characterSlug: "dehya", normalIndex: null, reason: "Attack 可切换为爆发状态动作；本批尚未建模该状态判定。" },
  { characterSlug: "lauma", normalIndex: null, reason: "C6 苍色咏颂可改写 Mult、UseEM 与月绽放伤害；本批尚未建模该状态判定。" }
] as const;

export const normalAttackSourceEvidence = {
  "revision": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  "archiveSha256": "334067728781541ccd4351fbe9851f7684f4f6c2d4dab79a1c3dd1e01318fd1a",
  "retrievedAt": "2026-09-23T06:21:35.667874+00:00",
  "matchingRule": "Executable Attack selects the attack/auto table by NormalCounter; generated source parameter placeholders plus the complete 15-level numeric vector must identify one catalog combat1 parameter. Exact equality observed, no rounding tolerance used.",
  "sourceSha256": {
    "internal/characters/aino/attack.go": "66ba8e254f5447b412dc54d5d0bafc12fd74e7128ae4424727c1d765d728fae1",
    "internal/characters/aino/zz_aino.dm.go": "0c04f1002f1d59c145abeff1d32840d982a01c78038b27e69d90871f7ed67827",
    "internal/characters/albedo/attack.go": "314b1dd4004c15bc8953bd40fd926c83137aa80c49f6befcf044482981d4e756",
    "internal/characters/albedo/zz_albedo.dm.go": "d8faedb3aa35bfc1ac21912c4eaf006039aa60a6405d7c9664b43a13175d4869",
    "internal/characters/amber/attack.go": "f78e228737b2b401565cfa5b1054214ea9b9b04c082f124c29c62116f2a660ff",
    "internal/characters/amber/zz_amber.dm.go": "62e6b1a0f66e54f456dd515c34aa46ca83bcc7115ef918d1aabf81a725b14901",
    "internal/characters/baizhu/attack.go": "567b83488da23d7713c1699e19ba5a1e962eeeb58e6295f3bae253e85dcd2fb2",
    "internal/characters/baizhu/zz_baizhu.dm.go": "54e99a2f11b24ad2d81e3a984f141567080afb95c7373a3e9d3ea044150006fd",
    "internal/characters/beidou/attack.go": "3f34a61ce5e8bef6e4d45c7875819a7e011a66e9b15be25c8f5dd40474f42869",
    "internal/characters/beidou/zz_beidou.dm.go": "92ca1cdd6b8063ee604ebdb4a585fa02244caa4c38d8267327d502011c1efd2a",
    "internal/characters/bennett/attack.go": "cbea5e027fcb98e2320f5f6b819127ba70b19136d034d15550dd6816504c0099",
    "internal/characters/bennett/zz_bennett.dm.go": "382a6d6d1e3ebe0ce9752d6e05cf31e9880037a9968ad71d62f0177a4bde4c32",
    "internal/characters/candace/attack.go": "585e6f8f0172fdd448f343b57508665f209ebada4c1dc146ee99aee20df309af",
    "internal/characters/candace/zz_candace.dm.go": "6094f8aea9257fcf6c261def6430087f9f7d4479128dac759b319a89eb8d9c2e",
    "internal/characters/charlotte/attack.go": "5321b2c2a599fddadcc51d8f58d99f6a7364660afa5b74792f510d927256b31f",
    "internal/characters/charlotte/zz_charlotte.dm.go": "127b9b806a2716a0a7e0c9af640da17840b1c9041b36775907b992c22f001826",
    "internal/characters/citlali/attack.go": "9b269d6fb79765796a9ca9833d77ff89d1403961e7580ac05ef81d5800a96764",
    "internal/characters/citlali/zz_citlali.dm.go": "b601ad4640c2cf07ae4e5b7d046b403cdf296dd5df96388f37d7be7406fa0872",
    "internal/characters/collei/attack.go": "b1904b46ea917abb71341f131a4d23d49d972b6bca9b18315e675d18e1015268",
    "internal/characters/collei/zz_collei.dm.go": "f6820e61b867282d61922967c724f6479cb7e74645c65e9f5ce25c3b115f0ef7",
    "internal/characters/dahlia/attack.go": "cab5504ed2d84df7b9bb28831a9aca888e82cc31843c695d89de62d09dcc9b32",
    "internal/characters/dahlia/zz_dahlia.dm.go": "e14659136df02ebf56b41430d12643237961f87fe243922bcf608ddaf92413ba",
    "internal/characters/diona/attack.go": "ec33f6c13fac4fb5f7919992ad4a02b82aa05ff26ece66289b47cfe7644da9e0",
    "internal/characters/diona/zz_diona.dm.go": "2601720c0cc0d1b6efdf9e59f3659dc4261ec229a7c8a55a561e267f4a740683",
    "internal/characters/dori/attack.go": "615a0027864f5beb859f7b7287b3ac42625be7d42b1cc406d692cf3c5968b20f",
    "internal/characters/dori/zz_dori.dm.go": "7684142e336f4399edda122b894cf036b6e7766207cae4ae908683a0d4458b6d",
    "internal/characters/eula/attack.go": "48675be8d09b03f2084aae98111a0e013336f8a9b98f2a30b92d70a35113e166",
    "internal/characters/eula/zz_eula.dm.go": "5a4eeb87ebeae99cae4c3bebeffd8eeb6fa78f78b27e7d9e4697bc99ebcf75da",
    "internal/characters/faruzan/attack.go": "257f19bde89aec0f18687c55ea4306e0d5f6318f50638039d48956de8bb37446",
    "internal/characters/faruzan/zz_faruzan.dm.go": "bba0a9ef74e787804e759f2a48d21c11c0337b6b2ff982c08b5bb77d9d902f3e",
    "internal/characters/ganyu/attack.go": "11ffd15c653b9e5cf6580e6ffe6db66f20f5ea9cbfd4e44047c9ac62be6ba004",
    "internal/characters/ganyu/zz_ganyu.dm.go": "cd0f50f73f896771f35fac3854026e4fec6306d77a4bc8c70d73e0115e6c1f86",
    "internal/characters/gorou/attack.go": "7b215901cb9ae9a33a050b4b7d71362100a994f9215c7835d6cb9c86400ae618",
    "internal/characters/gorou/zz_gorou.dm.go": "7ab3cef93f2aafe95cf848fdfc1dc668371a59c378195acad4891dc0b8a99dde",
    "internal/characters/heizou/attack.go": "364790333a75ecc6b1cafdefdc6615a09608d845bd51a4e39fa727a4b8ee428c",
    "internal/characters/heizou/zz_shikanoinheizou.dm.go": "6605ab98c3706f75b864347d5e92f2246ca554484d6022e19f9c8807e232cd81",
    "internal/characters/jean/attack.go": "5f42b14a59affd1d1ee6c644c18c8cfabfb85cceca40fd9cc2817795fa0e4eaf",
    "internal/characters/jean/zz_jean.dm.go": "a80d49f4b46e2332916739b0a5c37cef6abc7b86d342d971478aae2ea26ecdb4",
    "internal/characters/kaeya/attack.go": "83f8e951f5be873b1181a36f0a6360a13e1b665b9ac5372f6694f471c8051bb9",
    "internal/characters/kaeya/zz_kaeya.dm.go": "5e5e835dce839033ed0f1ad45ebf4561aca286b9d0c455128f57b15a18e94351",
    "internal/characters/kaveh/attack.go": "9563afce6265404866fa004bd5b81747b3aaea931828aadd55d6553791911d67",
    "internal/characters/kaveh/kaveh.go": "9b41e5d632ae554e37a8221e6d070a25c67a39e982573bfe01436602cd794a0d",
    "internal/characters/kaveh/zz_kaveh.dm.go": "a91b855f1e98b79f0f12caf2bd897fc936ad7701134bdc3ddd065e790d71fbf7",
    "internal/characters/kazuha/attack.go": "3c0f44ff1fc020733e7e0795dd7b7be6f7a6f79f2598c06cf1f5cfbe7193ee90",
    "internal/characters/kazuha/zz_kaedeharakazuha.dm.go": "f26d39690958e646dd80b8c19104ee73ca380e316d94ff00c47ad67da4f63b23",
    "internal/characters/kirara/attack.go": "2bf14f890de4ce950f8533e0df6c9be8638bf0267b07f84f51de88a09558296f",
    "internal/characters/kirara/zz_kirara.dm.go": "026cad18d6d4e9f6cc89fe2963323730af08ff47f6173f4b424123901f3d81ff",
    "internal/characters/layla/attack.go": "1860c7698dea0749d30b973de524625ef9a8abb6c4d167d11a511b954740a142",
    "internal/characters/layla/zz_layla.dm.go": "7f773f7980f4faab7372f456c4be022d24e1abcf7012f8ed19de774da251760d",
    "internal/characters/lisa/attack.go": "2ffe7d92a227f81533171a3a297db7d306c245c05429cdb2ff37b01b88b8a255",
    "internal/characters/lisa/zz_lisa.dm.go": "7e523e0302c8a3c46fa5c44e8b2f77b2eeb914d1ace2003a81d5fd3b8798be30",
    "internal/characters/lynette/attack.go": "56f26ed80a320f82e8c5152398cf793fa93a7b2b8037ee33bacbb612bef632a4",
    "internal/characters/lynette/zz_lynette.dm.go": "bdb5f0511247750aa423c165d154010fcfdec5d09f58b75e5442329654b7d95d",
    "internal/characters/lyney/attack.go": "fb38db4bcace83fa18f97ce740216833259e3adbab7d456080af1202bcc1a3e2",
    "internal/characters/lyney/zz_lyney.dm.go": "5bee3ac01fd4eaacfd35bb9f62de174523a27bf49d8a5601bc6faccc079ca05e",
    "internal/characters/mizuki/attack.go": "2168c62ee0a388c5cb469aea8bc8e8e054666092157ee2f15d189a3abc9baffa",
    "internal/characters/mizuki/zz_yumemizukimizuki.dm.go": "1573a2f115f4cf817caed3c63ab850705a8baab63c46351660a65e608601562f",
    "internal/characters/mona/attack.go": "3bcf7c99c4db68473e0b7a54119281b11c01f2bab281ae61fb587ed03f952550",
    "internal/characters/mona/zz_mona.dm.go": "dba0d1045d020575dc7ef63d3c47dff08699a53d19f57c4e876c3b333f7cd139",
    "internal/characters/nahida/attack.go": "5f7540ca2398f21745705c8d4a684e1157b4eeb0c7da83d05cf571ceba8dcc20",
    "internal/characters/nahida/zz_nahida.dm.go": "9da0488e4e5060d6a654ec04286c209481ef1da7e29169d48dd872afd4522037",
    "internal/characters/navia/asc.go": "8f7d7ec576cdce36cfd3fd113c7396cd0d10bbae311c2c06a09542ef56683098",
    "internal/characters/navia/attack.go": "88788602ce7e64183b14bb033278cd9f749094b28745539e696283e71f2119e1",
    "internal/characters/navia/navia.go": "24af3cc73d007991996a4def5578d1ef0b17e71d6945b007daf47e6957b84434",
    "internal/characters/navia/zz_navia.dm.go": "ece9421e380aa5574ade9d75048167da244f272a77b1a815bda5cbf40f6c3d2d",
    "internal/characters/neuvillette/attack.go": "970208bd452d74ab1b7a34b9b7570b8e8b1cbf557e21ac1543c03b008cec3718",
    "internal/characters/neuvillette/zz_neuvillette.dm.go": "ff69094d9354cd5291116e5efd3e1cb9424de2497d223757dc24dbfdd57f77ab",
    "internal/characters/ororon/attack.go": "c567eae9e712a47f008c1a09f7d35e86794b45b29e6b4a98c2a93bf9c55c1f41",
    "internal/characters/ororon/zz_ororon.dm.go": "6f89a00292fe4efd86725348ceeac4e48d9ede32ad3374ced6ad10b2b71ed5e6",
    "internal/characters/qiqi/attack.go": "67fa64bb28ed49befa6fcf4ad12a72653ecbf15e5bdbaef53be71ee96735d7ef",
    "internal/characters/qiqi/zz_qiqi.dm.go": "adaefdcae70b38dc10eba79f771825df389e799f574a8cf4ba29c375d0ecc4cb",
    "internal/characters/sara/attack.go": "05cbb84ee36ea01693669463da4055f0f20c03fb1b59266fbe1ae8c145de4405",
    "internal/characters/sara/zz_kujousara.dm.go": "cdddde23c2f007260761598bf5bc66700a2a9eec22d60c1c84bda8ca3b34d091",
    "internal/characters/sayu/attack.go": "7ff8451f03d7e4bd2dc7161ed2c7db7a0b6c183599ce420b0247aa1eae688c20",
    "internal/characters/sayu/zz_sayu.dm.go": "a51e44c86a22b7791b404c78dfcd2029936f67ad9790fdbe65c73e1b30b4bb60",
    "internal/characters/shenhe/attack.go": "1649b908bfe6fb8c59edf6c7136314c2777d2572a9ac14d5fac43a53cd42907a",
    "internal/characters/shenhe/zz_shenhe.dm.go": "3e8f9eed52be2ad71c9c2748edcb4f587862663b7033b012b9a2f37c355043bb",
    "internal/characters/sigewinne/attack.go": "cef23e5e4b1fe718d6e18c326e509cdb3ab192b90b4272b54c42c19685f8b798",
    "internal/characters/sigewinne/zz_sigewinne.dm.go": "41413bf3f591d4e164dbd051e6f3ea5809c8801811b4908136eb4405ec8e66d9",
    "internal/characters/sucrose/attack.go": "39fe0cd79e9cd335aa341e5eef6624b931f26feccb86841a434e1cf234e33949",
    "internal/characters/sucrose/zz_sucrose.dm.go": "2af3199209d8101e20f34afe76a8d45665b577e732bbab7909823f0abf2921bb",
    "internal/characters/tighnari/attack.go": "5b08ae3c7c009b5d7df5f0411f2b8eba688b004c57ecf8f2190a41ad99c9610b",
    "internal/characters/tighnari/zz_tighnari.dm.go": "8319465d076ae6b1482c1c8cf040abc3fa72fa33f79b6dbef71ad7ecb8795823",
    "internal/characters/xiangling/attack.go": "027afdb7627a5970468ba9912433a61d5eae1e61681dc710723e7001cc7cbecc",
    "internal/characters/xiangling/zz_xiangling.dm.go": "514d0f035fbbd02190d700d4e51593be8b01358c0c2ee25e697dd886b2aac4f9",
    "internal/characters/xianyun/attack.go": "c97cf3ad8baf47539a522e34abc474f54e0c3d72c315866765070581a282ea62",
    "internal/characters/xianyun/zz_xianyun.dm.go": "fa1ea41e07aced4e647b368dd19cfe2dc04cbc339e7fc5b3e9ed6f4d90cc5e51",
    "internal/characters/xinyan/attack.go": "5ad6595617e010ce36f4ddb914fec72bc077392df23964b129a6c66381b2aa29",
    "internal/characters/xinyan/zz_xinyan.dm.go": "b544cda32a4c7fa0c601f1f2fbfd734f4b209bc98728476f6b2c65a74d043e80",
    "internal/characters/yaemiko/attack.go": "b1358ef0ff24862e71ed19306e95696079016cd25df97bd155c3ab09e2b679eb",
    "internal/characters/yaemiko/zz_yaemiko.dm.go": "ac1ac715da02a857fe77a0b863e8f1a2d25845ddf557d95b366d70ac5df3fff5",
    "internal/characters/yaoyao/attack.go": "052f85f014a23ec34b8eb22c03d3d6676c3b76436f25d28717a4b589d70a3baf",
    "internal/characters/yaoyao/zz_yaoyao.dm.go": "bf74cd0dea3f4986fb903baf59b2c4b2cb4f796330b54ae4cac4c4a9e6a0d715",
    "internal/characters/yunjin/attack.go": "e0eaab53675213ed6eb60290a83dcba16c2b8294e25b5eaeb422ee84859c2262",
    "internal/characters/yunjin/zz_yunjin.dm.go": "57e416e02ba4077a59b98b2a8d9cda6aba11c663cda67f8bad06d6e81a4d9f67",
    "pkg/enemy/damage.go": "ab467c5206a49c936ce2b3b9412c17dd4367310de9b47cf97a22dfcbe7c38ea8"
  }
} as const;
