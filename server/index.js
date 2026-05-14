import express from "express";
import cors from "cors";

const PORT = process.env.PORT ?? 7860;
const TTS_URL = process.env.TTS_URL ?? "http://127.0.0.1:7861";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/speak", async (req, res) => {
  const { text } = req.body ?? {};
  if (!text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const ttsRes = await fetch(`${TTS_URL}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!ttsRes.ok) throw new Error(`tts ${ttsRes.status}`);

    const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
    res.set("Content-Type", "audio/wav");
    res.set("Content-Length", audioBuf.byteLength);
    res.send(audioBuf);
  } catch (err) {
    console.error("TTS error:", err.message);
    res.status(500).json({ error: "synthesis failed" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok", tts: TTS_URL }));

app.listen(PORT, () => console.log(`TTS server listening on :${PORT}`));
