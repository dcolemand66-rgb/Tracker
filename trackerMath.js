const EPISODIC_LABELS = ['anime', 'tv series', 'tv show', 'tv'];
const MANGA_LABELS = ['manga', 'comic', 'comics', 'manhwa', 'webtoon'];
const GAME_LABELS = ['game', 'games', 'video game', 'video games'];

export function isEpisodicCategory(categories, catId) {
  if (catId === 'anime' || catId === 'tv_series') return true;
  const cat = categories.find((c) => c.id === catId);
  if (!cat) return false;
  return EPISODIC_LABELS.includes((cat.label || '').trim().toLowerCase());
}

// Manga (and similar) track progress by chapter instead of episode, and
// don't use the "Coming Soon" release-date flow the way a show or game does.
export function isMangaCategory(categories, catId) {
  if (catId === 'manga') return true;
  const cat = categories.find((c) => c.id === catId);
  if (!cat) return false;
  return MANGA_LABELS.includes((cat.label || '').trim().toLowerCase());
}

// Games track progress by completion % instead of episode/chapter count.
// The id check alone used to be the only path (item.category === 'game'
// with no fallback at all) - if a user's actual "Games" category didn't
// happen to have that exact id (e.g. one made through "+ New Category",
// which assigns a random id), the % tracking silently never activated.
// This now matches the same permanent-id + label-fallback pattern as
// manga/anime above.
export function isGameCategory(categories, catId) {
  if (catId === 'game') return true;
  const cat = categories.find((c) => c.id === catId);
  if (!cat) return false;
  return GAME_LABELS.includes((cat.label || '').trim().toLowerCase());
}

export function catLabel(categories, id) {
  const c = categories.find((c) => c.id === id);
  return c ? c.label : 'Other';
}

export function catColor(categories, id) {
  const c = categories.find((c) => c.id === id);
  return c ? c.color : '#8a8474';
}

// Logs a timestamped snapshot whenever progress actually moves forward,
// so a pace (units/day) can be worked out later. One entry per calendar
// day - repeated bumps on the same day update that day's entry rather
// than stacking, so the log reflects "where you ended up today", not
// every individual tap.
export function appendProgressLog(item, newValue) {
  const log = item.progressLog || [];
  const today = new Date().toISOString().slice(0, 10);
  const filtered = log.filter((e) => e.date !== today);
  return [...filtered, { date: today, value: newValue, at: Date.now() }].slice(-30);
}

// A day estimate is a nice bonus when there happens to be at least two
// days of logged progress to derive a pace from, but it's optional -
// estimateCompletion below never depends on this to produce a result.
function estimatePaceDays(item, remaining) {
  const log = item.progressLog || [];
  if (log.length < 2) return null;
  const sorted = [...log].sort((a, b) => a.at - b.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysElapsed = (last.at - first.at) / (24 * 60 * 60 * 1000);
  const unitsGained = last.value - first.value;
  if (daysElapsed <= 0 || unitsGained <= 0) return null;
  const pace = unitsGained / daysElapsed;
  return Math.max(1, Math.ceil(remaining / pace));
}

// Automatic and immediate: works the moment an item has a Current/Total
// entered, no separate logging step needed and nothing to re-add - it
// reads straight off whatever's already on the item. Ranked by remaining
// percentage, since that's the actual answer to "which one is fastest to
// finish" - whichever item has the least percentage left is listed first.
export function estimateCompletion(item, categories) {
  let current;
  let total;
  if (isGameCategory(categories, item.category)) {
    current = Number(item.gamePercent) || 0;
    total = 100;
  } else if (isMangaCategory(categories, item.category)) {
    current = Number(item.progressCurrent) || 0;
    total = Number(item.progressTotal) || 0;
  } else {
    current = Number(item.epCurrent) || 0;
    total = Number(item.epTotal) || 0;
  }
  if (!total || current >= total) return null;
  const remaining = total - current;
  const percent = Math.round((current / total) * 100);
  const remainingPercent = 100 - percent;
  return { percent, remainingPercent, remaining, total, days: estimatePaceDays(item, remaining) };
}
