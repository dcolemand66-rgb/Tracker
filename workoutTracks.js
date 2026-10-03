// Workout tracks — based on the r/bodyweightfitness Recommended Routine
// -----------------------------------------------------------------------
// Real, evidence-based progressions (not an invented rep-growth curve).
// Six movement patterns + two core patterns, all active from day one -
// nothing is "unlocked" later. Each pattern is a short ladder of
// variations, easiest to hardest. What moves you between variations is
// the Level-Up Rule, straight from the source program:
//
//   - Hit 3 sets at the TOP of the current range, with good form
//     -> move up to the next, harder variation (start back at the
//        bottom of ITS range)
//   - Can't hit the BOTTOM of the range on all 3 sets
//     -> drop down to the previous, easier variation
//   - Otherwise -> stay right here and try again next session
//
// This is what makes it "realistic to how you feel" instead of a fixed
// schedule: a rough day naturally holds you (or drops you back) a level,
// a strong day naturally pushes you up - the number itself is never
// pre-decided.
//
// Rows use your dumbbells (no low bar/rings assumed). Hinge uses your
// dumbbells too, since bodyweight hinge work needs a partner or anchor
// point this setup doesn't have. Push/Pull/Squat stay pure bodyweight -
// your pull-up bar covers the whole Pull line directly. Dip work (which
// needs parallel bars) isn't included since that equipment isn't
// available; its role is already covered by Push.

export const TRACK_KEYS = ['push', 'pull', 'squat', 'hinge', 'row'];
export const CORE_KEYS = ['antiExtension', 'extension'];

function reps(id, name, min, max, cue) {
  return { id, name, mode: 'reps', min, max, cue };
}
function hold(id, name, min, max, cue) {
  return { id, name, mode: 'time', min, max, cue };
}

export const TRACKS = {
  // Cross-referenced across NerdFitness, StartBodyweight, Yellow Dude,
  // Foundational Rehab, and The Clip Out's push-up progressions. Sources
  // disagree on exactly where knee push-ups belong (some skip them
  // entirely, warning they teach a different hip-hinge pattern than a
  // real push-up) - you told me knee push-ups are where you actually
  // want to start, so this keeps that as the entry point, then adds a
  // wide-hand knee variation and a wall check before easing toward the
  // floor through two incline heights and a negative, the way every
  // source agrees is the real bridge to a first full rep.
  push: [
    reps(
      'knee_pushup',
      'Knee Push-ups',
      5,
      8,
      'Hands under shoulders, knees down instead of toes, body straight from knees to head. Lower until your chest is a fist off the floor, then press up.'
    ),
    reps(
      'knee_pushup_wide',
      'Knee Push-ups (wide)',
      5,
      8,
      'Same as a knee push-up, hands set wider than shoulder-width this time. The wider angle shifts more load onto your chest and tests whether your core stays braced when the base changes.'
    ),
    reps(
      'wall_pushup',
      'Wall Push-ups',
      5,
      8,
      'Stand an arm\'s length from a wall, hands flat on it at shoulder height and width, body in one straight line leaning in. A different angle on the same movement - a chance to check that straight-body form holds up when the load is lighter.'
    ),
    reps(
      'incline_pushup_high',
      'Incline Push-ups (high)',
      5,
      8,
      'Hands on a kitchen counter or sturdy table, feet back so your body forms a straight line from head to heels. Lower your chest to the edge, then press up.'
    ),
    reps(
      'incline_pushup_low',
      'Incline Push-ups (low)',
      5,
      8,
      'Same movement, hands on a chair seat instead of a counter - lower and further from the wall, a noticeably bigger jump than it looks on paper.'
    ),
    reps(
      'negative_pushup',
      'Negative Push-ups',
      3,
      5,
      'Start at the top of a push-up on the floor. Lower yourself down as slowly as you can - a 3 to 5 count - then reset however you need to (knees are fine). This controlled lowering is how almost everyone earns their first real push-up.'
    ),
    reps(
      'pushup',
      'Push-up',
      5,
      8,
      'Hands under shoulders, body one straight line from head to heels, off your toes, no assist. The milestone every step before this was building toward.'
    ),
    reps(
      'pushup_wide',
      'Wide Push-ups',
      5,
      8,
      'Same full push-up, hands set wider than shoulder-width. Shifts more emphasis onto the chest.'
    ),
    reps(
      'diamond_pushup',
      'Diamond Push-ups',
      5,
      8,
      'Hands together under your chest, thumbs and index fingers touching to form a diamond. Shifts more load onto your triceps - noticeably harder than a standard push-up.'
    ),
  ],
  pull: [
    reps(
      'scapular_pulls',
      'Scapular Pulls',
      5,
      8,
      'Hang from the bar with straight arms. Without bending your elbows, pull your shoulder blades down and together to lift your body an inch or two, then release with control.'
    ),
    hold(
      'arch_hangs',
      'Arch Hangs',
      10,
      20,
      'Hang from the bar with a slight arch through your upper back and chest lifted, shoulder blades pulled down and back. Hold that active position rather than hanging limp.'
    ),
    reps(
      'negative_pullup',
      'Negative Pull-ups',
      3,
      5,
      'Jump or step up to the top of a pull-up, chin over the bar, then lower yourself down as slowly as you can - aim for a 5 second count.'
    ),
    reps(
      'pullup',
      'Pull-ups',
      3,
      5,
      'Dead hang to chin over the bar and back down, under control, no kipping.'
    ),
  ],
  // Cross-referenced across StartBodyweight, PowerliftingTechnique, and
  // Garage Gym Reviews' squat progressions - all three independently
  // split "assisted" into a partial-depth stage before a full-depth one,
  // so that split is kept here too instead of jumping straight to full
  // range with a chair still in the picture.
  squat: [
    reps(
      'assisted_squat_partial',
      'Chair-Assisted Squats (partial)',
      5,
      8,
      'Hold the back of a sturdy chair for balance. Lower to a comfortable, controlled depth - doesn\'t need to be deep yet - then stand back up.'
    ),
    reps(
      'assisted_squat_full',
      'Chair-Assisted Squats (full depth)',
      5,
      8,
      'Same chair support, going lower this time - aim for thighs parallel to the floor or as close as feels controlled.'
    ),
    reps(
      'squat_partial',
      'Bodyweight Squats',
      5,
      8,
      'Feet shoulder-width apart, toes slightly out, no chair this time. Sit your hips back and down, chest up, knees tracking over your toes, then stand.'
    ),
    reps(
      'squat_full',
      'Bodyweight Squats (full depth)',
      5,
      8,
      'Same squat, no assist, going for full depth - thighs parallel to the floor or below, chest still up, heels down.'
    ),
    reps(
      'split_squat',
      'Split Squats',
      5,
      8,
      'Feet in a staggered stance, back heel lifted. Lower your back knee toward the floor, then push back up. One rep = one side; do both.'
    ),
    reps(
      'bulgarian_split_squat',
      'Bulgarian Split Squats',
      5,
      8,
      'Rear foot up on a chair behind you, front foot planted well out in front. Lower straight down until your back knee nearly touches the floor, then drive up. One rep = one side; do both.'
    ),
  ],
  hinge: [
    reps(
      'db_rdl',
      'Dumbbell Romanian Deadlift',
      6,
      10,
      'Holding both dumbbells in front of your thighs, hinge at the hips - push your hips back, soft knees, chest up - lowering the weights along your shins until you feel a stretch in your hamstrings, then drive your hips forward to stand. Start light and get the hinge pattern down before worrying about the range.'
    ),
    reps(
      'db_rdl_single_leg',
      'Single-Leg Dumbbell RDL',
      5,
      8,
      'Same hinge, one dumbbell, standing on one leg with the other extending back behind you for balance as you lower the weight. One rep = one side; do both.'
    ),
  ],
  row: [
    reps(
      'db_row_two_hand',
      'Two-Hand Supported Dumbbell Row',
      6,
      10,
      'Hinge forward with a flat back, one hand braced on a chair for support, a dumbbell in the other hand hanging straight down. Pull it up toward your ribs, squeezing your shoulder blade back, then lower with control. Do one side, then the other.'
    ),
    reps(
      'db_row_single_arm',
      'Single-Arm Dumbbell Row',
      6,
      10,
      'Same row, no support hand this time - just a staggered stance for balance. More core and stability demand than the supported version.'
    ),
  ],
};

export const CORE_TRACKS = {
  antiExtension: [
    hold(
      'knee_plank',
      'Knee Plank',
      15,
      30,
      'Forearms on the floor, elbows under shoulders, knees down instead of toes. Body one straight line from head to knees - brace your abs like you are about to be poked in the stomach.'
    ),
    hold(
      'plank',
      'Plank Hold',
      20,
      45,
      'Same form, from your toes now. Body one straight line from head to heels. Do not let your hips sag or pike up.'
    ),
  ],
  extension: [
    hold(
      'superman',
      'Superman Hold',
      15,
      30,
      'Lie face down, arms reaching forward. Lift your chest, arms, and legs off the floor at the same time and hold. The opposite side of the body from push-ups and planks - easy to skip, important not to.'
    ),
  ],
};

// Building up - one exercise, one growing number, one rule
// -----------------------------------------------------------
// You start with exactly ONE exercise, ONE set, target of 1 rep (or 1
// second for holds). Every session you do it, the target grows by 1.
// The running total of everything actually done at that exercise is its
// "cumulative" count. Once cumulative hits 100:
//   - if this pattern has another variation after this one, that
//     variation takes over - starting back at 1, cumulative reset to 0
//   - if this was the last variation in the pattern, the NEXT pattern
//     in BASIC_ORDER gets added instead (also starting at 1) - this
//     one keeps going at whatever it's grown to, no more resets
// That's the whole rule, repeated every time: start at one, grow by one
// each session, 100 total reps earns the next step. No mood, no 3-set
// range, no separate pace dial - the number itself does all the work.
//
// BASIC_ORDER is the automatic path - bodyweight only, no equipment,
// genuinely beginner-appropriate. Pull-ups and dumbbell work (Pull,
// Hinge, Row) are real skills with their own learning curve, and you
// said you're looking for the basics to hold you over before an actual
// gym - so those three stay OUT of the automatic path entirely. They're
// available as an opt-in in Settings whenever you decide you're ready,
// never added for you.
export const BASIC_ORDER = ['push', 'squat', 'antiExtension', 'extension'];
export const OPTIONAL_KEYS = ['pull', 'hinge', 'row'];
export const REP_UNLOCK_THRESHOLD = 100;

function stageListFor(key) {
  return TRACKS[key] || CORE_TRACKS[key];
}

export function defaultUnlockedPatterns() {
  return [BASIC_ORDER[0]]; // just one exercise, day one
}

export function isPatternUnlocked(unlockedPatterns, key) {
  return (unlockedPatterns || []).includes(key);
}

function defaultExerciseState() {
  return { stageIndex: 0, target: 1, cumulative: 0 };
}

export function defaultExerciseStateMap() {
  const map = {};
  [...BASIC_ORDER, ...OPTIONAL_KEYS].forEach((key) => {
    map[key] = defaultExerciseState();
  });
  return map;
}

// Merge saved state with defaults so a habit created before this system
// (or missing an entry for any reason) never breaks.
export function normalizeExerciseState(saved) {
  const s = saved || {};
  const merged = {};
  [...BASIC_ORDER, ...OPTIONAL_KEYS].forEach((key) => {
    merged[key] = { ...defaultExerciseState(), ...(s[key] || {}) };
  });
  return merged;
}

export function currentStage(key, stageIndex) {
  const list = stageListFor(key);
  return list[Math.max(0, Math.min(stageIndex || 0, list.length - 1))];
}

export function exerciseBlock(key, state) {
  const stage = currentStage(key, state.stageIndex);
  return {
    name: stage.name,
    mode: stage.mode,
    target: stage.mode === 'reps' ? state.target : undefined,
    seconds: stage.mode === 'time' ? state.target : undefined,
    rest: 0,
    cue: stage.cue,
    exerciseKey: key,
  };
}

// One session's worth of growth + the 100-rep unlock check for a single
// exercise. valueDone: what was actually logged this session (reps or
// seconds). Returns { state, graduated, newPatternUnlocked } where
// graduated is the new stage's name if this pattern moved to its next
// variation, and newPatternUnlocked is the next pattern's key if this
// was the last variation and cumulative hit 100.
export function growExercise(key, state, valueDone) {
  const list = stageListFor(key);
  const cumulative = (state.cumulative || 0) + (valueDone || 0);
  const target = (state.target || 1) + 1;

  if (cumulative >= REP_UNLOCK_THRESHOLD) {
    if (state.stageIndex < list.length - 1) {
      const nextIndex = state.stageIndex + 1;
      return {
        state: { stageIndex: nextIndex, target: 1, cumulative: 0 },
        graduated: currentStage(key, nextIndex).name,
        newPatternUnlocked: null,
      };
    }
    // Last variation in this pattern - hand off to growAllExercises to
    // figure out which pattern (if any) unlocks next; this exercise
    // itself just keeps growing from here, no more resets.
    return {
      state: { ...state, target, cumulative },
      graduated: null,
      newPatternUnlocked: 'PENDING',
    };
  }

  return { state: { ...state, target, cumulative }, graduated: null, newPatternUnlocked: null };
}

// Applies growExercise to every currently-unlocked pattern after a
// session, and figures out the real next-pattern-to-unlock (if any)
// against the habit's actual unlockedPatterns list.
export function growAllExercises(habit, valuesByKey) {
  const stateMap = normalizeExerciseState(habit.exerciseState);
  const unlocked = habit.unlockedPatterns && habit.unlockedPatterns.length ? habit.unlockedPatterns : defaultUnlockedPatterns();
  const nextStateMap = { ...stateMap };
  const events = []; // [{ key, graduated: name|null }]
  let patternToUnlock = null;

  unlocked.forEach((key) => {
    const result = growExercise(key, stateMap[key], valuesByKey[key] || 0);
    nextStateMap[key] = result.state;
    if (result.graduated) events.push({ key, graduated: result.graduated });
    if (result.newPatternUnlocked === 'PENDING') {
      const next = BASIC_ORDER.find((k) => !unlocked.includes(k));
      if (next) patternToUnlock = next;
    }
  });

  const nextUnlocked = patternToUnlock ? [...unlocked, patternToUnlock] : unlocked;
  return { exerciseState: nextStateMap, unlockedPatterns: nextUnlocked, events, patternToUnlock };
}
