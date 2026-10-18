#!/usr/bin/env python3
"""v9 — MAPA NUEVO con estructura de Security Breach:
1. GRAN ATRIO: la sala 'atrium' absorbe el pasaje sur (z 13→19):
   32×28 m con escenario al norte, 3 arcos monumentales al vestíbulo y las
   alas de galería abiertas a sus lados (efecto mezzanine SB).
2. promS se divide en promW / promE (las alas de galería).
3. Se eliminan los muros de la arcada z=13 sobre x[-16,16] (paso abierto).
4. El muro sur del atrio (z=19) sube a 9 m = fachada monumental.
5. Arcos del norte (banda de atracciones) ensanchados a 4.2 m.
6. Renombrado de zonas con identidad SB (Fazer Blast, Bonnie Bowl, Monty
   Golf, Rockstar Row, Guardería Estrellita, Sótano…).
7. Cámaras/puertas/pruebas re-apuntadas a promW/promE.
8. Galería técnica más baja (3.0 m) = pasillo de mantenimiento opresivo.
"""
import json

P = "/home/z/my-project/src/data/map.json"
m = json.load(open(P, encoding="utf-8"))

rooms = m["rooms"]

def room(rid):
    for r in rooms:
        if r["id"] == rid:
            return r
    raise SystemExit(f" sala {rid} no encontrada")

# ---------- 1. GRAN ATRIO ----------
atrium = room("atrium")
atrium["rect"] = [-16, -9, 16, 19]           # z hasta 19 (absorbe el pasaje)
atrium["name"] = "ATRIO CENTRAL — PLAZA FREDDY"
atrium["height"] = 9

# ---------- 2. promS → promW + promE ----------
for r in rooms[:]:
    if r["id"] == "promS":
        rooms.remove(r)
rooms.append({
    "id": "promW", "name": "GALERÍA OESTE",
    "rect": [-44, 13, -16, 19],
    "floor": "polished", "wall": "wallpaper", "height": 4,
    "ambientLight": {"intensity": 0.4, "color": 0xffd9a8, "flicker": 0.1},
})
rooms.append({
    "id": "promE", "name": "GALERÍA ESTE",
    "rect": [16, 13, 44, 19],
    "floor": "polished", "wall": "wallpaper", "height": 4,
    "ambientLight": {"intensity": 0.4, "color": 0xffd9a8, "flicker": 0.1},
})

# ---------- 3. quitar la arcada z=13 sobre el atrio ----------
def remove_wall(x1, z1, x2, z2):
    for w in m["walls"][:]:
        if (w["x1"], w["z1"], w["x2"], w["z2"]) == (x1, z1, x2, z2):
            m["walls"].remove(w)
            print(f"muro eliminado: ({x1},{z1})-({x2},{z2})")
            return True
    print(f"!! muro NO encontrado: ({x1},{z1})-({x2},{z2})")
    return False

remove_wall(-5.5, 13, 5.5, 13)     # arcada central (hueco 11 m)
remove_wall(-16, 13, -5.5, 13)     # paño SO del atrio
remove_wall(5.5, 13, 16, 13)       # paño SE del atrio
# columnas de la arcada: muros estrechos que sostienen el aire
m["walls"].append({"x1": -15.2, "z1": 13, "x2": -14.6, "z2": 13, "wallType": "wallpaper", "h": 9})
m["walls"].append({"x1": 14.6, "z1": 13, "x2": 15.2, "z2": 13, "wallType": "wallpaper", "h": 9})

# ---------- 4. fachada sur monumental (9 m) ----------
for w in m["walls"]:
    if (w["x1"], w["z1"], w["x2"], w["z2"]) == (-31, 19, 20, 19):
        w["h"] = 9
        print("muro sur del atrio elevado a 9 m (fachada monumental)")

# ---------- 5. arcos norte ensanchados ----------
WIDEN = [
    (-30, -17, -16, -17, -23),   # rockstar
    (-16, -17, -2, -17, -9),     # arcade / fazer
    (-2, -17, 12, -17, 5),       # bowling (la arcada del escenario)
    (12, -17, 26, -17, 19),      # prize
    (26, -17, 44, -17, 35),      # golf
]
for x1, z1, x2, z2, at in WIDEN:
    for w in m["walls"]:
        if (w["x1"], w["z1"], w["x2"], w["z2"]) == (x1, z1, x2, z2):
            for o in w.get("openings", []):
                if abs(o["at"] - at) < 0.3 and o["width"] < 4.2:
                    old = o["width"]
                    o["width"] = 4.2
                    print(f"arco @ {at} ensanchado {old} → 4.2")

# ---------- 6. renombrado de zonas ----------
NAMES = {
    "arcade": "FAZER BLAST — SALA LÁSER",
    "bowling": "BONNIE BOWL — PISTA DE BOLOS",
    "golf": "MONTY GOLF — MINIGOLF",
    "rockstar": "ROCKSTAR ROW — GALERÍA",
    "daycare": "GUARDERÍA ESTRELLITA",
    "megadaycare": "SÓTANO — LA PIZZERÍA ORIGINAL (EN LLAMAS)",
    "theater": "TEATRO MARIOPOLO",
    "prize": "MOSTRADOR DE PREMIOS",
    "pirateCove": "LA CALA DEL PIRATA",
    "techHall": "GALERÍA TÉCNICA — MANTENIMIENTO",
    "lobby": "VESTÍBULO PRINCIPAL",
    "foodcourt": "PLAZA DE COMIDAS",
    "westPromN": "PASEO ROCKSTAR (N)",
    "eastPromN": "PASEO FAZER (N)",
}
for rid, name in NAMES.items():
    r = room(rid)
    r["name"] = name

# galería técnica más baja y opresiva
room("techHall")["height"] = 3.0

# ---------- 7. re-apuntar cámaras/puertas ----------
for c in m.get("cams", []):
    if c.get("room") == "promS":
        c["room"] = "atrium" if abs(c["pos"][0]) < 16 else ("promW" if c["pos"][0] < 0 else "promE")
        print(f"cámara re-apuntada a {c['room']}")

for d in m["doors"]:
    for side in ("roomA", "roomB"):
        if d[side] == "promS":
            d[side] = "promW" if d["x"] < -16 else "promE"
            print(f"puerta {d['id']}: {side} → {d[side]}")

# esconderites y demás referencias a promS
for hs in m.get("hidingSpots", []):
    if hs.get("room") == "promS":
        hs["room"] = "promW" if hs["pos"][0] < -16 else "promE"

json.dump(m, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("\nMAPA v9 OK")

# ---------- trials.json: re-apuntar respawn ----------
PT = "/home/z/my-project/src/data/trials.json"
t = json.load(open(PT, encoding="utf-8"))
for tr in t["trials"]:
    if tr.get("respawnRoom") == "promS":
        x = tr["respawnPos"][0]
        tr["respawnRoom"] = "promW" if x < -16 else "promE"
        print(f"trial {tr['id']}: respawn → {tr['respawnRoom']}")
json.dump(t, open(PT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("TRIALS re-apuntados")
