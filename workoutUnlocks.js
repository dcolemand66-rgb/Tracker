// Workout exercise unlocks
// ------------------------
// Separate from the 10-level Push-ups/Squats/Plank ladder in
// GuidedWorkoutSession.js (which controls how HARD those three
// movements get). This controls WHICH OTHER movements show up at all -
// it grows the workout wider, not just harder, so the body isn't only
// ever doing push/squat/plank variations forever.
//
// The trigger is cumulative REP volume: every rep-based block you
// finish (push-ups, squats, and later the unlocked exercises
// themselves) adds its rep count to one running total on the habit.
// Time-based blocks (plank, wall sit) don't feed this number - "reps"
// stays reps, not a mix of reps and seconds. Cross a threshold, the
// next exercise in the queue unlocks for good and gets added onto every
// session's blocks from then on.
//
// Order is basics-first and spread across movement patterns on purpose
// (push, legs, posterior chain/hinge, core, then the harder
// full-body/pull moves) so growth stays whole-body instead of stacking
// five more push-up variants:
export const WORKOUT_UNLOCKS = [
  {
    id: 'glute_bridge',
    threshold: 50,
    name: 'Glute Bridges',
    mode: 'reps',
    target: 12,
    rest: 0,
    cue:
      'Lie on your back, knees bent, feet flat on the floor hip-width apart. Squeeze your glutes to lift your hips until your body forms a straight line from shoulders to knees, then lower with control.',
  },
  {
    id: 'superman',
    threshold: 120,
    name: 'Superman Hold',
    mode: 'time',
    seconds: 20,
    rest: 0,
    cue:
      'Lie face down, arms reaching forward. Lift your chest, arms, and legs off the floor at the same time and hold. This is the opposite side of the body from push-ups and planks - it is easy to skip and important not to.',
  },
  {
    id: 'lunges',
    threshold: 200,
    name: 'Alternating Lunges',
    mode: 'reps',
    target: 10,
    rest: 0,
    cue:
      'Step one leg forward and drop your back knee toward the floor, front knee over your ankle, then push back to standing and switch legs. One rep = one side; keep your torso upright the whole way down.',
  },
  {
    id: 'bicycle_crunch',
    threshold: 300,
    name: 'Bicycle Crunches',
    mode: 'reps',
    target: 20,
    rest: 0,
    cue:
      'Hands behind your head, knees pulled in. Bring one elbow toward the opposite knee while straightening the other leg out, then switch sides. One rep = both sides.',
  },
  {
    id: 'mountain_climbers',
    threshold: 425,
    name: 'Mountain Climbers',
    mode: 'reps',
    target: 20,
    rest: 0,
    cue:
      'Start in a push-up position. Drive your knees toward your chest one at a time at a quick, controlled pace, keeping your hips low and core braced. One rep = both legs.',
  },
  {
    id: 'wall_sit',
    threshold: 575,
    name: 'Wall Sit',
    mode: 'time',
    seconds: 30,
    rest: 0,
    cue:
      'Back flat against a wall, slide down until your knees are at roughly 90 degrees, like sitting in an invisible chair. Hold there - your quads will make their opinion known well before the timer runs out.',
  },
  {
    id: 'pike_pushup',
    threshold: 750,
    name: 'Pike Push-ups',
    mode: 'reps',
    target: 8,
    rest: 0,
    cue:
      'Hips high in an inverted-V, hands and feet on the floor. Bend your elbows to lower the top of your head toward the floor, then press back up. This shifts most of the load onto your shoulders instead of your chest.',
  },
  {
    id: 'split_squat',
    threshold: 950,
    name: 'Bulgarian Split Squats',
    mode: 'reps',
    target: 8,
    rest: 0,
    cue:
      'Rear foot up on a chair or step behind you, front foot planted well out in front. Lower straight down until your back knee nearly touches the floor, then drive up through the front heel. One rep = one side; do both.',
  },
  {
    id: 'burpees',
    threshold: 1200,
    name: 'Burpees',
    mode: 'reps',
    target: 8,
    rest: 0,
    cue:
      'Drop into a squat, kick your feet back to a plank, do a push-up, jump your feet back in, then jump up. The full-body finisher this whole progression has been building toward.',
  },
  {
    id: 'pull_ups',
    threshold: 1500,
    name: 'Pull-ups (or Inverted Rows)',
    mode: 'reps',
    target: 3,
    rest: 0,
    cue:
      'Needs a bar (or a sturdy table edge for rows). This is the one pulling movement in the whole progression - if there is nothing to hang from yet, treat this slot as a placeholder until there is.',
  },
];

// Pace: how fast this whole system moves for a given person. "Standard"
// is the numbers below as originally designed. Not everyone's body is
// ready for that same rate, so this scales the track growth (small,
// every-session steps) and the bonus-exercise unlock volume together,
// without touching the order anything unlocks or graduates in.
export const PACE_OPTIONS = [
  {
    id: 'gentle',
    label: 'Gentle',
    stepReps: 1,
    stepSeconds: 3,
    everyCompletions: 2,
    thresholdMultiplier: 1.6,
    blurb: 'Grows by the smallest step, and only every other session. Good for easing back in.',
  },
  {
    id: 'standard',
    label: 'Standard',
    stepReps: 1,
    stepSeconds: 5,
    everyCompletions: 1,
    thresholdMultiplier: 1,
    blurb: 'A small step up every single session - steady and continuous rather than big jumps.',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    stepReps: 2,
    stepSeconds: 8,
    everyCompletions: 1,
    thresholdMultiplier: 0.6,
    blurb: 'A bigger step every session, and unlocks bonus exercises sooner. Good if the basics already feel easy.',
  },
];

export function paceSpec(paceId) {
  return PACE_OPTIONS.find((p) => p.id === paceId) || PACE_OPTIONS[1];
}

// The unlock queue with thresholds scaled for a given pace - this is the
// list any of the functions below should work from so a pace change
// can't leave two different threshold numbers floating around.
export function unlocksForPace(paceId) {
  const mult = paceSpec(paceId).thresholdMultiplier;
  return WORKOUT_UNLOCKS.map((u) => ({ ...u, threshold: Math.max(1, Math.round(u.threshold * mult)) }));
}

// Everything unlocked so far, in unlock order - lowest threshold first,
// so appending them keeps the session roughly basics-to-hardest too.
export function getUnlockedExercises(totalReps, paceId) {
  const t = totalReps || 0;
  return unlocksForPace(paceId).filter((u) => t >= u.threshold);
}

// The next thing to unlock and how much volume is left to get there, for
// showing progress toward it (e.g. "140 / 200 reps to Alternating Lunges").
export function getNextUnlock(totalReps, paceId) {
  const t = totalReps || 0;
  return unlocksForPace(paceId).find((u) => t < u.threshold) || null;
}

// Sum only the rep-based entries from a completed session - time-based
// blocks (plank, wall sit, superman) don't get counted as "reps".
export function repsFromEntries(entries) {
  return (entries || []).reduce((sum, e) => (e.mode === 'reps' ? sum + (Number(e.value) || 0) : sum), 0);
}
