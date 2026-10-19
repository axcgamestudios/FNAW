#!/usr/bin/env python3
"""Analiza F0 (pitch fundamental) y claridad de dos voces TTS en inglés
para elegir la más masculina y decidir cuánto bajar el tono."""
import subprocess
import numpy as np

def load_pcm(path, sr=16000):
    out = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True).stdout
    return np.frombuffer(out, dtype=np.float32), sr

def f0_autocorr(x, sr, fmin=60, fmax=350):
    """F0 por autocorrelación por tramas de 40 ms con doble umbral."""
    win = int(0.04 * sr)
    hop = int(0.02 * sr)
    f0s = []
    for i in range(0, len(x) - win, hop):
        seg = x[i:i+win]
        if np.sqrt(np.mean(seg**2)) < 0.01:
            continue
        seg = seg - seg.mean()
        corr = np.correlate(seg, seg, 'full')[win-1:]
        # normalizar
        if corr[0] <= 0: continue
        corr = corr / corr[0]
        # buscar pico en el rango de voz
        lo = int(sr/fmax); hi = min(int(sr/fmin), len(corr)-1)
        if lo >= hi: continue
        seg_c = corr[lo:hi]
        p = np.argmax(seg_c)
        if seg_c[p] > 0.35:
            f0s.append(sr / (lo + p))
    return f0s

for name in ["en_xiaochen", "en_tongtong"]:
    x, sr = load_pcm(f"/tmp/{name}.wav")
    f0s = f0_autocorr(x, sr)
    if f0s:
        arr = np.array(f0s)
        print(f"{name}: F0 media={arr.mean():.0f} Hz, mediana={np.median(arr):.0f} Hz, "
              f"rango=[{arr.min():.0f}-{arr.max():.0f}], tramas={len(f0s)}")
        # masculino típico: 85-155 Hz; femenino: 165-255 Hz
    else:
        print(f"{name}: sin tramas sonoras")
