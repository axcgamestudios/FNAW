#!/usr/bin/env python3
"""ENGLISH CALL VOICE — Rulo's radio lines.
xiaochen speaking English = natural adult male (F0 ≈ 121 Hz).
NO pitch shifting (user said the deep voice was too deep).
Only a telephone-band radio filter + light compression.
1. Reads src/data/chapters.json (radio.lines per chapter) — ENGLISH
2. z-ai TTS per line → WAV
3. radio filter (150-3400 Hz band + compressor) → MP3
4. manifest with real durations → public/audio/calls/manifest.json
"""
import json, subprocess, os, re, time, sys

ROOT = "/home/z/my-project"
OUT = f"{ROOT}/public/audio/calls"
TMP = "/home/z/my-project/downloads_src/tts_tmp"
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

def clean_for_tts(line: str) -> str:
    t = line
    # remove effect markers between asterisks: *click*, *static*...
    t = re.sub(r"\*[^*]*\*", "", t)
    # long dashes → commas
    t = t.replace("—", ", ").replace("–", ", ").replace("…", "...")
    # MIDDLE-DOT sequences → comma
    t = t.replace(" · ", ", ")
    # ALL-CAPS → Capitalized for natural reading
    def caps_repl(m):
        w = m.group(0)
        return w[0] + w[1:].lower()
    t = re.sub(r"\b[A-Z]{3,}\b", caps_repl, t)
    t = re.sub(r"\s+", " ", t).strip().strip(",;")
    if t and t[-1] not in ".!?…:":
        t += "."
    return t

chapters = json.load(open(f"{ROOT}/src/data/chapters.json"))["chapters"]
manifest = {}
failed = []

def write_manifest():
    """manifest incremental: los capítulos ya regenerados sustituyen a los viejos;
    los pendientes conservan sus entradas anteriores (si existen) para no perder voz."""
    merged = {}
    old = {}
    try:
        old = json.load(open(f"{OUT}/manifest.json"))
    except Exception:
        pass
    for ch in chapters:
        cap = f"cap{ch['chapter']}"
        merged[cap] = manifest.get(cap, old.get(cap, []))
    json.dump(merged, open(f"{OUT}/manifest.json", "w"), ensure_ascii=False, indent=1)

write_manifest()

for ch in chapters:
    radio = ch.get("radio")
    if not radio:
        continue
    cap = ch["chapter"]
    lines = radio["lines"]
    entry = []
    for i, raw in enumerate(lines):
        text = clean_for_tts(raw)
        if not text:
            continue
        wav = f"{TMP}/cap{cap}_l{i}.wav"
        mp3 = f"{OUT}/cap{cap}_l{i}.mp3"
        # v12 — reanudar tras reinicio: saltar si ya existe y el texto coincide
        try:
            old_entry = json.load(open(f"{OUT}/manifest.json")).get(f"cap{cap}", [])
            old_match = next((e for e in old_entry if e["file"] == f"cap{cap}_l{i}.mp3"), None)
            if old_match and os.path.exists(mp3) and os.path.getsize(mp3) > 2000 and old_match.get("text") == text:
                entry.append(old_match)
                print(f"cap{cap} line {i}: SKIP (ya generada)", flush=True)
                continue
        except Exception:
            pass
        # 1) TTS English (retries) — natural speed
        ok = False
        for attempt in range(3):
            try:
                r = subprocess.run(["z-ai", "tts", "-i", text, "-o", wav, "--voice", "xiaochen", "--speed", "0.97"],
                                   capture_output=True, text=True, timeout=240)
                if os.path.exists(wav) and os.path.getsize(wav) > 2000:
                    ok = True
                    break
            except subprocess.TimeoutExpired:
                pass
            time.sleep(12)
        if not ok:
            failed.append((cap, i, "tts", "3 attempts failed"))
            time.sleep(8)
            continue
        # 2) RADIO FILTER — natural male voice, NO pitch shift.
        #    Telephone band 150-3400 Hz, warm mids, tight compression.
        subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", wav,
                        "-af", "highpass=f=150,lowpass=f=3400,"
                               "equalizer=f=300:t=q:w=1.2:g=2,"
                               "equalizer=f=1800:t=q:w=1.4:g=1.5,"
                               "equalizer=f=3000:t=q:w=1:g=-2,"
                               "acompressor=threshold=-19dB:ratio=2.6:attack=6:release=120,volume=1.9",
                        "-ar", "44100", mp3], check=True)
        dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                                    "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout.strip())
        entry.append({"file": f"cap{cap}_l{i}.mp3", "text": text, "dur": round(dur, 2)})
        print(f"cap{cap} line {i}: {dur:.1f}s — {text[:70]}", flush=True)
        time.sleep(3)  # rate-limit respect
    manifest[f"cap{cap}"] = entry
    write_manifest()

json.dump(manifest, open(f"{OUT}/manifest.json", "w"), ensure_ascii=False, indent=1)
print(f"\nMANIFEST FINAL: {len(manifest)} chapters, {sum(len(v) for v in manifest.values())} lines", flush=True)
if failed:
    print("FAILURES:")
    for f in failed:
        print(" ", f)
    sys.exit(1)
