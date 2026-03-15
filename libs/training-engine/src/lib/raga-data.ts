import { IndianNote } from '@voice-tuner/pitch-detection';

// ── Raga Definitions ──────────────────────────────────────

export type MelakartaChakra =
  | 'Indu'    // 1–6
  | 'Netra'   // 7–12
  | 'Agni'    // 13–18
  | 'Veda'    // 19–24
  | 'Bana'    // 25–30
  | 'Rutu'    // 31–36
  | 'Rishi'   // 37–42
  | 'Vasu'    // 43–48
  | 'Brahma'  // 49–54
  | 'Disi'    // 55–60
  | 'Rudra'   // 61–66
  | 'Aditya'; // 67–72

export interface RagaDefinition {
  id:          string;
  name:        string;
  englishName: string;
  thaat:       string;
  time:        string;       // traditional performance time
  notes:       IndianNote[]; // Aroh + Avaroh combined set
  aroh:        IndianNote[]; // ascending
  avaroh:      IndianNote[]; // descending
  vadi:        IndianNote;   // most important note
  samvadi:     IndianNote;   // second most important note
  color:       string;       // brand color for UI
  mood:        string;       // rasa/mood
  description: string;
  melaNumber?: number;       // 1–72 for Melakarta ragas
  chakra?:     MelakartaChakra;
}

// ── Chakra Lookup ─────────────────────────────────────────

export const MELAKARTA_CHAKRAS: { name: MelakartaChakra; range: [number, number]; meaning: string }[] = [
  { name: 'Indu',   range: [1, 6],   meaning: 'Moon' },
  { name: 'Netra',  range: [7, 12],  meaning: 'Eyes' },
  { name: 'Agni',   range: [13, 18], meaning: 'Fire' },
  { name: 'Veda',   range: [19, 24], meaning: 'Scriptures' },
  { name: 'Bana',   range: [25, 30], meaning: 'Arrow' },
  { name: 'Rutu',   range: [31, 36], meaning: 'Season' },
  { name: 'Rishi',  range: [37, 42], meaning: 'Sage' },
  { name: 'Vasu',   range: [43, 48], meaning: 'Wealth' },
  { name: 'Brahma', range: [49, 54], meaning: 'Creator' },
  { name: 'Disi',   range: [55, 60], meaning: 'Direction' },
  { name: 'Rudra',  range: [61, 66], meaning: 'Destroyer' },
  { name: 'Aditya', range: [67, 72], meaning: 'Sun' },
];

// Palette used for Melakarta ragas — cycles through 12 chakra colors
const CHAKRA_COLORS: Record<MelakartaChakra, string> = {
  Indu:   '#7C4DFF',
  Netra:  '#FF6D00',
  Agni:   '#FF1744',
  Veda:   '#00BCD4',
  Bana:   '#4CAF50',
  Rutu:   '#E91E63',
  Rishi:  '#3F51B5',
  Vasu:   '#FF9800',
  Brahma: '#9C27B0',
  Disi:   '#00897B',
  Rudra:  '#F44336',
  Aditya: '#FFC107',
};

function chakraOf(mela: number): MelakartaChakra {
  const idx = Math.floor((mela - 1) / 6);
  return MELAKARTA_CHAKRAS[idx].name;
}

// ── Existing Ragas (non-Melakarta / Janya) ────────────────

export const RAGAS: Record<string, RagaDefinition> = {
  yaman: {
    id:          'yaman',
    name:        'यमन',
    englishName: 'Yaman',
    thaat:       'Kalyan',
    time:        'Evening',
    notes:       ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni'],
    aroh:        ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni', 'Sa'],
    avaroh:      ['Sa', 'Ni', 'Dha', 'Pa', 'Ma#', 'Ga', 'Re', 'Sa'],
    vadi:        'Ga',
    samvadi:     'Ni',
    color:       '#7C4DFF',
    mood:        'Serene, Romantic, Devotional',
    description: 'The most popular evening raga. Uses all sharp (teevra) Ma. Foundation raga of Kalyan thaat.'
  },
  bhairav: {
    id:          'bhairav',
    name:        'भैरव',
    englishName: 'Bhairav',
    thaat:       'Bhairav',
    time:        'Morning',
    notes:       ['Sa', 'Re♭', 'Ga', 'Ma', 'Pa', 'Dha♭', 'Ni'],
    aroh:        ['Sa', 'Re♭', 'Ga', 'Ma', 'Pa', 'Dha♭', 'Ni', 'Sa'],
    avaroh:      ['Sa', 'Ni', 'Dha♭', 'Pa', 'Ma', 'Ga', 'Re♭', 'Sa'],
    vadi:        'Dha♭',
    samvadi:     'Re♭',
    color:       '#FF6D00',
    mood:        'Solemn, Majestic, Devotional',
    description: 'A profound morning raga associated with Lord Shiva. Uses both komal Re and komal Dha.'
  },
  hamsadhwani: {
    id:          'hamsadhwani',
    name:        'हंसध्वनि',
    englishName: 'Hamsadhwani',
    thaat:       'Kalyan',
    time:        'Evening',
    notes:       ['Sa', 'Re', 'Ga', 'Pa', 'Ni'],
    aroh:        ['Sa', 'Re', 'Ga', 'Pa', 'Ni', 'Sa'],
    avaroh:      ['Sa', 'Ni', 'Pa', 'Ga', 'Re', 'Sa'],
    vadi:        'Ga',
    samvadi:     'Ni',
    color:       '#E91E63',
    mood:        'Joy, Devotion, Playfulness',
    description: 'A pentatonic raga that omits Ma and Dha. Popular for invoking Lord Ganesha.'
  },
  bihag: {
    id:          'bihag',
    name:        'बिहाग',
    englishName: 'Bihag',
    thaat:       'Bilawal',
    time:        'Night',
    notes:       ['Sa', 'Ga', 'Ma', 'Ma#', 'Pa', 'Ni'],
    aroh:        ['Sa', 'Ga', 'Ma', 'Pa', 'Ni', 'Sa'],
    avaroh:      ['Sa', 'Ni', 'Dha', 'Pa', 'Ma#', 'Pa', 'Ma', 'Ga', 'Sa'],
    vadi:        'Ga',
    samvadi:     'Ni',
    color:       '#3F51B5',
    mood:        'Romantic, Intimate',
    description: 'A late-night raga with both shuddha and teevra Ma. Known for its romantic character.'
  },
  bhimpalasi: {
    id:          'bhimpalasi',
    name:        'भीमपलासी',
    englishName: 'Bhimpalasi',
    thaat:       'Kafi',
    time:        'Afternoon',
    notes:       ['Sa', 'Re', 'Ga♭', 'Ma', 'Pa', 'Dha', 'Ni♭'],
    aroh:        ['Sa', 'Ma', 'Ga♭', 'Ma', 'Dha', 'Ni♭', 'Sa'],
    avaroh:      ['Sa', 'Ni♭', 'Dha', 'Pa', 'Ma', 'Ga♭', 'Re', 'Sa'],
    vadi:        'Ga♭',
    samvadi:     'Ni♭',
    color:       '#FF9800',
    mood:        'Yearning, Melancholy, Beauty',
    description: 'An afternoon raga of Kafi thaat. Known for its deeply expressive character.'
  }
};

// ── 72 Melakarta Ragas ────────────────────────────────────
// Carnatic system: Sa and Pa are fixed. The remaining 5 notes
// (Ri, Ga, Ma, Dha, Ni) vary across the 72 ragas.
// Melakartas 1–36 use shuddha Ma; 37–72 use prati (teevra) Ma.
// Within each half, the 6 Ri-Ga pairs cycle with 6 Dha-Ni pairs.

type MelaSpec = [number, string, string, IndianNote[], IndianNote];

const MELAKARTA_DATA: MelaSpec[] = [
  // ── Chakra 1: Indu (1–6) — Shuddha Ma, Re♭ Ga♭ ─────
  [1,  'Kanakangi',        'कनकांगी',     ['Sa','Re♭','Ga♭','Ma','Pa','Dha♭','Ni♭'], 'Ma'],
  [2,  'Ratnangi',         'रत्नांगी',     ['Sa','Re♭','Ga♭','Ma','Pa','Dha♭','Ni'],  'Ma'],
  [3,  'Ganamurti',        'गानमूर्ति',    ['Sa','Re♭','Ga♭','Ma','Pa','Dha','Ni♭'],  'Ma'],
  [4,  'Vanaspati',        'वनस्पति',     ['Sa','Re♭','Ga♭','Ma','Pa','Dha','Ni'],   'Ma'],
  [5,  'Manavati',         'मानवती',      ['Sa','Re♭','Ga♭','Ma','Pa','Dha♭','Ni♭'], 'Pa'],
  [6,  'Tanarupi',         'तानरूपी',     ['Sa','Re♭','Ga♭','Ma','Pa','Dha♭','Ni'],  'Pa'],

  // ── Chakra 2: Netra (7–12) — Shuddha Ma, Re♭ Ga ────
  [7,  'Senavati',         'सेनावती',      ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni♭'],  'Ma'],
  [8,  'Hanumatodi',       'हनुमतोड़ी',    ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni'],   'Ma'],
  [9,  'Dhenuka',          'धेनुका',       ['Sa','Re♭','Ga','Ma','Pa','Dha','Ni♭'],   'Ma'],
  [10, 'Natakapriya',      'नाटकप्रिया',   ['Sa','Re♭','Ga','Ma','Pa','Dha','Ni'],    'Ma'],
  [11, 'Kokilapriya',      'कोकिलप्रिया',  ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni♭'],  'Pa'],
  [12, 'Rupavati',         'रूपवती',       ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni'],   'Pa'],

  // ── Chakra 3: Agni (13–18) — Shuddha Ma, Re♭ Ga ────
  [13, 'Gayakapriya',      'गायकप्रिया',   ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni♭'],  'Ga'],
  [14, 'Vakulabharanam',   'वकुलाभरणम्',  ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni'],   'Ga'],
  [15, 'Mayamalavagowla',  'मायामालवगौला', ['Sa','Re♭','Ga','Ma','Pa','Dha♭','Ni'],   'Ga'],
  [16, 'Chakravakam',      'चक्रवाकम्',    ['Sa','Re♭','Ga','Ma','Pa','Dha','Ni♭'],   'Ga'],
  [17, 'Suryakantam',      'सूर्यकान्तम्', ['Sa','Re♭','Ga','Ma','Pa','Dha','Ni'],    'Ga'],
  [18, 'Hatakambari',      'हाटकाम्बरी',   ['Sa','Re♭','Ga','Ma','Pa','Dha','Ni'],    'Pa'],

  // ── Chakra 4: Veda (19–24) — Shuddha Ma, Re Ga ─────
  [19, 'Jhankaradhwani',   'झंकारध्वनि',  ['Sa','Re','Ga♭','Ma','Pa','Dha♭','Ni♭'],  'Re'],
  [20, 'Natabhairavi',     'नटभैरवी',     ['Sa','Re','Ga♭','Ma','Pa','Dha♭','Ni'],   'Re'],
  [21, 'Kiranavali',       'किरणावली',     ['Sa','Re','Ga♭','Ma','Pa','Dha','Ni♭'],   'Re'],
  [22, 'Kharaharapriya',   'खरहरप्रिया',   ['Sa','Re','Ga♭','Ma','Pa','Dha','Ni'],    'Re'],
  [23, 'Gourimanohari',    'गौरीमनोहरी',   ['Sa','Re','Ga♭','Ma','Pa','Dha♭','Ni♭'],  'Pa'],
  [24, 'Varunapriya',      'वरुणप्रिया',    ['Sa','Re','Ga♭','Ma','Pa','Dha♭','Ni'],   'Pa'],

  // ── Chakra 5: Bana (25–30) — Shuddha Ma, Re Ga ─────
  [25, 'Mararanjani',      'मररंजनी',      ['Sa','Re','Ga♭','Ma','Pa','Dha♭','Ni♭'],  'Dha♭'],
  [26, 'Charukesi',        'चारुकेशी',     ['Sa','Re','Ga♭','Ma','Pa','Dha♭','Ni'],   'Dha♭'],
  [27, 'Sarasangi',        'सरसांगी',      ['Sa','Re','Ga♭','Ma','Pa','Dha','Ni♭'],   'Dha'],
  [28, 'Harikambhoji',     'हरिकाम्भोजी',  ['Sa','Re','Ga','Ma','Pa','Dha','Ni♭'],    'Dha'],
  [29, 'Dheerasankarabharanam', 'धीरशंकराभरणम्', ['Sa','Re','Ga','Ma','Pa','Dha','Ni'], 'Dha'],
  [30, 'Naganandini',      'नागानन्दिनी',   ['Sa','Re','Ga','Ma','Pa','Dha','Ni'],     'Pa'],

  // ── Chakra 6: Rutu (31–36) — Shuddha Ma, Re Ga ─────
  [31, 'Yagapriya',        'यागप्रिया',     ['Sa','Re','Ga','Ma','Pa','Dha♭','Ni♭'],   'Ga'],
  [32, 'Ragavardhini',     'रागवर्धिनी',    ['Sa','Re','Ga','Ma','Pa','Dha♭','Ni'],    'Ga'],
  [33, 'Gangeyabhushini',  'गांगेयभूषिणी',  ['Sa','Re','Ga','Ma','Pa','Dha','Ni♭'],    'Ga'],
  [34, 'Vagadheeswari',    'वागधीश्वरी',   ['Sa','Re','Ga','Ma','Pa','Dha','Ni'],     'Ga'],
  [35, 'Shulini',          'शूलिनी',       ['Sa','Re','Ga','Ma','Pa','Dha♭','Ni♭'],   'Pa'],
  [36, 'Chalanata',        'चलनाट',       ['Sa','Re','Ga','Ma','Pa','Dha♭','Ni'],    'Pa'],

  // ── Chakra 7: Rishi (37–42) — Prati Ma, Re♭ Ga♭ ────
  [37, 'Salagam',          'सालगम्',       ['Sa','Re♭','Ga♭','Ma#','Pa','Dha♭','Ni♭'], 'Ma#'],
  [38, 'Jalarnavam',       'जलार्णवम्',    ['Sa','Re♭','Ga♭','Ma#','Pa','Dha♭','Ni'],  'Ma#'],
  [39, 'Jhalavarali',      'झालवराली',     ['Sa','Re♭','Ga♭','Ma#','Pa','Dha','Ni♭'],  'Ma#'],
  [40, 'Navaneetam',       'नवनीतम्',      ['Sa','Re♭','Ga♭','Ma#','Pa','Dha','Ni'],   'Ma#'],
  [41, 'Pavani',           'पावनी',        ['Sa','Re♭','Ga♭','Ma#','Pa','Dha♭','Ni♭'], 'Pa'],
  [42, 'Raghupriya',       'रघुप्रिया',     ['Sa','Re♭','Ga♭','Ma#','Pa','Dha♭','Ni'],  'Pa'],

  // ── Chakra 8: Vasu (43–48) — Prati Ma, Re♭ Ga ──────
  [43, 'Gavambhodi',       'गवाम्बोधी',    ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni♭'],  'Ma#'],
  [44, 'Bhavapriya',       'भावप्रिया',     ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni'],   'Ma#'],
  [45, 'Shubhapantuvarali','शुभपन्तुवराली', ['Sa','Re♭','Ga','Ma#','Pa','Dha','Ni♭'],   'Ma#'],
  [46, 'Shadvidhamargini', 'षड्विधमार्गिणी', ['Sa','Re♭','Ga','Ma#','Pa','Dha','Ni'],    'Ma#'],
  [47, 'Suvarnangi',       'सुवर्णांगी',    ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni♭'],  'Pa'],
  [48, 'Divyamani',        'दिव्यमणी',     ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni'],   'Pa'],

  // ── Chakra 9: Brahma (49–54) — Prati Ma, Re♭ Ga ────
  [49, 'Dhavalambari',     'धवलाम्बरी',    ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni♭'],  'Ga'],
  [50, 'Namanarayani',     'नामनारायणी',   ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni'],   'Ga'],
  [51, 'Kamavardhini',     'कामवर्धिनी',    ['Sa','Re♭','Ga','Ma#','Pa','Dha♭','Ni'],   'Ga'],
  [52, 'Ramapriya',        'रामप्रिया',     ['Sa','Re♭','Ga','Ma#','Pa','Dha','Ni♭'],   'Ga'],
  [53, 'Gamanashrama',     'गमनश्रमा',    ['Sa','Re♭','Ga','Ma#','Pa','Dha','Ni'],    'Ga'],
  [54, 'Vishwambhari',     'विश्वम्भरी',    ['Sa','Re♭','Ga','Ma#','Pa','Dha','Ni'],    'Pa'],

  // ── Chakra 10: Disi (55–60) — Prati Ma, Re Ga♭ ─────
  [55, 'Shamalangi',       'श्यामलांगी',    ['Sa','Re','Ga♭','Ma#','Pa','Dha♭','Ni♭'],  'Re'],
  [56, 'Shanmukhapriya',   'षण्मुखप्रिया',  ['Sa','Re','Ga♭','Ma#','Pa','Dha♭','Ni'],   'Re'],
  [57, 'Simhendramadhyamam','सिंहेन्द्रमध्यमम्', ['Sa','Re','Ga♭','Ma#','Pa','Dha','Ni♭'], 'Re'],
  [58, 'Hemavati',         'हेमावती',       ['Sa','Re','Ga♭','Ma#','Pa','Dha','Ni'],    'Re'],
  [59, 'Dharmavati',       'धर्मवती',       ['Sa','Re','Ga♭','Ma#','Pa','Dha♭','Ni♭'],  'Pa'],
  [60, 'Neetimati',        'नीतिमती',       ['Sa','Re','Ga♭','Ma#','Pa','Dha♭','Ni'],   'Pa'],

  // ── Chakra 11: Rudra (61–66) — Prati Ma, Re Ga ─────
  [61, 'Kantamani',        'कान्तामणी',     ['Sa','Re','Ga','Ma#','Pa','Dha♭','Ni♭'],   'Dha♭'],
  [62, 'Rishabhapriya',    'ऋषभप्रिया',    ['Sa','Re','Ga','Ma#','Pa','Dha♭','Ni'],    'Dha♭'],
  [63, 'Latangi',          'लतांगी',        ['Sa','Re','Ga','Ma#','Pa','Dha','Ni♭'],    'Dha'],
  [64, 'Vachaspati',       'वाचस्पति',     ['Sa','Re','Ga','Ma#','Pa','Dha','Ni'],     'Dha'],
  [65, 'Mechakalyani',     'मेचकल्याणी',   ['Sa','Re','Ga','Ma#','Pa','Dha','Ni'],     'Dha'],
  [66, 'Chitrambari',      'चित्राम्बरी',    ['Sa','Re','Ga','Ma#','Pa','Dha','Ni'],     'Pa'],

  // ── Chakra 12: Aditya (67–72) — Prati Ma, Re Ga ────
  [67, 'Sucharitra',       'सुचरित्रा',     ['Sa','Re','Ga','Ma#','Pa','Dha♭','Ni♭'],   'Ga'],
  [68, 'Jyotiswarupini',   'ज्योतिस्वरूपिणी', ['Sa','Re','Ga','Ma#','Pa','Dha♭','Ni'],  'Ga'],
  [69, 'Dhatuvardhini',    'धातुवर्धिनी',   ['Sa','Re','Ga','Ma#','Pa','Dha','Ni♭'],    'Ga'],
  [70, 'Nasikabhushini',   'नासिकाभूषिणी', ['Sa','Re','Ga','Ma#','Pa','Dha','Ni'],     'Ga'],
  [71, 'Kosalam',          'कोसलम्',       ['Sa','Re','Ga','Ma#','Pa','Dha♭','Ni♭'],   'Pa'],
  [72, 'Rasikapriya',      'रसिकप्रिया',    ['Sa','Re','Ga','Ma#','Pa','Dha♭','Ni'],    'Pa'],
];

// Build Melakarta raga records from the compact data table
for (const [mela, eng, hindi, notes, vadi] of MELAKARTA_DATA) {
  const ch = chakraOf(mela);
  const aroh: IndianNote[]  = [...notes, 'Sa'];
  const avaroh: IndianNote[] = [...[...notes].reverse(), 'Sa'];

  // Pick samvadi: Pa if vadi is not Pa, else Sa
  const samvadi: IndianNote = vadi === 'Pa' ? 'Sa' : 'Pa';

  const id = eng.toLowerCase().replace(/[^a-z]/g, '');
  const hasPratiMa = notes.includes('Ma#');

  RAGAS[id] = {
    id,
    name:        hindi,
    englishName: eng,
    thaat:       ch,
    time:        hasPratiMa ? 'Evening' : 'Morning',
    notes:       notes as IndianNote[],
    aroh,
    avaroh,
    vadi:        vadi as IndianNote,
    samvadi,
    color:       CHAKRA_COLORS[ch],
    mood:        hasPratiMa ? 'Bright, Powerful' : 'Calm, Meditative',
    description: `Melakarta #${mela} (${ch} chakra). ${hasPratiMa ? 'Uses prati (teevra) Ma.' : 'Uses shuddha Ma.'}`,
    melaNumber:  mela,
    chakra:      ch,
  };
}

export const RAGA_LIST = Object.values(RAGAS);

/** Only the 72 Melakarta ragas, sorted by melaNumber */
export const MELAKARTA_LIST = RAGA_LIST
  .filter((r): r is RagaDefinition & { melaNumber: number } => r.melaNumber != null)
  .sort((a, b) => a.melaNumber - b.melaNumber);

// Semitone offsets of each Indian note from Sa
export const NOTE_SEMITONES: Record<IndianNote, number> = {
  'Sa':   0,  'Re♭': 1, 'Re':  2,  'Ga♭': 3,
  'Ga':   4,  'Ma':  5, 'Ma#': 6,  'Pa':  7,
  'Dha♭': 8,  'Dha': 9, 'Ni♭': 10, 'Ni':  11
};
