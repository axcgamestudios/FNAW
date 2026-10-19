#!/usr/bin/env python3
"""Extrae y normaliza los 5 SFX nuevos del repo FNAW del usuario:
- flashlight_click_on / flashlight_click_off (de Click-linterna.mp3)
- foxy_run (loop de carrera de Foxy, de Dumdum foxy.mp3)
- step_player_1..4 (pasos del jugador, de Pasos_jugador.mp3)
- step_anim_1..4 (pasos de animatrónico, de Pasosanimatronico.mp3)
- freddy_laugh (risa de Freddy, de Risafreddy.mp3)
Todo normalizado a -18 LUFS y servido desde public/audio/."""
import subprocess, os

SRC = "/tmp/fnaw_repo/FNAW-main"
OUT = "/home/z/my-project/public/audio"
os.makedirs(OUT, exist_ok=True)

# (destino, fuente, inicio, fin)
CUTS = [
    ("flashlight_click_on",  f"{SRC}/Click-linterna.mp3",  1.88, 2.40),
    ("flashlight_click_off", f"{SRC}/Click-linterna.mp3",  3.12, 3.65),
    ("foxy_run",             f"{SRC}/Dumdum foxy.mp3",     0.30, 9.60),
    ("step_player_1",        f"{SRC}/Pasos_jugador.mp3",   0.32, 0.62),
    ("step_player_2",        f"{SRC}/Pasos_jugador.mp3",   0.98, 1.30),
    ("step_player_3",        f"{SRC}/Pasos_jugador.mp3",   1.58, 1.88),
    ("step_player_4",        f"{SRC}/Pasos_jugador.mp3",   2.24, 2.56),
    ("step_anim_1",          f"{SRC}/Pasosanimatronico.mp3", 0.98, 1.34),
    ("step_anim_2",          f"{SRC}/Pasosanimatronico.mp3", 2.10, 2.42),
    ("step_anim_3",          f"{SRC}/Pasosanimatronico.mp3", 3.66, 4.08),
    ("step_anim_4",          f"{SRC}/Pasosanimatronico.mp3", 4.96, 5.32),
    ("freddy_laugh",         f"{SRC}/Risafreddy.mp3",      0.50, 4.60),
]

for name, src, a, b in CUTS:
    dst = f"{OUT}/{name}.mp3"
    # recorte + fade corto + normalización a -18 LUFS
    subprocess.run([
        "ffmpeg", "-y", "-v", "quiet", "-ss", str(a), "-to", str(b), "-i", src,
        "-af", "loudnorm=I=-18:TP=-2.5:LRA=9,afade=t=in:st=0:d=0.01",
        "-ar", "44100", dst], check=True)
    d = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                        "-of", "csv=p=0", dst], capture_output=True, text=True).stdout.strip()
    print(f"{name:22s} {float(d):5.2f}s  {os.path.getsize(dst)//1024} KB")

print("\nHECHO")
