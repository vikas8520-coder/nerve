#!/usr/bin/env python3
"""
voice_agent_poc.py  —  Lightweight local voice agent (the "Velo alternative")
────────────────────────────────────────────────────────────────────────────
Fully offline, $0, ONNX-only (no torch, no spacy). On Apple Silicon this runs
~300MB RAM and uses the Neural Engine / CPU for STT + TTS:

  mic  ->  whisper-turbo (STT, ONNX)  ->  Ollama LLM  ->  Kokoro-ONNX (TTS)  ->  speakers

This is a proof-of-concept proving the local STT→LLM→TTS loop is viable and
lightweight. No cloud, no Twilio, no Deepgram bill.

Run:
  source .venv/bin/activate
  python3 voice_agent_poc.py
Type text to chat, or 'm' to use the mic, or 'quit' to exit.

Env knobs:
  OLLAMA_MODEL   (default nemotron-3-nano:4b)
  OLLAMA_URL     (default http://127.0.0.1:11434)
  KOKORO_VOICE   (default af_heart — warm female; try af_bella, am_michael)
"""
import os
import sys
import json
import tempfile
import subprocess
import numpy as np
import sounddevice as sd

try:
    from whisper_turbo import WhisperTurbo as _WT
except Exception:
    _WT = None
try:
    from kokoro_onnx import Kokoro as _Kokoro
except Exception:
    _Kokoro = None

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.environ.get("KOKORO_MODEL", os.path.join(HERE, "models", "kokoro-v1.0.onnx"))
VOICES_PATH = os.environ.get("KOKORO_VOICES", os.path.join(HERE, "models", "voices.bin"))

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "nemotron-3-nano:4b")
KOKORO_VOICE = os.environ.get("KOKORO_VOICE", "af_heart")

SAMPLERATE = 16000
REC_SECONDS = 5


# ── STT (whisper-turbo, ONNX) ─────────────────────────────────────────────────
def load_whisper():
    if _WT is None:
        raise RuntimeError("whisper_turbo not installed in this venv")
    print("[load] whisper-turbo (ONNX, base) …")
    return _WT(model_name="base")  # downloads a small ONNX model on first run


def listen(model) -> str:
    print(f"[listen] recording {REC_SECONDS}s from mic …")
    audio = sd.rec(int(REC_SECONDS * SAMPLERATE), samplerate=SAMPLERATE,
                   channels=1, dtype="float32")
    sd.wait()
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    import wave
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SAMPLERATE)
        w.writeframes((audio * 32767).astype("int16").tobytes())
    text = model.transcribe_file(tmp).strip()
    os.remove(tmp)
    return text


# ── LLM (local Ollama) ───────────────────────────────────────────────────────
def chat(prompt: str, history: list) -> str:
    messages = history + [{"role": "user", "content": prompt}]
    payload = {"model": OLLAMA_MODEL, "messages": messages, "stream": False}
    try:
        out = subprocess.run(
            ["curl", "-sS", "-m", "60", "-X", "POST", f"{OLLAMA_URL}/api/chat",
             "-H", "Content-Type: application/json", "-d", json.dumps(payload)],
            capture_output=True, text=True, check=True).stdout
        return json.loads(out)["message"]["content"].strip()
    except Exception as e:
        return f"(llm error: {e})"


# ── TTS (kokoro-onnx) ────────────────────────────────────────────────────────
_KOKORO = None
def speak(text: str) -> str:
    """Returns the path to the synthesized WAV (for verification)."""
    global _KOKORO
    if _Kokoro is None:
        raise RuntimeError("kokoro_onnx not installed in this venv")
    if _KOKORO is None:
        print(f"[load] kokoro-onnx (voice {KOKORO_VOICE}) …")
        _KOKORO = _Kokoro(model_path=MODEL_PATH, voices_path=VOICES_PATH)
    out_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    audio, sr = _KOKORO.create(text, voice=KOKORO_VOICE)
    import wave
    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr)
        wf.writeframes((audio * 32767).astype("int16").tobytes())
    # play to speakers
    sd.play(audio, samplerate=sr)
    sd.wait()
    return out_wav


# ── main loop ─────────────────────────────────────────────────────────────────
def main():
    print("=== Local Voice Agent POC (offline, lightweight) ===")
    print(f"LLM: {OLLAMA_MODEL} @ {OLLAMA_URL}\n")
    whisper = None
    try:
        whisper = load_whisper()
    except Exception as e:
        print(f"[warn] STT unavailable ({e}); text-only mode.\n")
    history = []
    print("Commands: 'm' = mic, 'quit' = exit. Or just type text.\n")
    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nbye"); break
        if line.lower() == "quit":
            break
        if line.lower() == "m":
            if whisper is None:
                print("(STT not loaded)"); continue
            line = listen(whisper)
            if not line:
                print("(no speech detected)"); continue
            print(f"heard: {line}")
        if not line:
            continue
        reply = chat(line, history)
        print(f"agent> {reply}\n")
        history.append({"role": "user", "content": line})
        history.append({"role": "assistant", "content": reply})
        try:
            wav = speak(reply)
            print(f"[audio] played {wav}\n")
        except Exception as e:
            print(f"[tts error] {e}\n")


if __name__ == "__main__":
    main()
