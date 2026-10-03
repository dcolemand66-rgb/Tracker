import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';

// Generalized from the old WhiteNoisePlayer (which only ever played the
// bundled ocean track) now that a session can pick from several ambient
// sounds — see meditationSounds.js for the actual list. `asset` is a
// require()'d local file (or null for Silence, in which case nothing is
// loaded at all).
export default function AmbientSoundPlayer({ asset, playing }) {
  const player = useAudioPlayer(asset || undefined);

  useEffect(() => {
    if (!asset) return;
    player.loop = true;
    player.volume = 0.5;
  }, [player, asset]);

  useEffect(() => {
    if (!asset) return;
    if (playing) player.play();
    else player.pause();
  }, [playing, player, asset]);

  return null;
}
