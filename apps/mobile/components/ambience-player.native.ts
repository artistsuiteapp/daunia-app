import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';

/** Riproduttore del sottofondo su iPhone e Android. */
export function useAmbiencePlayer(mod: number | null) {
  const player = useAudioPlayer(mod);

  useEffect(() => {
    player.loop = true;
    player.volume = 0.55;
  }, [player]);

  return {
    play: async () => { player.play(); return true; },
    pause: () => player.pause(),
  };
}
