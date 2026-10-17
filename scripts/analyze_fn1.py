#!/usr/bin/env python3
"""Clasifica los mp3 de FN1: decodifica 40s a PCM 8kHz mono y analiza con numpy."""
import subprocess, os
import numpy as np

SRC = "/home/z/my-project/downloads_src/fn1/files"

def analyze(f):
    path = os.path.join(SRC, f)
    dur = float(subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip() or 0)
    # decodificar primeros 40s como PCM 8kHz mono s16
    raw = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-t", "40", "-i", path, "-ar", "8000", "-ac", "1", "-f", "s16le", "-"],
        capture_output=True).stdout
    if len(raw) < 8000:
        return None
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    # ventanas de 0.5s
    w = 4000
    n = len(a) // w
    if n == 0:
        return None
    rms = np.sqrt((a[: n * w].reshape(n, w) ** 2).mean(axis=1))
    db = 20 * np.log10(rms + 1e-9)
    mean_db = db.mean()
    var = db.std()
    silent = float((db < -45).mean())
    # cruces por cero promedio (voz ~alto y variable, tono puro bajo)
    zcr = float((np.diff(np.sign(a[: n * w].reshape(n, w)), axis=1) != 0).mean() * 8000)
    if dur > 25:
        cls = "VOZ/LLAMADA" if (var > 3.5 or silent > 0.2) else "MUSICA-LARGA"
    elif dur > 8:
        cls = "voz-corta" if var > 4 else "musica/ambiente"
    else:
        cls = "efecto"
    return {"file": f, "dur": round(dur, 1), "db": round(mean_db, 1), "var": round(var, 1),
            "sil": round(silent, 2), "zcr": round(zcr), "class": cls}

files = sorted(f for f in os.listdir(SRC) if f.endswith(".mp3"))
results = [r for r in (analyze(f) for f in files) if r]
for r in sorted(results, key=lambda x: -x["dur"]):
    print(f"{r['file']:12} {r['dur']:>7}s  db={r['db']:>6}  var={r['var']:>5}  sil={r['sil']:>5}  zcr={r['zcr']:>5}  → {r['class']}")
