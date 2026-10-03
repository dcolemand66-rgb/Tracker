// Per-page identity, layered on top of the app-wide samurai theme
// (theme.js). The dark ink-black canvas, card shapes, and spacing stay
// exactly the same everywhere - "same bones" - but each of these five
// heavy-traffic tabs gets its own accent color, a header treatment, and
// one small signature motif tied to what that page actually is, so
// Recipes doesn't feel like Habits wearing a different label.
//
// Add an entry here (and a matching case in PageHeader.js's motif
// switch) to bring a new page into the system - nothing else in
// theme.js or the screens that don't opt in changes.

// Marquee red - Tracker is a queue of what to watch/play next, so the
// reference point is a cinema ticket stub, not the app's existing danger
// rose (which already means "missing/low" elsewhere).
export const TRACKER_THEME = {
  key: 'tracker',
  accent: '#c2415f',
  accentDeep: '#8a2c44',
  accentSoft: 'rgba(194,65,95,0.14)',
  fontFamily: 'sans-serif-condensed',
  icon: '🎬',
  motif: 'ticket',
};

// Paprika/terracotta - a kitchen spice color, distinct in hue from the
// app's global gold so Recipes doesn't just read as "more gold."
export const RECIPES_THEME = {
  key: 'recipes',
  accent: '#c2653a',
  accentDeep: '#8a441f',
  accentSoft: 'rgba(194,101,58,0.14)',
  fontFamily: 'serif',
  icon: '🍳',
  motif: 'recipeCard',
};

// Jade - reuses the app's existing quest-scroll green (already the
// color RoadmapIdleWorld and the drawer use for this world) rather than
// inventing a competing one, since Roadmaps' "vibe" was already set
// elsewhere and this just carries it onto the list screen's header.
export const ROADMAPS_THEME = {
  key: 'roadmaps',
  accent: '#4a9a7a',
  accentDeep: '#2f6f57',
  accentSoft: 'rgba(74,154,122,0.14)',
  fontFamily: 'serif',
  icon: '🗺️',
  motif: 'scroll',
};

// Steel blue - a cool, disciplined color for habit-tracking/training,
// set apart from the warm gold/rose/amber/red used everywhere else.
export const HABITS_THEME = {
  key: 'habits',
  accent: '#5b8bd0',
  accentDeep: '#3a5f96',
  accentSoft: 'rgba(91,139,208,0.14)',
  fontFamily: 'sans-serif-black',
  icon: '🥋',
  motif: 'stamp',
};

// Muted plum - an almanac/ink color for the default landing tab, calm
// enough to sit behind a dense daily view without competing with it.
export const CALENDAR_THEME = {
  key: 'calendar',
  accent: '#8b6bb0',
  accentDeep: '#5f4a80',
  accentSoft: 'rgba(139,107,176,0.14)',
  fontFamily: 'serif',
  icon: '📜',
  motif: 'almanac',
};
