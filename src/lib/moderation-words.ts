// Moderation dictionaries. Add words freely; matching is done on normalised text.
export const WORDS_ID = [
  "anjing", "bangsat", "kontol", "memek", "babi", "goblok", "tolol", "bajingan", "brengsek",
  "sialan", "kampret", "ngentot", "pepek", "jancok", "bego", "keparat", "pantek", "tai", "setan",
];
export const WORDS_EN = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "motherfucker", "slut", "whore", "bullshit",
];
// Regional (Javanese / Sundanese / Betawi common insults)
export const WORDS_REGIONAL = ["asu", "cuk", "dancok", "jembut", "kehed", "bangke", "anying", "sia"];

export const PROFANITY = new Set<string>([...WORDS_ID, ...WORDS_EN, ...WORDS_REGIONAL]);
