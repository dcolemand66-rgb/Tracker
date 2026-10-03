// Ambient sound options for a session. Deliberately only listing what's
// ACTUALLY bundled and working right now (Ocean, from the existing
// WhiteNoisePlayer asset) plus Silence — not a padded-out list of options
// that silently do nothing. More tracks (rain, forest, etc.) are real,
// working options the moment an mp3 for them is dropped in
// assets/sounds/ and added to AMBIENT_SOUNDS below; see the comment on
// 'rain' for the exact steps, same pattern as ocean-waves.mp3 already
// uses.
export const AMBIENT_SOUNDS = [
  { id: 'silence', label: 'Silence', icon: '🔇', asset: null },
  { id: 'ocean', label: 'Ocean', icon: '🌊', asset: require('./assets/sounds/ocean-waves.mp3') },

  // To add this (or any other track): find a track you have the rights
  // to use (Pixabay/Freesound CC0, something you recorded, etc.), save
  // it at assets/sounds/<name>.mp3, then uncomment a line like:
  // { id: 'rain', label: 'Rain', icon: '🌧️', asset: require('./assets/sounds/rain.mp3') },
];

export function ambientSoundById(id) {
  return AMBIENT_SOUNDS.find((s) => s.id === id) || AMBIENT_SOUNDS[0];
}
