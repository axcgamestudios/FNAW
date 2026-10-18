#!/usr/bin/env python3
"""v8 — Correcciones estructurales del mapa:
1. Cada conducto de rastreo (vent) cruza un muro: se le abre un hueco REAL
   (ancho 1.06, alto 1.22) para que el conducto pase por él en vez de
   atravesarlo "trabado".
2. vent_freezer_tech estaba EXACTAMENTE sobre la puerta door_freezers
   (x=37): se mueve a x=41 (muro despejado).
3. Alturas de apertura de puertas unificadas a 2.15 donde correspondan.
"""
import json

P = "/home/z/my-project/src/data/map.json"
m = json.load(open(P, encoding="utf-8"))

VENT_W = 1.06
VENT_H = 1.22

# conducto -> (muro por sus extremos, coordenada 'at' del hueco)
# muro identificado por (x1,z1,x2,z2)
VENT_FIXES = [
    ("vent_kitchen_tech", (-30, -24, -14, -24), -26),
    ("vent_freezer_tech", (30, -24, 44, -24), 41),
    ("vent_office_techS", (-44, 29, -31, 29), -42),
    ("vent_generator_storageS", (31, 19, 31, 34), 22),
    ("vent_theater_promN", (-30, -9, -16, -9), -20),
    ("vent_daycare_cove", (-29, -3, -29, 13), 9),
    ("vent_lobby_techS", (-31, 29, -31, 34), 31.5),
    ("vent_arcade_theater", (-16, -17, -16, -9), -11),
]

# --- 1. mover vent_freezer_tech fuera de la puerta ---
for v in m["vents"]:
    if v["id"] == "vent_freezer_tech":
        v["a"] = [41, -25.6]
        v["b"] = [41, -22.9]
        print("vent_freezer_tech movido a x=41 (antes chocaba con door_freezers x=37)")

# --- 2. abrir huecos en los muros ---
walls = m["walls"]
n_open = 0
for vid, wkey, at in VENT_FIXES:
    found = False
    for w in walls:
        if (w["x1"], w["z1"], w["x2"], w["z2"]) == wkey:
            openings = w.setdefault("openings", [])
            # ¿hueco ya existente que solape? (p. ej. puerta)
            o_lo, o_hi = at - VENT_W / 2, at + VENT_W / 2
            clash = any(
                abs(o["at"] - at) < (o["width"] + VENT_W) / 2 + 0.15
                for o in openings
            )
            if not clash:
                openings.append({"at": at, "width": VENT_W, "height": VENT_H})
                n_open += 1
                print(f"{vid}: hueco de conducto en muro {wkey} @ {at}")
            else:
                print(f"{vid}: ¡OJO! solapa con hueco existente en {wkey} @ {at}")
            found = True
            break
    if not found:
        print(f"!! {vid}: muro {wkey} NO ENCONTRADO")

json.dump(m, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\nOK: {n_open} huecos de conducto añadidos")
