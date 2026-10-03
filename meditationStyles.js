// One shared "level" per Meditation habit (meditationLevel, stepped by
// DAYS_PER_LEVEL consecutive days — see habitStreak/handleMeditationComplete
// in HabitsDetailScreen.js) drives how demanding EVERY style's session is,
// just interpreted differently per style. That keeps one unified sense of
// progress across styles instead of three separate leveling systems, which
// would make switching styles feel like starting over.

export const DAYS_PER_LEVEL = 7;
export const MEDITATION_MAX_LEVEL = 17;

// Circular breathing + breath-hold + recovery hold — the method that was
// already here, just now one of three rather than the only option.
export const MEDITATION_STYLES = [
  {
    id: 'breathing',
    label: 'Circular Breathing',
    icon: '🌀',
    tagline: 'Rapid deep breaths, then hold',
    description:
      'Deep circular breaths build up, then you hold as long as comfortable before a ' +
      'recovery hold. Energizing and intense — sit or lie down somewhere safe.',
  },
  {
    id: 'box',
    label: 'Box Breathing',
    icon: '◻️',
    tagline: 'Equal-count inhale · hold · exhale · hold',
    description:
      'Slow, even 4-4-4-4 breathing. Steadier and calmer than circular breathing — good ' +
      'for settling nerves or refocusing before something stressful.',
  },
  {
    id: 'bodyscan',
    label: 'Body Scan',
    icon: '🧘',
    tagline: 'Guided attention, head to toe',
    description:
      'A slow guided pass of attention through the body, one region at a time. Minimal ' +
      'pacing — mostly about listening and noticing, not breath counting.',
  },
];

export function meditationStyleById(id) {
  return MEDITATION_STYLES.find((s) => s.id === id) || MEDITATION_STYLES[0];
}

// --- Circular breathing (unchanged from the original single-style spec) ---
export function meditationLevelSpec(levelIndex) {
  const n = Math.max(0, Math.min(MEDITATION_MAX_LEVEL, levelIndex || 0));
  return {
    level: n,
    breathCount: 5 + 5 * Math.floor(n / 3),
    rounds: (n % 3) + 1,
    isMax: n >= MEDITATION_MAX_LEVEL,
  };
}

export function meditationLevelLabel(levelIndex) {
  const spec = meditationLevelSpec(levelIndex);
  return `${spec.breathCount} breaths x ${spec.rounds} round${spec.rounds === 1 ? '' : 's'}`;
}

// --- Box breathing: cycle count climbs with level, same 4s per side ---
export function boxLevelSpec(levelIndex) {
  const n = Math.max(0, Math.min(MEDITATION_MAX_LEVEL, levelIndex || 0));
  const cycles = Math.min(16, 4 + n);
  return { level: n, cycles, secondsPerSide: 4, isMax: n >= MEDITATION_MAX_LEVEL };
}

export function boxLevelLabel(levelIndex) {
  const spec = boxLevelSpec(levelIndex);
  return `${spec.cycles} cycles`;
}

// --- Body scan: total minutes climbs with level, spread across regions ---
export const BODY_SCAN_REGIONS = [
  'Feet and ankles',
  'Lower legs and knees',
  'Thighs and hips',
  'Lower back and belly',
  'Chest and upper back',
  'Hands and arms',
  'Shoulders and neck',
  'Face and head',
  'The whole body, all at once',
];

export function bodyScanLevelSpec(levelIndex) {
  const n = Math.max(0, Math.min(MEDITATION_MAX_LEVEL, levelIndex || 0));
  const minutes = Math.min(15, 3 + n);
  return { level: n, minutes, isMax: n >= MEDITATION_MAX_LEVEL };
}

export function bodyScanLevelLabel(levelIndex) {
  const spec = bodyScanLevelSpec(levelIndex);
  return `${spec.minutes} min`;
}

// A single entry point so the habit-detail screen can show "what level N
// means" without caring which style is currently selected.
export function styleLevelLabel(styleId, levelIndex) {
  if (styleId === 'box') return boxLevelLabel(levelIndex);
  if (styleId === 'bodyscan') return bodyScanLevelLabel(levelIndex);
  return meditationLevelLabel(levelIndex);
}
