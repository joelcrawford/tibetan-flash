import { useState, useCallback, useRef } from "react";
import { Audio } from "expo-av";

const TTS_URL = process.env.EXPO_PUBLIC_TTS_URL ?? "https://tibetan.havehopeyo.com";

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const soundRef = useRef<Audio.Sound | null>(null);

  const speak = useCallback(async (text: string) => {
    if (speaking) return;
    setSpeaking(true);

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

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

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;

      // Play at normal speed then 0.75x
      await sound.playAsync();
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) resolve();
        });
      });

      await sound.setRateAsync(0.75, true);
      await sound.replayAsync();
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setSpeaking(false);
            resolve();
          }
        });
      });
    } catch {
      setSpeaking(false);
    }
  }, [speaking]);

  return { speak, speaking };
}
