#!/usr/bin/env python3
"""Genera la voz real (TTS español) de las llamadas de radio de Rulo:
1. Lee src/data/chapters.json (radio.lines por capítulo)
2. Limpia el texto para TTS
3. z-ai tts por línea → WAV
4. filtro de radio (banda telefónica + compresión) → MP3
5. manifiesto con duraciones → public/audio/calls/manifest.json
"""
import json, subprocess, os, re, time, sys

ROOT = "/home/z/my-project"
OUT = f"{ROOT}/public/audio/calls"
TMP = "/home/z/my-project/downloads_src/tts_tmp"
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

def clean_for_tts(line: str) -> str:
    t = line
    # quitar marcadores de efecto entre asteriscos: *clic*, *estática*...
    t = re.sub(r"\*[^*]*\*", "", t)
    # guiones largos y raros → coma/pausa
    t = t.replace("—", ", ").replace("–", ", ")
    # TODO-CAPS → Capitalizado (MEGAPLEX → Megaplex) para lectura natural
    def caps_repl(m):
        w = m.group(0)
        return w[0] + w[1:].lower()
    t = re.sub(r"\b[A-ZÁÉÍÓÚÑ]{3,}\b", caps_repl, t)
    # limpiar espacios
    t = re.sub(r"\s+", " ", t).strip().strip(",;")
    # asegurar puntuación final para entonación
    if t and t[-1] not in ".!?…:":
        t += "."
    return t

chapters = json.load(open(f"{ROOT}/src/data/chapters.json"))["chapters"]
manifest = {}
failed = []

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
        if os.path.exists(mp3):
            dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                                        "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout.strip())
            entry.append({"file": f"cap{cap}_l{i}.mp3", "text": text, "dur": round(dur, 2)})
            continue
        # 1) TTS (con reintentos) — velocidad ligeramente lenta = más peso
        ok = False
        for attempt in range(3):
            try:
                r = subprocess.run(["z-ai", "tts", "-i", text, "-o", wav, "--voice", "xiaochen", "--speed", "0.92"],
                                   capture_output=True, text=True, timeout=240)
                if os.path.exists(wav) and os.path.getsize(wav) > 2000:
                    ok = True
                    break
            except subprocess.TimeoutExpired:
                pass
            time.sleep(15)
        if not ok:
            failed.append((cap, i, "tts", "3 intentos fallidos"))
            time.sleep(10)
            continue
        # 2) VOZ MASCULINA GRAVE: bajamos el tono 22% (pitch 0.78) manteniendo
        #    la duración con atempo, y luego filtro de radio que CONSERVA los
        #    graves (highpass 110 en vez de 280) + resonancia de pecho (170 Hz)
        subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", wav,
                        "-af", "asetrate=24000*0.78,aresample=44100,atempo=1.2821,"
                               "highpass=f=110,lowpass=f=3100,"
                               "equalizer=f=170:t=q:w=1.1:g=5,equalizer=f=300:t=q:w=1:g=2,"
                               "equalizer=f=2800:t=q:w=1:g=-2,"
                               "acompressor=threshold=-21dB:ratio=3:attack=8:release=140,volume=2.0",
                        "-ar", "44100", mp3], check=True)
        dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                                    "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout.strip())
        entry.append({"file": f"cap{cap}_l{i}.mp3", "text": text, "dur": round(dur, 2)})
        print(f"cap{cap} línea {i}: {dur:.1f}s — {text[:60]}")
        time.sleep(3)  # respeto del rate limit
    manifest[f"cap{cap}"] = entry

json.dump(manifest, open(f"{OUT}/manifest.json", "w"), ensure_ascii=False, indent=1)
print(f"\nMANIFEST: {len(manifest)} capítulos, {sum(len(v) for v in manifest.values())} líneas")
if failed:
    print("FALLOS:")
    for f in failed:
        print(" ", f)
