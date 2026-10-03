// Four immersive scenes to pick from instead of the one hardcoded beach
// video. Researched against real atmospheric color grading (golden-hour
// photography, bioluminescent forest shots, deep-space astrophotography,
// desert sunset panoramas) rather than picking flat/arbitrary hex values —
// each is a multi-stop gradient (never a single flat color) plus a matched
// particle color and a soft glow color, which is what actually reads as
// "a place" instead of "a colored rectangle."
//
// Deliberately NOT video this time: four licensed, reliably-hosted loop
// videos is its own research project and a much heavier asset footprint
// than this app has anywhere else. Layered gradients + drifting particles,
// built from the same Animated/LinearGradient primitives already used
// throughout the app, get most of the "I can feel the place" effect
// without a new asset pipeline — see MeditationBackdrop.js.
export const MEDITATION_BACKGROUNDS = [
  {
    id: 'shoreline',
    label: 'Shoreline',
    icon: '🌊',
    gradientColors: ['#061824', '#0d3449', '#1f6e6e', '#cf9d64'],
    gradientLocations: [0, 0.42, 0.78, 1],
    particleColor: 'rgba(234,246,255,0.8)',
    glowColor: '#5ab4e6',
    groundColor: 'rgba(199,163,102,0.85)',
    vibe: 'Dusk tide — deep water cooling into warm wet sand',
  },
  {
    id: 'forest',
    label: 'Forest Canopy',
    icon: '🌲',
    gradientColors: ['#071a12', '#113a24', '#2f6b3f', '#a7d073'],
    gradientLocations: [0, 0.4, 0.75, 1],
    particleColor: 'rgba(216,240,160,0.85)',
    glowColor: '#7fbf5a',
    groundColor: 'rgba(60,90,45,0.85)',
    vibe: 'Shaded floor opening up to sunlit, dappled leaves',
  },
  {
    id: 'night-sky',
    label: 'Night Sky',
    icon: '✨',
    gradientColors: ['#02030d', '#0a1033', '#1c1f52', '#4a3a78'],
    gradientLocations: [0, 0.38, 0.72, 1],
    particleColor: 'rgba(232,227,255,0.9)',
    glowColor: '#8a7ae0',
    groundColor: 'rgba(28,24,60,0.85)',
    vibe: 'Deep orbital dark, lit only by distant stars',
  },
  {
    id: 'desert-dusk',
    label: 'Desert Dusk',
    icon: '🏜️',
    gradientColors: ['#190f1f', '#4a1f2b', '#a8432f', '#eda24e'],
    gradientLocations: [0, 0.4, 0.75, 1],
    particleColor: 'rgba(243,201,138,0.85)',
    glowColor: '#e07a3a',
    groundColor: 'rgba(122,70,38,0.85)',
    vibe: 'Sun dropping behind dunes, sand still warm',
  },
];

export function meditationBackgroundById(id) {
  return MEDITATION_BACKGROUNDS.find((b) => b.id === id) || MEDITATION_BACKGROUNDS[0];
}
