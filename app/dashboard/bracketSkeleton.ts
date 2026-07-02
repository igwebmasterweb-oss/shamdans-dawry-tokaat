// هيكل شجرة كأس العالم 2026 الثابت (WC2026 knockout skeleton)
// مبني على ترتيب FIFA الرسمي (M73..M88 لدور الـ32) والتزاوج المؤكد من API-Football.
// الشجرة ثابتة من البداية للنهاية؛ الخانات تتملّى بالفرق المتأهلة والباقي يظهر "؟" (TBD).

export type SkelTeam = { name: string; id: number | null };
export type SkelR32 = { m: number; home: SkelTeam; away: SkelTeam };

// دور الـ32 بترتيب FIFA (M73..M88). team id = api-football team id لمطابقة الشعارات.
export const R32_SKELETON: SkelR32[] = [
  { m: 73, home: { name: 'South Africa', id: 1531 }, away: { name: 'Canada', id: 5529 } },
  { m: 74, home: { name: 'Germany', id: 25 }, away: { name: 'Paraguay', id: 2380 } },
  { m: 75, home: { name: 'Netherlands', id: 1118 }, away: { name: 'Morocco', id: 31 } },
  { m: 76, home: { name: 'Brazil', id: 6 }, away: { name: 'Japan', id: 12 } },
  { m: 77, home: { name: 'France', id: 2 }, away: { name: 'Sweden', id: 5 } },
  { m: 78, home: { name: 'Ivory Coast', id: 1501 }, away: { name: 'Norway', id: 1090 } },
  { m: 79, home: { name: 'Mexico', id: 16 }, away: { name: 'Ecuador', id: 2382 } },
  { m: 80, home: { name: 'England', id: 10 }, away: { name: 'Congo DR', id: 1508 } },
  { m: 81, home: { name: 'USA', id: 2384 }, away: { name: 'Bosnia & Herzegovina', id: 1113 } },
  { m: 82, home: { name: 'Belgium', id: 1 }, away: { name: 'Senegal', id: 13 } },
  { m: 83, home: { name: 'Portugal', id: 27 }, away: { name: 'Croatia', id: 3 } },
  { m: 84, home: { name: 'Spain', id: 9 }, away: { name: 'Austria', id: 775 } },
  { m: 85, home: { name: 'Switzerland', id: 15 }, away: { name: 'Algeria', id: 1532 } },
  { m: 86, home: { name: 'Argentina', id: 26 }, away: { name: 'Cape Verde Islands', id: 1533 } },
  { m: 87, home: { name: 'Colombia', id: 8 }, away: { name: 'Ghana', id: 1504 } },
  { m: 88, home: { name: 'Australia', id: 20 }, away: { name: 'Egypt', id: 32 } },
];

// أزواج دور الـ16: كل زوج = فهرسا مباراتَي R32 (في R32_SKELETON) اللي فايزهم بيتقابلوا.
// الترتيب حسب أرقام مباريات FIFA الرسمية M89..M96 (شمال = M89..M92، يمين = M93..M96).
export const R16_PAIRS: [number, number][] = [
  [3, 5],  // M89  Brazil/Japan × IvoryCoast/Norway   (W76 × W78)
  [0, 2],  // M90  SouthAfrica/Canada × Netherlands/Morocco (W73 × W75)
  [1, 4],  // M91  Germany/Paraguay × France/Sweden    (W74 × W77)
  [6, 7],  // M92  Mexico/Ecuador × England/CongoDR     (W79 × W80)
  [10, 11],// M93  Portugal/Croatia × Spain/Austria     (W83 × W84)
  [8, 9],  // M94  USA/Bosnia × Belgium/Senegal         (W81 × W82)
  [13, 15],// M95  Argentina/CapeVerde × Australia/Egypt (W86 × W88)
  [12, 14],// M96  Switzerland/Algeria × Colombia/Ghana  (W85 × W87)
];

// أزواج ربع النهائي: فهرسا زوجَي R16 (في R16_PAIRS) حسب مباريات FIFA M97..M100.
// M97 = W89×W90 = R16[0]×R16[1] ؛ M99 = W91×W92 = R16[2]×R16[3]
// M98 = W93×W94 = R16[4]×R16[5] ؛ M100 = W95×W96 = R16[6]×R16[7]
export const QF_PAIRS: [number, number][] = [
  [0, 1], // M97 شمال أعلى
  [2, 3], // M99 شمال أسفل
  [4, 5], // M98 يمين أعلى
  [6, 7], // M100 يمين أسفل
];

// أزواج نصف النهائي: فهرسا زوجَي QF (في QF_PAIRS). الشمال = QF0×QF1، اليمين = QF2×QF3.
export const SF_PAIRS: [number, number][] = [
  [0, 1], // نصف نهائي الشمال
  [2, 3], // نصف نهائي اليمين
];

// النهائي = فائز SF-شمال × فائز SF-يمين. (SF_PAIRS[0] × SF_PAIRS[1])

// عدد المباريات في كل جهة لدور الـ32
export const LEFT_R32_COUNT = 8;  // أول 8 (M73..M80)
export const RIGHT_R32_COUNT = 8; // آخر 8 (M81..M88)
