import io
import numpy as np
import scipy.io.wavfile
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from transformers import AutoTokenizer, VitsModel

print("Loading model facebook/mms-tts-bod...")
model = VitsModel.from_pretrained("facebook/mms-tts-bod")
tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-bod")
model.eval()
print("Model ready.")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["POST"])


class SpeakRequest(BaseModel):
    text: str


@app.post("/speak")
def speak(req: SpeakRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    inputs = tokenizer(req.text, return_tensors="pt")
    with torch.no_grad():
        waveform = model(**inputs).waveform.squeeze().cpu().numpy()

    waveform = waveform / np.max(np.abs(waveform))
    pcm = (waveform * 32767).astype(np.int16)

    # ensure minimum duration and pad silence around short audio
    min_samples = int(model.config.sampling_rate * 0.5)
    if len(pcm) < min_samples:
        extra = np.zeros(min_samples - len(pcm), dtype=np.int16)
        pcm = np.concatenate([pcm, extra])

    lead = np.zeros(int(model.config.sampling_rate * 0.1), dtype=np.int16)
    tail = np.zeros(int(model.config.sampling_rate * 2.0), dtype=np.int16)
    pcm = np.concatenate([lead, pcm, tail])

    buf = io.BytesIO()
    scipy.io.wavfile.write(buf, model.config.sampling_rate, pcm)
    buf.seek(0)

    return Response(content=buf.read(), media_type="audio/wav")


@app.get("/health")
def health():
    return {"status": "ok", "model": "facebook/mms-tts-bod"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7861)
