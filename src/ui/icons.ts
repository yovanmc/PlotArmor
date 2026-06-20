// src/ui/icons.ts
// Single swap-point for every UI-chrome glyph that is currently an emoji.
// When real graphics land, replace each value with the asset — an inline
// `<svg>…</svg>` markup string or an `<img>` tag. Every call site builds HTML via
// innerHTML, so a markup string drops in unchanged: no call site has to change,
// only the values below.
//
// Distinct CONCEPTS get distinct entries even where the emoji currently coincide
// (e.g. `words` vs `publishingHouse`, `inElement` vs `worn`), so each can later
// take its own artwork.
//
// NOT defined here — these are already single swap-points elsewhere:
//   • Enemy / boss art  → content.ts ZONES.enemyEmojis / bossEmoji (read via targetEmoji()).
//   • World skin faces  → content.ts WORLD_FACE (indexed by world).
//   • Static page labels (📚 title, 📖 Publish, 🎴 Collection) → index.html (one file).
export const ICON = {
  // resources / economy
  inspiration: '✒️',
  words: '📖',
  royalties: '💰',
  edits: '✏️',
  dps: '⚔️',
  manuscript: '📜',
  publishingHouse: '📖', // the Publishing House menu button (distinct concept from `words`)
  // status / indicators
  sets: '🎭',
  ensemble: '🌈',
  inElement: '✨', // the zone-affinity "in element" marker
  worn: '✨',      // the gallery "currently worn skin" marker (distinct concept from `inElement`)
  starFull: '★',
  starEmpty: '☆',
  locked: '🔒',
  owned: '✓',
  recruitAdd: '➕',
  baseFace: '✍️',  // the no-skin (base look) character face
} as const;

// A star rating rendered as filled + empty pips, e.g. starPips(2, 5) -> "★★☆☆☆".
export function starPips(filled: number, max: number): string {
  return ICON.starFull.repeat(filled) + ICON.starEmpty.repeat(max - filled);
}
