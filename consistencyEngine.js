// Consistency & Difficulty engine
// ---------------------------------
// This is deliberately separate from growthMath.js. Growth answers "what
// number should today's target be" (reps/minutes/pages) for habits that
// have one. This answers a different question that EVERY habit has, even
// ones with no number at all (meditation, chess, self-care): "how well
// have I actually been showing up for this, lately" - and turns that into
// a difficulty LEVEL that can climb when you're consistent and slide back
// down when you're not, instead of only ever climbing the way growth's
// per-completion counter does.
//
// This module only computes the level and the day's mood-adjusted
// effective level. It does NOT decide what a "harder workout" or a
// "trickier breathing pattern" actually looks like - that's on purpose
// (framework first, per-habit content libraries later). A session screen
// is expected to read `effectiveLevel` (1-10) and `tier` and use that to
// pick from whatever content set it defines for itself.
//
// Shape stored on a habit:
// difficulty: {
//   enabled: false,
// }
// (No history/score is persisted - it's derived fresh from the habit's
// own doneDates + days every time, the same source streaks already use,
// so it can never drift out of sync with what actually happened.)

import { habitScheduledOn, habitDoneOn, localDateKey } from './habitUtils';

export const WINDOW_DAYS = 28;
export const TREND_LOOKBACK_DAYS = 7;

export const TIERS = [
  { max: 20, label: 'Just Starting', short: 'Starting' },
  { max: 40, label: 'Building', short: 'Building' },
  { max: 60, label: 'Consistent', short: 'Consistent' },
  { max: 80, label: 'Strong', short: 'Strong' },
  { max: 100, label: 'Elite', short: 'Elite' },
];

export function defaultDifficulty() {
  return { enabled: false };
}

// Recency-weighted hit rate over the trailing `windowDays`, ending on
// `asOf` (defaults to today). Recent due-days count more than older
// ones (each day back counts ~10% less) so the score actually responds
// to "how's it going lately" instead of being anchored by something
// that happened three weeks ago and never letting go of it - which is
// what a plain hits/total ratio over the same window would do.
function weightedScore(habit, windowDays, asOf) {
  const end = asOf ? new Date(asOf) : new Date();
  let weightedHits = 0;
  let weightedDue = 0;
  const cursor = new Date(end);
  for (let i = 0; i < windowDays; i++) {
    const dow = cursor.getDay();
    const key = localDateKey(cursor);
    if (habitScheduledOn(habit, dow) && key <= localDateKey(end)) {
      const weight = Math.pow(0.9, i);
      weightedDue += weight;
      if (habitDoneOn(habit, key)) weightedHits += weight;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  if (weightedDue === 0) return null; // nothing scheduled/due yet to judge
  return Math.round((weightedHits / weightedDue) * 100);
}

function tierFor(score) {
  const s = score == null ? 50 : score;
  return TIERS.find((t) => s <= t.max) || TIERS[TIERS.length - 1];
}

// 1-10, not just the 5 tiers, so mood can nudge something finer-grained
// than "one whole tier" for a single session.
function levelFromScore(score) {
  const s = score == null ? 50 : score;
  return Math.max(1, Math.min(10, Math.round(s / 10) || 1));
}

// The persistent, no-mood-attached read on a habit: score, 1-10 level,
// tier label, and which way it's been moving lately. This is what a
// Settings/detail screen shows - it never changes just because of how
// today happens to feel.
export function computeConsistency(habit) {
  const score = weightedScore(habit, WINDOW_DAYS);
  const priorDate = new Date();
  priorDate.setDate(priorDate.getDate() - TREND_LOOKBACK_DAYS);
  const priorScore = weightedScore(habit, WINDOW_DAYS, priorDate);

  let trend = 'flat';
  if (score != null && priorScore != null) {
    if (score - priorScore >= 5) trend = 'up';
    else if (score - priorScore <= -5) trend = 'down';
  }

  const tier = tierFor(score);
  return {
    score, // null until the habit has at least one due day in the window
    level: levelFromScore(score),
    tier: tier.label,
    tierShort: tier.short,
    trend, // 'up' | 'down' | 'flat'
    isNew: score == null,
  };
}

// How today's mood nudges the level for THIS session only - it never
// gets written back into the habit or remembered tomorrow. Consistency
// (above) is the slow-moving number; mood is a same-day multiplier on
// top of it.
export const MOODS = [
  { key: 'rough', emoji: '😩', label: 'Rough', delta: -2 },
  { key: 'okay', emoji: '😐', label: 'Okay', delta: 0 },
  { key: 'good', emoji: '🙂', label: 'Feeling Good', delta: 1 },
  { key: 'strong', emoji: '💪', label: 'Strong', delta: 2 },
];

export function moodByKey(key) {
  return MOODS.find((m) => m.key === key) || MOODS[1];
}

// The single thing a session screen actually needs: today's number
// (1-10) after both consistency and mood are folded in, plus the raw
// pieces in case it wants to explain itself ("you're Consistent, and
// feeling strong, so here's a tougher round today").
//
// TODO (content phase, per-habit): once a habit type has a real variety
// library (e.g. GuidedWorkoutSession's exercise pool, MeditationSession's
// breathing patterns), it should map `effectiveLevel` to a pick from that
// pool - low levels pull from the gentler/shorter end, high levels pull
// from the harder/longer or newly-unlocked end. Nothing below the
// framework depends on that mapping existing yet.
export function getSessionDifficulty(habit, moodKey) {
  const base = computeConsistency(habit);
  const mood = moodByKey(moodKey);
  const effectiveLevel = Math.max(1, Math.min(10, base.level + mood.delta));
  return {
    ...base,
    mood: mood.key,
    moodLabel: mood.label,
    moodEmoji: mood.emoji,
    effectiveLevel,
  };
}
