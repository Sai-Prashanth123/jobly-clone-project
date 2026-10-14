// Language dropdown — used for "Preferred Language" (single select) and
// "Languages Known" (multi-select, serialized into a comma-joined string).
//
// ALPHABETICAL, deliberately. These were grouped by language family before —
// European, then East Asian, then South Asian — with no headings to say so, so
// on screen it simply looked unordered: Thai sat at twelve while Tamil and
// Telugu were at seventeen and eighteen. Reported as "Thai is a little above,
// Telugu and Tamil are somewhere else... all 3 should be at one place".
//
// "Other" stays pinned at the end, where a catch-all belongs.
const NAMES: string[] = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Azerbaijani',
  'Bengali', 'Bosnian', 'Bulgarian', 'Burmese',
  'Cantonese', 'Croatian', 'Czech',
  'Danish', 'Dutch',
  'English',
  'Finnish', 'French',
  'Georgian', 'German', 'Greek', 'Gujarati',
  'Hausa', 'Hebrew', 'Hindi', 'Hungarian',
  'Icelandic', 'Igbo', 'Indonesian', 'Italian',
  'Japanese',
  'Kannada', 'Kazakh', 'Khmer', 'Korean', 'Kurdish',
  'Lao',
  'Malay', 'Malayalam', 'Mandarin', 'Marathi',
  'Nepali', 'Norwegian',
  'Persian (Farsi)', 'Polish', 'Portuguese', 'Punjabi',
  'Romanian', 'Russian',
  'Serbian', 'Sinhala', 'Slovak', 'Somali', 'Spanish', 'Swahili', 'Swedish',
  'Tagalog (Filipino)', 'Tamil', 'Telugu', 'Thai', 'Turkish',
  'Ukrainian', 'Urdu', 'Uzbek',
  'Vietnamese',
  'Yoruba',
  'Zulu',
];

export const LANGUAGES: string[] = [...NAMES, 'Other'];
