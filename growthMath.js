// A "growth" habit has a numeric target (reps, minutes, pages...) that
// climbs as the habit actually gets done, instead of staying fixed or
// just climbing on the calendar whether or not you showed up - e.g.
// pushups starting at 10, +2 every 3 times you actually complete the
// habit. Basing it on real completions (each habit's own doneDates,
// already tracked for streaks) rather than elapsed days is what makes
// this automatic and unique per habit: it only advances when that
// specific habit was actually done, with no separate log to keep.
//
// The pace itself can be nudged by how a session actually felt: log
// "Too Easy" and it grows faster from here (fewer completions needed per
// step); log "Too Hard" and it slows down. "Just Right" leaves it alone.
// This is autoregulation, not a fixed curve - the math only decides
// today's number, the feel log is what steers where it goes next.
//
// Shape stored on a habit:
// growth: {
//   enabled: true,
//   startValue: 10,        // target before any completions
//   amount: 2,              // grows by this much...
//   everyDays: 3,            // ...every this many completions of the
//                            // habit (name kept for backward
//                            // compatibility - it means completions, not
//                            // calendar days)
//   startedAt: <timestamp>, // completions before this don't count
//   unit: 'reps',           // free-text label, e.g. 'reps', 'minutes', 'pages'
//   log: [{ date: 'YYYY-MM-DD', feel: 'easy'|'ok'|'hard', target: N }],
// }

export const MIN_EVERY_DAYS = 1;
export const MAX_EVERY_DAYS = 30;

// Keyword-matched starting points so a new growth habit doesn't always
// default to the same generic "10 reps" - each kind of habit gets a
// sensible unique starting shape, still fully editable afterward.
const SUGGESTIONS = [
  { test: /push[\s-]?up/i, startValue: 10, amount: 2, everyDays: 3, unit: 'reps' },
  { test: /sit[\s-]?up|crunch/i, startValue: 15, amount: 3, everyDays: 3, unit: 'reps' },
  { test: /squat/i, startValue: 15, amount: 5, everyDays: 3, unit: 'reps' },
  { test: /pull[\s-]?up|chin[\s-]?up/i, startValue: 3, amount: 1, everyDays: 4, unit: 'reps' },
  { test: /plank/i, startValue: 30, amount: 10, everyDays: 4, unit: 'seconds' },
  { test: /run|jog/i, startValue: 1, amount: 0.5, everyDays: 5, unit: 'miles' },
  { test: /walk/i, startValue: 15, amount: 5, everyDays: 4, unit: 'minutes' },
  { test: /read/i, startValue: 10, amount: 5, everyDays: 3, unit: 'pages' },
  { test: /medita/i, startValue: 5, amount: 2, everyDays: 4, unit: 'minutes' },
  { test: /water|hydrat/i, startValue: 4, amount: 1, everyDays: 5, unit: 'cups' },
  { test: /journal|write/i, startValue: 10, amount: 5, everyDays: 4, unit: 'minutes' },
];

export function suggestGrowthDefaults(habitText) {
  const match = SUGGESTIONS.find((s) => s.test.test(habitText || ''));
  return match
    ? { startValue: match.startValue, amount: match.amount, everyDays: match.everyDays, unit: match.unit }
    : { startValue: 10, amount: 2, everyDays: 3, unit: 'reps' };
}

export function defaultGrowth(habitText) {
  const suggested = suggestGrowthDefaults(habitText);
  return {
    enabled: false,
    ...suggested,
    startedAt: Date.now(),
    log: [],
  };
}

// How many of the habit's own real completions (doneDates) have
// happened since growth was turned on - this is what actually drives
// the target, not the calendar.
export function completionsSinceStart(habit, growth) {
  const start = (growth && growth.startedAt) || Date.now();
  const startKey = new Date(start).toISOString().slice(0, 10);
  const doneDates = habit ? habit.doneDates || {} : {};
  return Object.keys(doneDates).filter((k) => k >= startKey).length;
}

// The number the habit should be at right now, given how many full
// growth steps worth of real completions have happened since it started.
export function currentGrowthTarget(growth, completions) {
  if (!growth || !growth.enabled) return null;
  const every = Math.max(MIN_EVERY_DAYS, growth.everyDays || 1);
  const periods = Math.floor((completions || 0) / every);
  return Math.max(0, (growth.startValue || 0) + periods * (growth.amount || 0));
}

// Completions still needed until the next step up, for a "grows again
// after N more" line.
export function completionsUntilNextStep(growth, completions) {
  if (!growth || !growth.enabled) return null;
  const every = Math.max(MIN_EVERY_DAYS, growth.everyDays || 1);
  const intoPeriod = (completions || 0) % every;
  return every - intoPeriod;
}

// Logs how today's target felt and nudges the pace for next time. At
// most one feel entry per calendar day - logging again today replaces
// today's entry rather than stacking adjustments from the same session.
export function logGrowthFeel(growth, feel, dateKey, completions) {
  const g = growth || defaultGrowth();
  const today = dateKey;
  const target = currentGrowthTarget(g, completions);
  const log = (g.log || []).filter((e) => e.date !== today);
  log.unshift({ date: today, feel, target });

  let everyDays = g.everyDays || 3;
  if (feel === 'easy') everyDays = Math.max(MIN_EVERY_DAYS, everyDays - 1);
  else if (feel === 'hard') everyDays = Math.min(MAX_EVERY_DAYS, everyDays + 1);

  return { ...g, everyDays, log: log.slice(0, 30) };
}

export function hasLoggedFeelToday(growth, dateKey) {
  return !!(growth && (growth.log || []).some((e) => e.date === dateKey));
}
