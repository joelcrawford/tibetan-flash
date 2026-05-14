# ༄༅། Tibetan Flashcards

A flashcard app for learning Tibetan Buddhist vocabulary, with text-to-speech pronunciation powered by Meta's MMS-TTS model.

## Stack

- **Frontend** — React + TypeScript + Vite
- **API server** — Node.js + Express (proxies TTS requests)
- **TTS server** — Python + FastAPI + `facebook/mms-tts-bod`
- **Deployed** — nginx + PM2 on DigitalOcean

## Local Development

You need three things running:

**1. Python TTS server** (first time: creates venv and downloads model ~145 MB)
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r src/python/requirements.txt
python src/python/tts_server.py
```

**2. Node + Vite dev servers**
```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| `←` / `→` | Previous / next card |
| `↓` | Flip card |
| `↑` | Toggle ACIP romanization |
| `Space` | Play pronunciation |

## Deployment

Deploys automatically to `tibetan.havehopeyo.com` on push to `main` via GitHub Actions.

For the first deploy or manual deploys:
```bash
npm run deploy
```

Requires `DEPLOY_HOST` and `DEPLOY_USER` env vars if different from defaults (`bot` / `root`).

### First-time server setup
See `nginx.conf` for the nginx configuration. PM2 manages both the Node and Python processes via `ecosystem.config.cjs`.

## Data

Vocabulary cards live in `src/data/glossary.json`. Each card has:
```json
{
  "tibetan": "མ་རིག་པ།",
  "acip": "MA RIG PA",
  "meaning": "ignorance; fundamental delusion",
  "notes": "Sanskrit: avidyā",
  "context": "...",
  "session": "Session 4"
}
```
