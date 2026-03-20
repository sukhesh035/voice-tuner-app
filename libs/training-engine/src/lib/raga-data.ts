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

// Per-melakarta metadata: [time, mood, description]
const MELAKARTA_META: Record<number, [string, string, string]> = {
  1:  ['Any time',  'Peaceful, Introspective',    'The first melakarta. Foundational scale with all komal notes below Pa.'],
  2:  ['Any time',  'Calm, Gentle',               'Uses komal Re, Ga, Dha and natural Ni. Subtle variation of mela 1.'],
  3:  ['Any time',  'Serene, Reflective',          'Komal Re, Ga, Ni with natural Dha. Rarely heard in concert, deeply meditative.'],
  4:  ['Any time',  'Balanced, Contemplative',     'All komal on the lower side, all natural on upper — balanced character.'],
  5:  ['Morning',   'Devotional, Steady',          'Pa is the vadi, lending a stable, grounded quality. Early morning raga.'],
  6:  ['Morning',   'Tranquil, Focused',           'Pa-centric with komal Re and Ga. Suited for disciplined morning practice.'],
  7:  ['Morning',   'Melancholic, Introspective',  'Komal Re with natural Ga gives a slight tension — pensive morning mood.'],
  8:  ['Morning',   'Solemn, Devotional',          'Parent of Todi — one of Carnatic music\'s most beloved and deep ragas.'],
  9:  ['Morning',   'Soft, Yearning',              'Dha with komal Re produces a delicate, longing quality.'],
  10: ['Morning',   'Bright, Hopeful',             'Natural Dha and Ni with komal Re — brighter than its siblings.'],
  11: ['Morning',   'Meditative, Subdued',         'Pa-centric with komal Dha. Quiet introspection.'],
  12: ['Morning',   'Gentle, Graceful',            'Natural Ni replaces komal Ni — adds a touch of brightness to mela 11.'],
  13: ['Morning',   'Tender, Lyrical',             'Ga is vadi — emphasis on Ga gives a singing, lyrical flow.'],
  14: ['Morning',   'Warm, Devotional',            'Komal Re with natural Ga and Ni — warm devotional quality.'],
  15: ['Morning',   'Majestic, Solemn',            'Parent of Mayamalavagowla, among the most ancient and revered scales.'],
  16: ['Morning',   'Longing, Bittersweet',        'Natural Dha and komal Ni create a characteristic pull.'],
  17: ['Morning',   'Radiant, Expansive',          'All natural upper notes — open, sun-like quality. Named after the Sun.'],
  18: ['Any time',  'Regal, Powerful',             'Pa-centric with all natural upper notes — strong, kingly character.'],
  19: ['Any time',  'Resonant, Mysterious',        'Re-centric with komal Ga and Dha — shimmering, bell-like resonance.'],
  20: ['Night',     'Serious, Deep',               'Parent of Natabhairavi — rich komal notes evoke depth and gravity.'],
  21: ['Evening',   'Luminous, Serene',            'Natural Dha with komal Ni — like rays of light at dusk.'],
  22: ['Afternoon', 'Expressive, Emotive',         'Parent of Kharaharapriya / Kafi — one of the most versatile scales.'],
  23: ['Morning',   'Devotional, Serene',          'Pa-centric with komal Dha. Quiet morning devotion.'],
  24: ['Evening',   'Flowing, Calm',               'Named after Varuna, god of water — smooth, flowing character.'],
  25: ['Evening',   'Romantic, Wistful',           'Dha♭ is vadi — a unique, longing quality with komal Ga.'],
  26: ['Evening',   'Dignified, Melancholic',      'Natural Ni with komal Ga and Dha — dignified evening mood.'],
  27: ['Evening',   'Sweet, Graceful',             'Natural Dha with komal Ni — sweet and graceful.'],
  28: ['Evening',   'Joyful, Festive',             'Parent of Harikambhoji / Khamaj. Natural Ga and Dha, komal Ni — celebratory.'],
  29: ['Evening',   'Majestic, Bright',            'Parent of Shankarabharanam / Bilawal — the natural scale. Full, majestic.'],
  30: ['Any time',  'Stable, Grounded',            'Pa-centric with all natural notes. Epitome of tonal balance.'],
  31: ['Any time',  'Contemplative, Reserved',     'Ga-centric with komal Dha and Ni. Rarely performed — scholarly.'],
  32: ['Evening',   'Intense, Inward',             'Natural Ni with komal Dha — an unusual, intense combination.'],
  33: ['Evening',   'Graceful, Flowing',           'Komal Ni with natural Dha — smooth, flowing lines.'],
  34: ['Any time',  'Assertive, Clear',            'All natural upper notes — clean, assertive character.'],
  35: ['Night',     'Dark, Mysterious',            'Komal Dha and Ni return in mela 35 — shadowy, nocturnal quality.'],
  36: ['Night',     'Strong, Resolute',            'Natural Ni with komal Dha — resolute and powerful.'],
  37: ['Evening',   'Austere, Ancient',            'First prati-Ma mela. Komal Re and Ga with Ma# — ancient, austere mood.'],
  38: ['Evening',   'Vast, Oceanic',               'Named after the ocean (Jala+Arnava). Expansive, unending quality.'],
  39: ['Evening',   'Pensive, Unusual',            'Natural Dha with komal Ni — an uncommon, contemplative combination.'],
  40: ['Evening',   'Sweet, Buttery',              'Named after butter (Navaneetam) — smooth, pleasing character.'],
  41: ['Morning',   'Pure, Cleansing',             'Named after purity (Pavani). Pa-centric — clean, uplifting.'],
  42: ['Evening',   'Devotional, Heroic',          'Named after Raghu-lineage (Raghupati). Heroic, devotional quality.'],
  43: ['Evening',   'Deep, Resonant',              'Komal Re with natural Ga and Ma# — deep and resonant.'],
  44: ['Evening',   'Emotive, Expressive',         'Named after bhava (emotion). Rich expressive potential.'],
  45: ['Evening',   'Auspicious, Celebratory',     'Shubha (auspicious) in name — bright, celebratory prati-Ma scale.'],
  46: ['Evening',   'Complex, Scholarly',          'Six-path scale — a musicological construct rarely performed publicly.'],
  47: ['Evening',   'Shimmering, Radiant',         'Named after gold (Suvarna). Bright, golden character.'],
  48: ['Evening',   'Luminous, Precious',          'Named after gems (Divyamani). Jewel-like, precious quality.'],
  49: ['Evening',   'Bright, White',               'Named after white cloud (Dhavala+Ambara). Light, airy.'],
  50: ['Evening',   'Devotional, Expansive',       'Named after Narayana. Deep devotional resonance.'],
  51: ['Evening',   'Intense, Desire-filled',      'Named after fulfilling desires (Kama+Vardhini). Intense and longing.'],
  52: ['Evening',   'Gentle, Devoted',             'Named after Rama. Tender devotional quality.'],
  53: ['Evening',   'Journeying, Meditative',      'Named after the effort of a journey (Gamana+Shrama). Thoughtful.'],
  54: ['Evening',   'All-encompassing, Majestic',  'Named after the sustainer of the universe. Broad, majestic character.'],
  55: ['Evening',   'Dark, Alluring',              'Named after Shyamala (dark goddess). Deep, alluring quality.'],
  56: ['Evening',   'Bright, Powerful',            'Parent of Shanmukhapriya. Popular prati-Ma scale with wide appeal.'],
  57: ['Evening',   'Regal, Leonine',              'Named after the lion-king (Simha+Indra). Strong, regal character.'],
  58: ['Evening',   'Golden, Radiant',             'Named after gold (Hema). Warm, radiant quality.'],
  59: ['Evening',   'Righteous, Principled',       'Named after dharma (righteousness). Principled, upright character.'],
  60: ['Evening',   'Ethical, Composed',           'Named after right conduct (Neeti). Composed, measured quality.'],
  61: ['Evening',   'Jewel-like, Brilliant',       'Named after the gem of a woman (Kanta+Mani). Brilliant character.'],
  62: ['Evening',   'Noble, Refined',              'Named after Rishabha (the bull). Strong, noble quality.'],
  63: ['Evening',   'Lush, Trailing',              'Named after creepers (Lata). Flowing, vine-like melodic lines.'],
  64: ['Evening',   'Eloquent, Scholarly',         'Named after Brihaspati (lord of speech). Eloquent character.'],
  65: ['Evening',   'Expansive, Bright',           'Parent of Mechakalyani / Yaman Kalyan. Bright, expansive.'],
  66: ['Evening',   'Vivid, Colorful',             'Named after a colorful picture (Chitra+Ambara). Vivid and rich.'],
  67: ['Evening',   'Virtuous, Noble',             'Named after good character (Su+Charitra). Noble, upright quality.'],
  68: ['Evening',   'Luminous, Radiant',           'Named after light personified (Jyoti+Swarupini). Radiant.'],
  69: ['Evening',   'Building, Progressive',       'Named after building material (Dhatu+Vardhini). Progressive, growing.'],
  70: ['Evening',   'Adorned, Graceful',           'Named after adornment of the nose. Graceful, decorative character.'],
  71: ['Evening',   'Regal, Kingly',               'Named after the Kosala kingdom. Regal, historical resonance.'],
  72: ['Evening',   'Joyful, Aesthetic',           'Named after the lover of aesthetics (Rasika+Priya). Joyful and refined.'],
};

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
  // notes starts with 'Sa', so reversing already ends with 'Sa' — no extra 'Sa' needed
  const avaroh: IndianNote[] = [...notes].reverse() as IndianNote[];

  // Pick samvadi: Pa if vadi is not Pa, else Sa
  const samvadi: IndianNote = vadi === 'Pa' ? 'Sa' : 'Pa';

  const id = eng.toLowerCase().replace(/[^a-z]/g, '');
  const [time, mood, description] = MELAKARTA_META[mela] ?? ['Any time', 'Meditative', `Melakarta #${mela} (${ch} chakra).`];

  RAGAS[id] = {
    id,
    name:        hindi,
    englishName: eng,
    thaat:       ch,
    time,
    notes:       notes as IndianNote[],
    aroh,
    avaroh,
    vadi:        vadi as IndianNote,
    samvadi,
    color:       CHAKRA_COLORS[ch],
    mood,
    description,
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
