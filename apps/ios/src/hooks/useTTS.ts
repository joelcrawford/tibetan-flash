import { useState, useCallback, useRef } from "react";

// expo-audio is not available in Expo Go — fall back to a no-op player for layout testing
let useAudioPlayer: (...args: any[]) => any;
try {
  useAudioPlayer = require("expo-audio").useAudioPlayer;
} catch {
  useAudioPlayer = () => ({ replace: () => {}, play: () => {}, setPlaybackRate: () => {}, seekTo: () => {}, playing: false });
}

const TTS_URL = process.env.EXPO_PUBLIC_TTS_URL ?? "https://tibetan.havehopeyo.com";

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const player = useAudioPlayer(null);

  const speak = useCallback(async (text: string) => {
    if (speaking) return;
    setSpeaking(true);

    try {
      let uri = cacheRef.current.get(text);
      if (!uri) {
        const res = await fetch(`${TTS_URL}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const blob = await res.blob();
        uri = URL.createObjectURL(blob);
        cacheRef.current.set(text, uri);
      }

      // Play at normal speed
      player.replace({ uri });
      player.play();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!player.playing) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

      // Replay at 0.75x
      player.setPlaybackRate(0.75);
      player.seekTo(0);
      player.play();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!player.playing) {
            clearInterval(interval);
            setSpeaking(false);
            resolve();
          }
        }, 100);
      });
    } catch {
      setSpeaking(false);
    }
  }, [speaking, player]);

  return { speak, speaking };
}
