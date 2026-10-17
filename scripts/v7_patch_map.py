#!/usr/bin/env python3
"""v7: extiende el edificio al norte con la MEGA GUARDERÍA (en llamas) —
sala gigante 88×28 m con techo a 9 m, 3 puertas cortafuego y cámara CAM 13."""
import json

PATH = "/home/z/my-project/src/data/map.json"
m = json.load(open(PATH))

# 1) edificio crece hacia el norte
m["building"]["minZ"] = -62

# 2) sala gigante
mega = {
    "id": "megadaycare",
    "name": "Mega Guardería",
    "rect": [-44, -62, 44, -34],
    "floor": "burned",
    "wall": "party",
    "height": 9,
    "ambientLight": {"intensity": 0.85, "color": 16748288, "flicker": 0.35},
}
# sustituir si ya existiera
m["rooms"] = [r for r in m["rooms"] if r["id"] != "megadaycare"] + [mega]

# 3) muros: el muro norte z=-34 pasa a ser pared interior de 9 m con 3 huecos
#    de puerta cortafuego; se añaden muro norte nuevo y extensiones E/O
walls = [w for w in m["walls"] if not (w["z1"] == -34 and w["z2"] == -34 and w["x1"] == -44 and w["x2"] == 44)]
walls.append({
    "x1": -44, "z1": -34, "x2": 44, "z2": -34, "wallType": "concrete", "h": 9,
    "openings": [
        {"at": -37, "width": 2.8, "height": 2.7},
        {"at": -22, "width": 2.8, "height": 2.7},
        {"at": -6, "width": 2.8, "height": 2.7},
    ],
})
walls.append({"x1": -44, "z1": -62, "x2": 44, "z2": -62, "wallType": "rusty", "h": 9})
walls.append({"x1": -44, "z1": -62, "x2": -44, "z2": -34, "wallType": "rusty", "h": 9})
walls.append({"x1": 44, "z1": -62, "x2": 44, "z2": -34, "wallType": "rusty", "h": 9})
m["walls"] = walls

# 4) puertas cortafuego (bloqueadas hasta el cap 4 — el incendio)
FMSG = "PUERTA CORTAFUEGO — LA MEGA GUARDERÍA ARDE DETRÁS"
m["doors"] = [d for d in m["doors"] if not d["id"].startswith("door_mega_")]
m["doors"] += [
    {"id": "door_mega_w", "x": -37, "z": -34, "axis": "x", "width": 2.8,
     "roomA": "workshop", "roomB": "megadaycare", "locked": True, "lockedMsg": FMSG},
    {"id": "door_mega_c", "x": -22, "z": -34, "axis": "x", "width": 2.8,
     "roomA": "kitchen", "roomB": "megadaycare", "locked": True, "lockedMsg": FMSG},
    {"id": "door_mega_e", "x": -6, "z": -34, "axis": "x", "width": 2.8,
     "roomA": "storageN", "roomB": "megadaycare", "locked": True, "lockedMsg": FMSG},
]

# 5) rejas de la guardería pequeña: mensaje nuevo (ya no hay generadores)
for d in m["doors"]:
    if d["id"].startswith("gate_daycare"):
        d["lockedMsg"] = "REJA DE SEGURIDAD — SE ABRIRÁ CUANDO TENGAS LA LINTERNA"

# 6) cámara 13 — Mega Guardería
m["cams"] = [c for c in m["cams"] if c.get("index") != 13]
m["cams"].append({
    "index": 13, "name": "CAM 13 — Mega Guardería", "room": "megadaycare",
    "pos": [-38, 7.6, -36.5], "look": [0, 2.5, -52],
})

# 7) escondites (cofres de juguetes) + batería
m["hidingSpots"] = [h for h in m["hidingSpots"] if not h["id"].startswith("chest_mega")]
m["hidingSpots"] += [
    {"id": "chest_mega_1", "room": "megadaycare", "pos": [-25, -39], "type": "chest", "look": [-25, -42]},
    {"id": "chest_mega_2", "room": "megadaycare", "pos": [-8, -52], "type": "chest", "look": [-8, -55]},
    {"id": "chest_mega_3", "room": "megadaycare", "pos": [26, -38.5], "type": "chest", "look": [26, -41.5]},
    {"id": "chest_mega_4", "room": "megadaycare", "pos": [10, -57], "type": "chest", "look": [10, -60]},
]
m["batterySpots"] = [b for b in m["batterySpots"] if b != [-40, -58]] + [[-40, -58]]

json.dump(m, open(PATH, "w"), ensure_ascii=False, indent=1)
print("map.json OK — salas:", len(m["rooms"]), "muros:", len(m["walls"]),
      "puertas:", len(m["doors"]), "cams:", len(m["cams"]))
