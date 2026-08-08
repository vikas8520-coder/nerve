# Lightweight Local Voice Agent (the "Velo alternative")

A fully-offline voice agent built from your own local stack — **$0, no cloud,
no Twilio/Deepgram bill**. This is the POC proving the local
`STT → LLM → TTS` loop is viable and lightweight, as an alternative to a
hosted service like Velo.ai (which is Deepgram + Twilio + Node.js, cloud-bound
and paid).

## Pipeline

```
mic ─▶ whisper-turbo (STT, ONNX) ─▶ Ollama LLM (nemotron-3-nano:4b) ─▶ kokoro-onnx (TTS) ─▶ speakers
```

All three stages run locally on Apple Silicon (CPU/ANE). No network calls
except to your own Ollama at `127.0.0.1:11434`.

## Why this over Velo

|           | Velo.ai                            | This (local)          |
| --------- | ---------------------------------- | --------------------- |
| Cost      | per-minute cloud (Deepgram/Twilio) | $0                    |
| STT       | Deepgram (cloud)                   | whisper-turbo (local) |
| LLM       | whatever you wire                  | your Ollama (local)   |
| TTS       | cloud                              | kokoro-onnx (local)   |
| Privacy   | audio leaves machine               | stays on device       |
| Footprint | n/a (their servers)                | ~300MB RAM, ONNX-only |

The only things Velo has out-of-the-box that this POC lacks: **telephony**
(phone calls via Twilio) and **barge-in** (interrupt mid-speech). Both are
add-ons, not blockers — see Roadmap.

## Setup

```bash
cd contrib/voicebox-agent
python3.11 -m venv .venv
source .venv/bin/activate
pip install whisper-turbo kokoro-onnx sounddevice

# download kokoro assets (one-time, ~340MB; gitignored)
mkdir -p models
curl -L -o models/kokoro-v1.0.onnx \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o models/voices.bin \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Requires Python 3.11+ (onnxruntime ≥1.20.1 needed by kokoro-onnx). System
Python 3.9 on this Mac is too old — use `python3.11` from
`~/.local/bin/python3.11` or `brew install python@3.12`.

## Run

```bash
source .venv/bin/activate
python3 voice_agent_poc.py
```

- type text → get a spoken reply
- `m` → record from mic, transcribe, reply spoken
- `quit` → exit

Env knobs: `OLLAMA_MODEL` (default `nemotron-3-nano:4b`), `OLLAMA_URL`,
`KOKORO_VOICE` (default `af_heart`; try `af_bella`, `am_michael`).

## Verified

- LLM (Ollama nemotron-3-nano:4b): ~3.7s first token-to-reply
- TTS (kokoro-onnx af_heart): ~3.2s audio for a short sentence, 24kHz, valid WAV
- STT (whisper-turbo base): downloads a small ONNX model on first run
- All three stages run without any cloud dependency.

## Roadmap (next steps if you want to keep building)

1. **Barge-in** — detect mic energy during playback and interrupt.
2. **Tool use** — let the LLM call your Nerve APIs (the "in-app agent" mode).
3. **Telephony** — optional Twilio bridge ONLY for phone use (everything else stays local).
4. **Wake word** — always-listening trigger instead of a keypress/'m'.
5. **Daemonize** — launchd agent so it runs in the background like Willow.

## Files

| File                 | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `voice_agent_poc.py` | the agent (STT→LLM→TTS loop)                                |
| `models/`            | kokoro ONNX model + voices (**gitignored**, download above) |
| `.venv/`             | isolated deps (**gitignored**)                              |
