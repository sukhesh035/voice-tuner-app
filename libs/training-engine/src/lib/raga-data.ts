import { IndianNote } from '@voice-tuner/pitch-detection';

// ── Raga Definitions ──────────────────────────────────────

export interface RagaDefinition {
  id:          string;
  name:        string;
  englishName: string;
  thaat:       string;
  time:        string;       // traditional performance time
  notes:       IndianNote[];  // Aroh + Avaroh combined set
  aroh:        IndianNote[];  // ascending
  avaroh:      IndianNote[];  // descending
  vadi:        IndianNote;   // most important note
  samvadi:     IndianNote;   // second most important note
  color:       string;       // brand color for UI
  mood:        string;       // rasa/mood
  description: string;
}

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
  kalyani: {
    id:          'kalyani',
    name:        'कल्याणी',
    englishName: 'Kalyani',
    thaat:       'Kalyan',
    time:        'Evening',
    notes:       ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni'],
    aroh:        ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni', 'Sa'],
    avaroh:      ['Sa', 'Ni', 'Dha', 'Pa', 'Ma#', 'Ga', 'Re', 'Sa'],
    vadi:        'Ma#',
    samvadi:     'Sa',
    color:       '#00BCD4',
    mood:        'Bliss, Peace, Serenity',
    description: 'Carnatic equivalent of Yaman. One of the most auspicious ragas in south Indian classical music.'
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
  todi: {
    id:          'todi',
    name:        'तोड़ी',
    englishName: 'Todi',
    thaat:       'Todi',
    time:        'Morning',
    notes:       ['Sa', 'Re♭', 'Ga♭', 'Ma#', 'Pa', 'Dha♭', 'Ni'],
    aroh:        ['Sa', 'Re♭', 'Ga♭', 'Ma#', 'Pa', 'Dha♭', 'Ni', 'Sa'],
    avaroh:      ['Sa', 'Ni', 'Dha♭', 'Pa', 'Ma#', 'Ga♭', 'Re♭', 'Sa'],
    vadi:        'Dha♭',
    samvadi:     'Ga♭',
    color:       '#4CAF50',
    mood:        'Pathos, Longing, Depth',
    description: 'One of the six principal ragas. Very complex and expressive. Considered extremely difficult to master.'
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

export const RAGA_LIST = Object.values(RAGAS);

// Semitone offsets of each Indian note from Sa
export const NOTE_SEMITONES: Record<IndianNote, number> = {
  'Sa':   0,  'Re♭': 1, 'Re':  2,  'Ga♭': 3,
  'Ga':   4,  'Ma':  5, 'Ma#': 6,  'Pa':  7,
  'Dha♭': 8,  'Dha': 9, 'Ni♭': 10, 'Ni':  11
};
