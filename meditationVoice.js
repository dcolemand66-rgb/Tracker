import * as Speech from 'expo-speech';

// Spoken guidance via the phone's own on-device text-to-speech
// (expo-speech), not a recording of any real person's voice. Worth being
// upfront about why: an actual guide's recorded voice (Wim Hof's own,
// or anyone else's) is copyrighted and can't just be downloaded and
// bundled into an app, and this sandbox's network access can't reach
// arbitrary third-party audio sites to source something properly
// licensed either. TTS reading a real, written guidance script is the
// option that's both legal and that actually works fully offline, with
// no external hosting to depend on — swap in real recorded files later
// (same `asset`-based pattern as meditationSounds.js) if you get hold of
// something you have the rights to use.
let queueId = 0;

export function speak(text, opts) {
  const id = ++queueId;
  Speech.stop();
  Speech.speak(text, {
    rate: 0.92,
    pitch: 1.0,
    ...opts,
  });
  return id;
}

export function stopSpeaking() {
  Speech.stop();
}

// --- Circular breathing cues ---
// Spoken only every few breaths (not every single one) so the voice
// doesn't talk over itself or get annoying on a 20+ breath round.
export function circularBreathCue(breathIndex, breathCount) {
  if (breathIndex === 0) return 'Begin. Deep breath in, and let it go.';
  if (breathIndex === breathCount - 1) return 'Last breath. In deep, then let go.';
  if (breathIndex % 5 === 0) return 'Keep going. In deep, let go.';
  return null;
}

export const CIRCULAR_HOLD_CUE = 'Hold. Let go whenever you feel the urge to breathe.';
export const CIRCULAR_RECOVERY_CUE = 'Recovery breath. Breathe in deep, and hold it.';
export const CIRCULAR_ROUND_END_CUE = (round) => `Round ${round} complete.`;
export const CIRCULAR_DONE_CUE = 'Session complete. Sit quietly for a moment.';

// --- Box breathing cues ---
export const BOX_PHASE_CUE = {
  inhale: 'Inhale.',
  holdIn: 'Hold.',
  exhale: 'Exhale.',
  holdOut: 'Hold.',
};
export const BOX_DONE_CUE = 'Session complete. Notice how you feel.';

// --- Body scan script ---
// One line per region (see BODY_SCAN_REGIONS in meditationStyles.js),
// spoken as attention moves to it.
export const BODY_SCAN_LINES = [
  'Bring your attention to your feet and ankles. Just notice how they feel.',
  'Move your attention up through your lower legs and knees. No need to change anything, just notice.',
  'Let your attention settle in your thighs and hips. Notice any tension, and let it soften.',
  'Bring your attention to your lower back and belly. Follow your breath moving through this space.',
  'Move your attention to your chest and upper back. Notice the rise and fall of each breath.',
  'Let your attention move down through your hands and arms. Notice any sensation, without judging it.',
  'Bring your attention to your shoulders and neck. Let them drop, just slightly, with your next exhale.',
  'Move your attention to your face and head. Let your jaw and forehead soften.',
  'Now widen your attention to your whole body at once, resting here until the session ends.',
];

export const BODY_SCAN_INTRO_CUE = 'Find a comfortable position, and close your eyes if that feels right.';
export const BODY_SCAN_DONE_CUE = 'Session complete. Slowly bring your attention back to the room.';
