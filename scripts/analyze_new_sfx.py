#!/usr/bin/env python3
"""Analiza los 5 SFX nuevos del repo FNAW: patrones de energía para decidir
puntos de corte (click on/off), loops de pasos, risa de Freddy, carrera de Foxy."""
import subprocess, json, sys
import numpy as np

FILES = {
    "click": "/tmp/fnaw_repo/FNAW-main/Click-linterna.mp3",
    "dumdum": "/tmp/fnaw_repo/FNAW-main/Dumdum foxy.mp3",
    "pasos_jugador": "/tmp/fnaw_repo/FNAW-main/Pasos_jugador.mp3",
    "pasos_anim": "/tmp/fnaw_repo/FNAW-main/Pasosanimatronico.mp3",
    "risa": "/tmp/fnaw_repo/FNAW-main/Risafreddy.mp3",
}

def load_pcm(path, sr=8000):
    out = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
        capture_output=True).stdout
    return np.frombuffer(out, dtype=np.float32), sr

for name, path in FILES.items():
    x, sr = load_pcm(path)
    dur = len(x) / sr
    win = int(0.02 * sr)  # 20ms
    n = len(x) // win
    rms = np.sqrt(np.mean(x[:n*win].reshape(n, win)**2, axis=1) + 1e-12)
    db = 20*np.log10(rms + 1e-9)
    # detect events: windows above threshold
    thr = db.max() - 25
    active = db > thr
    # group into events
    events = []
    i = 0
    while i < n:
        if active[i]:
            j = i
            while j < n and (active[j] or (j+8 < n and active[j+8])):
                j += 1
            events.append((i*0.02, j*0.02))
            i = j + 1
        else:
            i += 1
    print(f"\n=== {name} ({dur:.2f}s, peak {db.max():.0f} dB, {len(events)} eventos) ===")
    for s, e in events[:20]:
        seg = x[int(s*sr):int(e*sr)]
        if len(seg) < 64: continue
        rms_seg = np.sqrt(np.mean(seg**2))
        # zero crossing rate
        zcr = np.mean(np.abs(np.diff(np.sign(seg[:min(len(seg), sr)])))) / 2
        centroid = 0
        chunk = seg[:2048] if len(seg) >= 2048 else seg
        spec = np.abs(np.fft.rfft(chunk))
        if spec.sum() > 0:
            freqs = np.fft.rfftfreq(len(chunk), 1/sr)
            centroid = (freqs * spec).sum() / spec.sum()
        print(f"  {s:6.2f}-{e:6.2f}s  dur={e-s:5.2f}s  cent={centroid:6.0f}Hz  rms={20*np.log10(rms_seg+1e-9):5.1f}dB")
