#!/usr/bin/env python3
"""v7: reescribe trials.json — sunmoon pasa al capítulo 4 (LA MITAD del juego)
como EL INFIERNO de la Mega Guardería con 7 EXTINTORES; cala→5, generadores→6."""
import json

PATH = "/home/z/my-project/src/data/trials.json"
d = json.load(open(PATH))
trials = d["trials"]

by_id = {t["id"]: t for t in trials}

# ---- SOL Y LUNA: el infierno (cap 4, sala gigante en llamas) ----
sunmoon = by_id["sunmoon"]
sunmoon.update({
    "name": "EL INFIERNO — SOL Y LUNA",
    "chapter": 4,
    "room": "megadaycare",
    "hunter": "luna",
    "respawnRoom": "megadaycare",
    "respawnPos": [-36.0, -36.4],
    "respawnYaw": 3.14159,
    "hunterResetRoom": "megadaycare",
    "hunterResetPos": [-10.0, -60.0],
    "aggression": 1.9,
    "darkFromStart": True,
    "sunnyTransform": True,
    "introMsg": (
        "EL HUMO SE TRAGA LA MEGA GUARDERÍA — LUNA CAE DEL TECHO. "
        "Encuentra los 7 EXTINTORES y mata los incendios. "
        "Agáchate: te OYE. Y el fuego TAMBIÉN muerde."
    ),
    "tasks": [
        {"id": "e1", "label": "Extintor — base del castillo de juegos (O)", "at": [-30.0, -41.2], "hold": 4.0},
        {"id": "e2", "label": "Extintor — rincón noroeste", "at": [-38.0, -56.0], "hold": 4.0},
        {"id": "e3", "label": "Extintor — junto a la alberca gigante (O)", "at": [-16.0, -46.2], "hold": 4.0},
        {"id": "e4", "label": "Extintor — piano gigante (N)", "at": [2.0, -58.6], "hold": 4.0},
        {"id": "e5", "label": "Extintor — bajo el arcoíris (E)", "at": [18.0, -43.0], "hold": 4.0},
        {"id": "e6", "label": "Extintor — carrusel roto (E)", "at": [34.0, -46.2], "hold": 4.0},
        {"id": "e7", "label": "Extintor — rincón noreste", "at": [24.0, -59.2], "hold": 4.0},
    ],
    "scares": [
        {"at": "start", "type": "moonDescend", "pos": [-24.0, -44.0],
         "msg": "LUNA SE SUELTA DEL TECHO Y CAE A POCOS METROS — EL JUEGO EMPIEZA"},
        {"at": "task1", "type": "lullaby",
         "msg": "UNA NANA SUENA ENTRE LAS LLAMAS... CADA VEZ MÁS CERCA"},
        {"at": "task2", "type": "fakeSteps",
         "msg": "PASOS SUAVES... RODEÁNDOTE... ENTRE EL HUMO"},
        {"at": "task3", "type": "hunterAppear", "pos": [6.0, -57.0],
         "msg": "LUNA CUERDA EL CARRUSEL — GIRO LENTO — SONRÍE DESDE ARRIBA"},
        {"at": "task4", "type": "moonScream",
         "msg": "LUNA CHILLA — SABE DÓNDE ESTÁS — EL HUMO TE DELATA"},
        {"at": "task5", "type": "lightsOut", "dur": 9,
         "msg": "EL RUIDO DEL FUEGO SE CALLA UN SEGUNDO — SOLO QUEDA TU LINTERNA"},
        {"at": "task6", "type": "hunterChase",
         "msg": "¡ÚLTIMO EXTINTOR — LUNA YA NO SE ESCONDE — CORRE!"},
    ],
    "successMsg": (
        "EL ÚLTIMO FUEGO MUERE. La sala respira... LUNA se retira y SOL despierta "
        "entre el vapor. Las puertas cortafuego se abren de golpe."
    ),
})
sunmoon.pop("requiresObjectives", None)

# ---- renumerar: cala 4→5, generadores 5→6 ----
by_id["cove"]["chapter"] = 5
by_id["generators"]["chapter"] = 6

# el dorado despierta al superar generadores (cap 6 ahora) — texto intacto

json.dump(d, open(PATH, "w"), ensure_ascii=False, indent=2)
print("trials.json v7 OK")
for t in d["trials"]:
    print(f"  cap{t['chapter']}  {t['id']:<12} tareas: {len(t['tasks'])}  sala: {t['room']}")
