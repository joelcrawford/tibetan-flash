import { useState, useCallback, useRef } from "react";

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const speak = useCallback(async (text: string): Promise<void> => {
    if (speaking) return;
    setSpeaking(true);
    try {
      let audioUrl = cacheRef.current.get(text);

      if (!audioUrl) {
        const base = import.meta.env.VITE_TTS_URL ?? "http://localhost:7860";
        const res = await fetch(`${base}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS request failed");
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
        cacheRef.current.set(text, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        const slow = new Audio(audioUrl as string);
        audioRef.current = slow;
        slow.playbackRate = 0.75;
        slow.onended = () => {
          setSpeaking(false);
          audioRef.current = null;
        };
        slow.play();
      };
      audio.play();
    } catch {
      setSpeaking(false);
    }
  }, [speaking]);

  return { speak, speaking };
}
